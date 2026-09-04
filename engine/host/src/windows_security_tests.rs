use super::*;

use std::os::windows::ffi::OsStrExt;
use std::process::Command;

use windows_sys::Win32::Foundation::{CloseHandle, LocalFree, ERROR_SUCCESS};
use windows_sys::Win32::Security::Authorization::{
    ConvertStringSidToSidW, GetNamedSecurityInfoW, SE_FILE_OBJECT,
};
use windows_sys::Win32::Security::{
    EqualSid, GetAce, GetSecurityDescriptorControl, GetTokenInformation, TokenUser,
    ACCESS_ALLOWED_ACE, CONTAINER_INHERIT_ACE, DACL_SECURITY_INFORMATION, OBJECT_INHERIT_ACE,
    OWNER_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR, PSID, SE_DACL_PROTECTED, TOKEN_QUERY,
    TOKEN_USER,
};
use windows_sys::Win32::Storage::FileSystem::FILE_ALL_ACCESS;
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

fn wide(value: &std::ffi::OsStr) -> Vec<u16> {
    value.encode_wide().chain(Some(0)).collect()
}

fn string_sid(value: &str) -> PSID {
    let encoded: Vec<u16> = value.encode_utf16().chain(Some(0)).collect();
    let mut sid = std::ptr::null_mut();
    assert_ne!(
        unsafe { ConvertStringSidToSidW(encoded.as_ptr(), &mut sid) },
        0,
        "ConvertStringSidToSidW({value}) failed: {}",
        std::io::Error::last_os_error()
    );
    sid
}

#[test]
fn transport_br_017_windows_junction_result_traversal_is_rejected() {
    let root = std::env::temp_dir().join(next_diagnostic_id());
    let target = std::env::temp_dir().join(next_diagnostic_id());
    let junction = root.join("replaced-scratch");
    std::fs::create_dir(&root).unwrap();
    std::fs::create_dir(&target).unwrap();

    let expected_name = "result-owned.json";
    std::fs::write(
        target.join(expected_name),
        serde_json::to_vec(&fixture_response()).unwrap(),
    )
    .unwrap();
    let output = Command::new("cmd.exe")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(&junction)
        .arg(&target)
        .output()
        .expect("the Windows command processor must be available");
    assert!(
        output.status.success(),
        "junction creation failed: stdout={} stderr={}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    let binding = binding_from_request(&fixture_request()).unwrap();
    let error = read_and_validate_result(
        &junction.join(expected_name),
        &junction,
        &binding,
        DEFAULT_LIMITS.max_response_bytes,
    )
    .unwrap_err();
    assert_eq!(error.code, TransportCode::UnsafeResult);
    assert_eq!(error.stage, TransportStage::Read);

    std::fs::remove_dir(&junction).unwrap();
    std::fs::remove_dir_all(&target).unwrap();
    std::fs::remove_dir_all(&root).unwrap();
}

#[test]
fn transport_br_018_windows_scratch_has_current_owner_and_private_protected_dacl() {
    let root = std::env::temp_dir().join(next_diagnostic_id());
    std::fs::create_dir(&root).unwrap();
    let scratch = create_scratch(&root).unwrap();
    let scratch_path = scratch.0.clone();

    let mut owner: PSID = std::ptr::null_mut();
    let mut dacl = std::ptr::null_mut();
    let mut descriptor: PSECURITY_DESCRIPTOR = std::ptr::null_mut();
    let status = unsafe {
        GetNamedSecurityInfoW(
            wide(scratch_path.as_os_str()).as_ptr(),
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            &mut owner,
            std::ptr::null_mut(),
            &mut dacl,
            std::ptr::null_mut(),
            &mut descriptor,
        )
    };
    assert_eq!(
        status, ERROR_SUCCESS,
        "GetNamedSecurityInfoW failed: {status}"
    );
    assert!(!owner.is_null(), "scratch owner SID is missing");
    assert!(!dacl.is_null(), "scratch DACL is missing");

    let mut token = std::ptr::null_mut();
    assert_ne!(
        unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) },
        0,
        "OpenProcessToken failed: {}",
        std::io::Error::last_os_error()
    );
    let mut token_bytes = 0;
    unsafe {
        GetTokenInformation(token, TokenUser, std::ptr::null_mut(), 0, &mut token_bytes);
    }
    assert!(token_bytes >= std::mem::size_of::<TOKEN_USER>() as u32);
    let mut token_buffer = vec![0u8; token_bytes as usize];
    assert_ne!(
        unsafe {
            GetTokenInformation(
                token,
                TokenUser,
                token_buffer.as_mut_ptr().cast(),
                token_bytes,
                &mut token_bytes,
            )
        },
        0,
        "GetTokenInformation failed: {}",
        std::io::Error::last_os_error()
    );
    let token_user = unsafe { &*(token_buffer.as_ptr().cast::<TOKEN_USER>()) };
    assert_ne!(
        unsafe { EqualSid(owner, token_user.User.Sid) },
        0,
        "scratch owner is not the current process user"
    );

    let mut control = 0;
    let mut revision = 0;
    assert_ne!(
        unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) },
        0,
        "GetSecurityDescriptorControl failed: {}",
        std::io::Error::last_os_error()
    );
    assert_ne!(
        control & SE_DACL_PROTECTED,
        0,
        "scratch DACL inherits parent access"
    );
    assert_eq!(
        unsafe { (*dacl).AceCount },
        2,
        "private scratch must have exactly owner-rights and LocalSystem ACEs"
    );

    let owner_rights = string_sid("S-1-3-4");
    let local_system = string_sid("S-1-5-18");
    let mut saw_owner_rights = false;
    let mut saw_system = false;
    for index in 0..unsafe { (*dacl).AceCount } as u32 {
        let mut raw_ace = std::ptr::null_mut();
        assert_ne!(
            unsafe { GetAce(dacl, index, &mut raw_ace) },
            0,
            "GetAce({index}) failed"
        );
        let ace = unsafe { &*(raw_ace.cast::<ACCESS_ALLOWED_ACE>()) };
        assert_eq!(ace.Mask, FILE_ALL_ACCESS);
        assert_eq!(
            ace.Header.AceFlags as u32 & (OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE),
            OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE
        );
        let sid = std::ptr::addr_of!(ace.SidStart).cast_mut().cast();
        saw_owner_rights |= unsafe { EqualSid(sid, owner_rights) } != 0;
        saw_system |= unsafe { EqualSid(sid, local_system) } != 0;
    }
    assert!(
        saw_owner_rights && saw_system,
        "scratch DACL permits a principal beyond owner-rights and LocalSystem"
    );

    unsafe {
        CloseHandle(token);
        LocalFree(owner_rights);
        LocalFree(local_system);
        LocalFree(descriptor);
    }
    drop(scratch);
    assert!(!scratch_path.exists());
    std::fs::remove_dir(root).unwrap();
}

fn fixture_request() -> Value {
    serde_json::from_slice(include_bytes!(
        "../../../engine/fixtures/bom-contract/colorbond.request.json"
    ))
    .unwrap()
}

fn fixture_response() -> Value {
    serde_json::from_slice(include_bytes!(
        "../../../engine/fixtures/bom-contract/colorbond.response.json"
    ))
    .unwrap()
}
