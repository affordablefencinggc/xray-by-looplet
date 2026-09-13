//! Fail-closed transport between the desktop host and deterministic BOM engine.
//! Production accepts canonical JSON on stdin and opens one host-owned result.
//! Tests inject a command factory, so no packaged/repository engine is resolved.

use serde::Serialize;
use serde_json::{json, Value};
use std::collections::BTreeMap;
#[cfg(not(windows))]
use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::io::AsRawHandle;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
#[cfg(windows)]
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

pub const REQUEST_SCHEMA: &str = "xray.job-to-bom/v1";
pub const RESPONSE_SCHEMA: &str = "xray.bom/v1";
pub const RULESET_ID: &str = "fencing-v1";
pub const RULESET_VERSION: u64 = 1;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransportLimits {
    pub max_request_bytes: usize,
    pub max_stdout_bytes: usize,
    pub max_stderr_bytes: usize,
    pub max_response_bytes: usize,
    #[serde(skip)]
    pub execution_duration: Duration,
    #[serde(skip)]
    pub cancellation_grace: Duration,
}
pub const DEFAULT_LIMITS: TransportLimits = TransportLimits {
    max_request_bytes: 1_048_576,
    max_stdout_bytes: 64 * 1024,
    max_stderr_bytes: 64 * 1024,
    max_response_bytes: 4 * 1024 * 1024,
    execution_duration: Duration::from_secs(30),
    cancellation_grace: Duration::from_secs(2),
};

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum TransportCode {
    InvalidRequest,
    UnsupportedContract,
    EngineUnavailable,
    SpawnFailed,
    RequestWriteFailed,
    Timeout,
    Cancelled,
    NonzeroExit,
    StdoutLimit,
    StderrLimit,
    ResponseLimit,
    MissingResult,
    UnsafeResult,
    MalformedResult,
    ResponseContract,
    RequestIdMismatch,
    InputDigestMismatch,
    SourceBindingMismatch,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum TransportStage {
    Preflight,
    Encode,
    Spawn,
    Write,
    Execute,
    Read,
    Parse,
    Validate,
    Bind,
    Cleanup,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransportError {
    pub code: TransportCode,
    pub stage: TransportStage,
    pub retryable: bool,
    pub safe_message: &'static str,
    pub diagnostic_id: Option<String>,
}
impl std::fmt::Display for TransportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.safe_message)
    }
}
impl std::error::Error for TransportError {}

/// Compatibility wrapper for the old Tauri surface. Never contains a raw path.
#[derive(Debug)]
pub struct EngineError(pub String);
impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}
impl std::error::Error for EngineError {}

#[derive(Clone, Debug, PartialEq, Eq)]
struct Binding {
    request_id: String,
    input_digest: String,
    job_id: String,
    job_revision: u64,
    document_sha256: String,
    recipe_set_id: String,
    recipe_set_revision: u64,
    recipe_set_digest: String,
}

#[derive(Clone, Debug)]
pub struct Invocation {
    pub scratch_dir: PathBuf,
    pub result_path: PathBuf,
}

/// Sole process-construction seam. Tests inject only harmless test processes.
pub trait CommandFactory: Send + Sync {
    fn command(&self, invocation: &Invocation) -> Result<Command, TransportError>;
    fn status_command(&self) -> Result<Command, TransportError>;
}

#[derive(Clone, Debug)]
pub struct ConfiguredRunner {
    executable: PathBuf,
}
impl ConfiguredRunner {
    pub fn new(executable: PathBuf) -> Result<Self, TransportError> {
        validate_executable(&executable)?;
        Ok(Self { executable })
    }
    pub fn from_environment() -> Result<Self, TransportError> {
        let raw = std::env::var_os("XRAY_ENGINE_PATH").ok_or_else(engine_unavailable)?;
        Self::new(PathBuf::from(raw))
    }
}
impl CommandFactory for ConfiguredRunner {
    fn command(&self, invocation: &Invocation) -> Result<Command, TransportError> {
        validate_executable(&self.executable)?;
        let mut command = Command::new(&self.executable);
        #[cfg(windows)]
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW retains redirected stdin/stdout.
        command.args([
            "job-to-bom",
            "--request-stdin",
            "--result",
            invocation.result_path.to_string_lossy().as_ref(),
        ]);
        Ok(command)
    }
    fn status_command(&self) -> Result<Command, TransportError> {
        validate_executable(&self.executable)?;
        let mut command = Command::new(&self.executable);
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        command.args(["contract-status", "--json"]);
        Ok(command)
    }
}

fn validate_executable(path: &Path) -> Result<(), TransportError> {
    if !path.is_absolute() {
        return Err(engine_unavailable());
    }
    let metadata = std::fs::symlink_metadata(path).map_err(|_| engine_unavailable())?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(engine_unavailable());
    }
    Ok(())
}
fn error(
    code: TransportCode,
    stage: TransportStage,
    retryable: bool,
    safe_message: &'static str,
) -> TransportError {
    TransportError {
        code,
        stage,
        retryable,
        safe_message,
        // A diagnostic identifier is emitted only when a future host-private
        // sink has actually persisted the bounded detail.
        diagnostic_id: None,
    }
}
fn engine_unavailable() -> TransportError {
    error(
        TransportCode::EngineUnavailable,
        TransportStage::Preflight,
        true,
        "The local calculation engine is unavailable.",
    )
}
static NEXT_ID: AtomicU64 = AtomicU64::new(1);
fn next_diagnostic_id() -> String {
    let serial = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!("xray-{now:032x}-{serial:016x}")
}

#[derive(Clone, Default)]
pub struct CancellationToken(Arc<AtomicBool>);
impl CancellationToken {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::Release);
    }
    fn is_cancelled(&self) -> bool {
        self.0.load(Ordering::Acquire)
    }
}
struct ScratchGuard(PathBuf);
impl Drop for ScratchGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Owns the OS containment primitive for one engine invocation. Dropping it
/// terminates any descendant that outlived the direct child.
struct ProcessTree {
    #[cfg(unix)]
    process_group: Option<i32>,
    #[cfg(windows)]
    job: HANDLE,
}

impl ProcessTree {
    #[allow(clippy::unnecessary_wraps)]
    fn prepare(_command: &mut Command) -> Result<Self, TransportError> {
        #[cfg(unix)]
        {
            _command.process_group(0);
            Ok(Self {
                process_group: None,
            })
        }
        #[cfg(windows)]
        {
            // KILL_ON_JOB_CLOSE makes cleanup fail closed even during unwinding.
            let job = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
            if job.is_null() {
                return Err(process_tree_error());
            }
            let mut information: JOBOBJECT_EXTENDED_LIMIT_INFORMATION =
                unsafe { std::mem::zeroed() };
            information.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let configured = unsafe {
                SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &information as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };
            if configured == 0 {
                unsafe { CloseHandle(job) };
                return Err(process_tree_error());
            }
            Ok(Self { job })
        }
        #[cfg(not(any(unix, windows)))]
        {
            let _ = _command;
            Ok(Self {})
        }
    }

    #[allow(clippy::unnecessary_wraps)]
    fn attach(&mut self, child: &mut Child) -> Result<(), TransportError> {
        #[cfg(unix)]
        {
            self.process_group = Some(child.id() as i32);
            Ok(())
        }
        #[cfg(windows)]
        {
            let assigned =
                unsafe { AssignProcessToJobObject(self.job, child.as_raw_handle() as HANDLE) };
            if assigned == 0 {
                let _ = child.kill();
                let _ = child.wait();
                return Err(process_tree_error());
            }
            Ok(())
        }
        #[cfg(not(any(unix, windows)))]
        {
            let _ = child;
            Ok(())
        }
    }

    fn kill(&mut self) {
        #[cfg(unix)]
        if let Some(group) = self.process_group.take() {
            unsafe extern "C" {
                fn kill(pid: i32, signal: i32) -> i32;
            }
            const SIGKILL: i32 = 9;
            let _ = unsafe { kill(-group, SIGKILL) };
        }
        #[cfg(windows)]
        if !self.job.is_null() {
            let _ = unsafe { TerminateJobObject(self.job, 1) };
        }
    }
}

impl Drop for ProcessTree {
    fn drop(&mut self) {
        self.kill();
        #[cfg(windows)]
        if !self.job.is_null() {
            unsafe { CloseHandle(self.job) };
            self.job = std::ptr::null_mut();
        }
    }
}

fn process_tree_error() -> TransportError {
    error(
        TransportCode::SpawnFailed,
        TransportStage::Spawn,
        true,
        "The local calculation engine could not be contained safely.",
    )
}

#[cfg(windows)]
fn current_process_user_sid() -> std::io::Result<String> {
    use windows_sys::Win32::Foundation::{LocalFree, ERROR_INSUFFICIENT_BUFFER};
    use windows_sys::Win32::Security::Authorization::ConvertSidToStringSidW;
    use windows_sys::Win32::Security::{GetTokenInformation, TokenUser, TOKEN_QUERY, TOKEN_USER};
    use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    struct Token(HANDLE);
    impl Drop for Token { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }
    struct SidString(*mut u16);
    impl Drop for SidString { fn drop(&mut self) { unsafe { LocalFree(self.0.cast()); } } }
    let mut raw = std::ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut raw) } == 0 {
        return Err(std::io::Error::last_os_error());
    }
    let token = Token(raw);
    let mut bytes = 0;
    let first = unsafe { GetTokenInformation(token.0, TokenUser, std::ptr::null_mut(), 0, &mut bytes) };
    if first != 0 || std::io::Error::last_os_error().raw_os_error() != Some(ERROR_INSUFFICIENT_BUFFER as i32)
        || bytes < std::mem::size_of::<TOKEN_USER>() as u32 || bytes > 65536 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Could not inspect process user token."));
    }
    // TOKEN_USER includes pointers: usize storage guarantees their required alignment.
    let mut buffer = vec![0usize; (bytes as usize).div_ceil(std::mem::size_of::<usize>())];
    if unsafe { GetTokenInformation(token.0, TokenUser, buffer.as_mut_ptr().cast(), bytes, &mut bytes) } == 0 {
        return Err(std::io::Error::last_os_error());
    }
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut sid = std::ptr::null_mut();
    if unsafe { ConvertSidToStringSidW(user.User.Sid, &mut sid) } == 0 {
        return Err(std::io::Error::last_os_error());
    }
    let sid = SidString(sid);
    let mut length = 0;
    while length < 256 && unsafe { *sid.0.add(length) } != 0 { length += 1; }
    if length == 256 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Process user SID is too long."));
    }
    String::from_utf16(unsafe { std::slice::from_raw_parts(sid.0, length) })
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid process user SID."))
}

#[cfg(windows)]
fn create_private_directory(path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Authorization::{
        ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
    };
    use windows_sys::Win32::Security::{PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES};
    use windows_sys::Win32::Storage::FileSystem::CreateDirectoryW;

    // Protected DACL: the directory owner and LocalSystem have full control;
    // no parent ACE is inherited. OI/CI inherits these ACEs; child ownership is determined separately.
    // TokenOwner may be Administrators under an elevated token. Pin the actual
    // TokenUser owner atomically rather than relying on that default owner.
    let sddl: Vec<u16> = format!("O:{}D:P(A;OICI;FA;;;OW)(A;OICI;FA;;;SY)\0", current_process_user_sid()?)
        .encode_utf16()
        .collect();
    let mut descriptor: PSECURITY_DESCRIPTOR = std::ptr::null_mut();
    let converted = unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            SDDL_REVISION_1,
            &mut descriptor,
            std::ptr::null_mut(),
        )
    };
    if converted == 0 {
        return Err(std::io::Error::last_os_error());
    }

    let path_wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let attributes = SECURITY_ATTRIBUTES {
        nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor,
        bInheritHandle: 0,
    };
    let created = unsafe { CreateDirectoryW(path_wide.as_ptr(), &attributes) };
    let result = if created == 0 {
        Err(std::io::Error::last_os_error())
    } else {
        Ok(())
    };
    unsafe {
        LocalFree(descriptor);
    }
    result
}

#[cfg(windows)]
fn is_windows_reparse_point(metadata: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;
    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

fn create_scratch(root: &Path) -> Result<ScratchGuard, TransportError> {
    for _ in 0..32 {
        let candidate = root.join(next_diagnostic_id());
        #[cfg(windows)]
        let created = create_private_directory(&candidate);
        #[cfg(not(windows))]
        let created = std::fs::create_dir(&candidate);
        match created {
            Ok(()) => {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    std::fs::set_permissions(&candidate, std::fs::Permissions::from_mode(0o700))
                        .map_err(|_| engine_unavailable())?;
                }
                return Ok(ScratchGuard(candidate));
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(_) => return Err(engine_unavailable()),
        }
    }
    Err(engine_unavailable())
}

pub fn run_bom(request: &[u8], cancellation: CancellationToken) -> Result<Value, TransportError> {
    let runner = ConfiguredRunner::from_environment()?;
    run_bom_with(
        &runner,
        request,
        cancellation,
        DEFAULT_LIMITS,
        &std::env::temp_dir(),
    )
}

/// Recompute the digest of the exact imported source bytes before a desktop
/// caller selects or invokes an engine runner.
pub fn verify_source_sha256(
    source_bytes: &[u8],
    expected_sha256: &str,
) -> Result<(), TransportError> {
    if source_bytes.is_empty()
        || expected_sha256.len() != 64
        || !expected_sha256
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        return Err(error(
            TransportCode::InvalidRequest,
            TransportStage::Preflight,
            false,
            "The source document binding is invalid.",
        ));
    }
    if sha256_hex(source_bytes) != expected_sha256 {
        return Err(error(
            TransportCode::SourceBindingMismatch,
            TransportStage::Bind,
            false,
            "The calculation request does not match the verified source document.",
        ));
    }
    Ok(())
}

pub fn run_bom_with(
    factory: &dyn CommandFactory,
    request: &[u8],
    cancellation: CancellationToken,
    limits: TransportLimits,
    scratch_root: &Path,
) -> Result<Value, TransportError> {
    if request.len() > limits.max_request_bytes {
        return Err(error(
            TransportCode::InvalidRequest,
            TransportStage::Preflight,
            false,
            "The calculation request is too large.",
        ));
    }
    let request_value: Value = serde_json::from_slice(request).map_err(|_| {
        error(
            TransportCode::InvalidRequest,
            TransportStage::Parse,
            false,
            "The calculation request is invalid.",
        )
    })?;
    validate_contract(&request_value, "request").map_err(|message| {
        let code = if message == "unsupported contract" {
            TransportCode::UnsupportedContract
        } else {
            TransportCode::InvalidRequest
        };
        error(
            code,
            TransportStage::Validate,
            false,
            "The calculation request is invalid.",
        )
    })?;
    let binding = binding_from_request(&request_value)?;
    if sha256_hex(canonical_input(&request_value).as_bytes()) != binding.input_digest {
        return Err(error(
            TransportCode::InputDigestMismatch,
            TransportStage::Preflight,
            false,
            "The calculation request digest does not match its contents.",
        ));
    }
    if cancellation.is_cancelled() {
        return Err(error(
            TransportCode::Cancelled,
            TransportStage::Preflight,
            true,
            "The calculation was cancelled.",
        ));
    }

    let scratch = create_scratch(scratch_root)?;
    let result_path = scratch.0.join(format!(
        "result-{}.json",
        sha256_hex(binding.request_id.as_bytes())
    ));
    let invocation = Invocation {
        scratch_dir: scratch.0.clone(),
        result_path: result_path.clone(),
    };
    let mut command = factory.command(&invocation)?;
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&scratch.0);
    let mut process_tree = ProcessTree::prepare(&mut command)?;
    let mut child = command.spawn().map_err(|_| {
        error(
            TransportCode::SpawnFailed,
            TransportStage::Spawn,
            true,
            "The local calculation engine could not be started.",
        )
    })?;
    process_tree.attach(&mut child)?;
    let stdin = child.stdin.take().ok_or_else(|| {
        error(
            TransportCode::RequestWriteFailed,
            TransportStage::Write,
            true,
            "The calculation request could not be sent.",
        )
    })?;
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let (write_tx, write_rx) = mpsc::channel();
    let request_owned = request.to_vec();
    let writer = thread::spawn(move || {
        let mut stdin = stdin;
        let result = stdin.write_all(&request_owned).and_then(|_| stdin.flush());
        drop(stdin);
        let result = result.map_err(|_| ());
        let _ = write_tx.send(result);
        result
    });
    let (stdout_thread, stdout_overflow) = bounded_reader(stdout, limits.max_stdout_bytes);
    let (stderr_thread, stderr_overflow) = bounded_reader(stderr, limits.max_stderr_bytes);
    let status = match wait_for_child(
        &mut child,
        &cancellation,
        limits,
        &stdout_overflow,
        &stderr_overflow,
        &write_rx,
        &mut process_tree,
    ) {
        Ok(status) => status,
        Err(primary) => {
            // Never let a blocked pipe-reader obscure timeout/cancellation.
            // Detached bounded workers own no scratch path and retain at most
            // the configured limits.
            drop(writer);
            drop(stdout_thread);
            drop(stderr_thread);
            return Err(primary);
        }
    };
    // A direct child may exit after leaving a descendant holding inherited
    // pipe handles. End the containment group before joining pipe readers so
    // cleanup cannot hang on an orphaned writer.
    process_tree.kill();
    let write_result = writer.join().unwrap_or(Err(()));
    let stdout = stdout_thread.join().unwrap_or_default();
    let stderr = stderr_thread.join().unwrap_or_default();
    if stdout_overflow.load(Ordering::Acquire) {
        return Err(error(
            TransportCode::StdoutLimit,
            TransportStage::Read,
            true,
            "The calculation engine produced too much output.",
        ));
    }
    if stderr_overflow.load(Ordering::Acquire) {
        return Err(error(
            TransportCode::StderrLimit,
            TransportStage::Read,
            true,
            "The calculation engine produced too much diagnostic output.",
        ));
    }
    if write_result.is_err() {
        return Err(error(
            TransportCode::RequestWriteFailed,
            TransportStage::Write,
            true,
            "The calculation request could not be sent.",
        ));
    }
    if !status.success() {
        let _private_diagnostic = bounded_diagnostic(&stdout, &stderr);
        return Err(error(
            TransportCode::NonzeroExit,
            TransportStage::Execute,
            true,
            "The calculation engine stopped before producing a result.",
        ));
    }
    read_and_validate_result(
        &result_path,
        &scratch.0,
        &binding,
        limits.max_response_bytes,
    )
}

fn wait_for_child(
    child: &mut Child,
    cancellation: &CancellationToken,
    limits: TransportLimits,
    stdout_overflow: &AtomicBool,
    stderr_overflow: &AtomicBool,
    write_rx: &mpsc::Receiver<Result<(), ()>>,
    process_tree: &mut ProcessTree,
) -> Result<ExitStatus, TransportError> {
    let started = Instant::now();
    let mut write_complete = false;
    loop {
        if !write_complete {
            match write_rx.try_recv() {
                Ok(Ok(())) => write_complete = true,
                Ok(Err(())) | Err(mpsc::TryRecvError::Disconnected) => {
                    terminate(child, process_tree, limits.cancellation_grace);
                    return Err(error(
                        TransportCode::RequestWriteFailed,
                        TransportStage::Write,
                        true,
                        "The calculation request could not be sent.",
                    ));
                }
                Err(mpsc::TryRecvError::Empty) => {}
            }
        }
        if cancellation.is_cancelled() {
            terminate(child, process_tree, limits.cancellation_grace);
            return Err(error(
                TransportCode::Cancelled,
                TransportStage::Execute,
                true,
                "The calculation was cancelled.",
            ));
        }
        if started.elapsed() >= limits.execution_duration {
            terminate(child, process_tree, limits.cancellation_grace);
            return Err(error(
                TransportCode::Timeout,
                TransportStage::Execute,
                true,
                "The calculation engine timed out.",
            ));
        }
        if stdout_overflow.load(Ordering::Acquire) || stderr_overflow.load(Ordering::Acquire) {
            terminate(child, process_tree, limits.cancellation_grace);
        }
        match child.try_wait() {
            Ok(Some(status)) => return Ok(status),
            Ok(None) => thread::sleep(Duration::from_millis(5)),
            Err(_) => {
                terminate(child, process_tree, limits.cancellation_grace);
                return Err(error(
                    TransportCode::NonzeroExit,
                    TransportStage::Execute,
                    true,
                    "The calculation engine stopped before producing a result.",
                ));
            }
        }
    }
}
fn terminate(child: &mut Child, process_tree: &mut ProcessTree, grace: Duration) {
    process_tree.kill();
    let _ = child.kill();
    let deadline = Instant::now() + grace;
    while Instant::now() < deadline {
        if child.try_wait().ok().flatten().is_some() {
            return;
        }
        thread::sleep(Duration::from_millis(5));
    }
    let _ = child.kill();
    let _ = child.wait();
}
fn bounded_reader<R: Read + Send + 'static>(
    mut reader: R,
    limit: usize,
) -> (thread::JoinHandle<Vec<u8>>, Arc<AtomicBool>) {
    let overflow = Arc::new(AtomicBool::new(false));
    let signal = overflow.clone();
    let handle = thread::spawn(move || {
        let mut retained = Vec::with_capacity(limit.min(8192));
        let mut buffer = [0u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let room = limit.saturating_sub(retained.len());
                    retained.extend_from_slice(&buffer[..count.min(room)]);
                    if count > room {
                        signal.store(true, Ordering::Release);
                        break;
                    }
                }
            }
        }
        retained
    });
    (handle, overflow)
}
fn bounded_diagnostic(stdout: &[u8], stderr: &[u8]) -> Vec<u8> {
    stdout
        .iter()
        .chain(stderr)
        .copied()
        .filter(|b| b.is_ascii_graphic() || *b == b' ')
        .take(1024)
        .collect()
}

fn read_and_validate_result(
    result_path: &Path,
    scratch: &Path,
    binding: &Binding,
    limit: usize,
) -> Result<Value, TransportError> {
    let metadata = std::fs::symlink_metadata(result_path).map_err(|_| {
        error(
            TransportCode::MissingResult,
            TransportStage::Read,
            true,
            "The calculation engine did not produce its expected result.",
        )
    })?;
    #[cfg(windows)]
    let has_reparse_traversal = is_windows_reparse_point(&metadata)
        || std::fs::symlink_metadata(scratch)
            .map(|scratch_metadata| is_windows_reparse_point(&scratch_metadata))
            .unwrap_or(true);
    #[cfg(not(windows))]
    let has_reparse_traversal = false;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() || has_reparse_traversal
    {
        return Err(error(
            TransportCode::UnsafeResult,
            TransportStage::Read,
            false,
            "The calculation engine produced an unsafe result.",
        ));
    }
    if result_path
        .parent()
        .and_then(|p| p.canonicalize().ok())
        .as_deref()
        != scratch.canonicalize().ok().as_deref()
    {
        return Err(error(
            TransportCode::UnsafeResult,
            TransportStage::Read,
            false,
            "The calculation engine produced an unsafe result.",
        ));
    }
    if metadata.len() > limit as u64 {
        return Err(error(
            TransportCode::ResponseLimit,
            TransportStage::Read,
            false,
            "The calculation result is too large.",
        ));
    }
    let mut raw = Vec::with_capacity((metadata.len() as usize).min(limit));
    #[cfg(windows)]
    let result_file = {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::FILE_FLAG_OPEN_REPARSE_POINT;
        let file = std::fs::OpenOptions::new()
            .read(true)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(result_path)
            .map_err(|_| {
                error(
                    TransportCode::MissingResult,
                    TransportStage::Read,
                    true,
                    "The calculation result could not be read.",
                )
            })?;
        let opened_metadata = file.metadata().map_err(|_| {
            error(
                TransportCode::UnsafeResult,
                TransportStage::Read,
                false,
                "The calculation engine produced an unsafe result.",
            )
        })?;
        if !opened_metadata.file_type().is_file()
            || is_windows_reparse_point(&opened_metadata)
            || opened_metadata.len() != metadata.len()
        {
            return Err(error(
                TransportCode::UnsafeResult,
                TransportStage::Read,
                false,
                "The calculation engine produced an unsafe result.",
            ));
        }
        file
    };
    #[cfg(not(windows))]
    let result_file = File::open(result_path).map_err(|_| {
        error(
            TransportCode::MissingResult,
            TransportStage::Read,
            true,
            "The calculation result could not be read.",
        )
    })?;
    result_file
        .take(limit as u64 + 1)
        .read_to_end(&mut raw)
        .map_err(|_| {
            error(
                TransportCode::MissingResult,
                TransportStage::Read,
                true,
                "The calculation result could not be read.",
            )
        })?;
    if raw.len() > limit {
        return Err(error(
            TransportCode::ResponseLimit,
            TransportStage::Read,
            false,
            "The calculation result is too large.",
        ));
    }
    let response: Value = serde_json::from_slice(&raw).map_err(|_| {
        error(
            TransportCode::MalformedResult,
            TransportStage::Parse,
            false,
            "The calculation engine produced an invalid result.",
        )
    })?;
    let kind = if response.get("ok") == Some(&Value::Bool(true)) {
        "success"
    } else {
        "error"
    };
    validate_contract(&response, kind).map_err(|_| {
        error(
            TransportCode::ResponseContract,
            TransportStage::Validate,
            false,
            "The calculation result does not match the supported contract.",
        )
    })?;
    validate_binding(&response, binding)?;
    Ok(response)
}

fn validate_binding(response: &Value, expected: &Binding) -> Result<(), TransportError> {
    if text(response, &["requestId"]) != Some(expected.request_id.as_str()) {
        return Err(error(
            TransportCode::RequestIdMismatch,
            TransportStage::Bind,
            false,
            "The calculation result belongs to another request.",
        ));
    }
    if response.get("ok") == Some(&Value::Bool(false)) {
        if text(response, &["inputDigest"]) != Some(expected.input_digest.as_str()) {
            return Err(error(
                TransportCode::InputDigestMismatch,
                TransportStage::Bind,
                false,
                "The calculation result belongs to different input.",
            ));
        }
        return Ok(());
    }
    if text(response, &["bom", "inputDigest"]) != Some(expected.input_digest.as_str()) {
        return Err(error(
            TransportCode::InputDigestMismatch,
            TransportStage::Bind,
            false,
            "The calculation result belongs to different input.",
        ));
    }
    let matches = text(response, &["bom", "jobId"]) == Some(expected.job_id.as_str())
        && integer(response, &["bom", "jobRevision"]) == Some(expected.job_revision)
        && text(response, &["bom", "documentSha256"]) == Some(expected.document_sha256.as_str())
        && text(response, &["bom", "recipeSet", "id"]) == Some(expected.recipe_set_id.as_str())
        && integer(response, &["bom", "recipeSet", "revision"])
            == Some(expected.recipe_set_revision)
        && text(response, &["bom", "recipeSet", "digest"])
            == Some(expected.recipe_set_digest.as_str())
        && text(response, &["bom", "ruleset", "id"]) == Some(RULESET_ID)
        && integer(response, &["bom", "ruleset", "version"]) == Some(RULESET_VERSION);
    if !matches {
        return Err(error(
            TransportCode::SourceBindingMismatch,
            TransportStage::Bind,
            false,
            "The calculation result belongs to different source data.",
        ));
    }
    Ok(())
}
fn binding_from_request(request: &Value) -> Result<Binding, TransportError> {
    let invalid = || {
        error(
            TransportCode::InvalidRequest,
            TransportStage::Validate,
            false,
            "The calculation request is invalid.",
        )
    };
    Ok(Binding {
        request_id: text(request, &["requestId"])
            .ok_or_else(invalid)?
            .to_owned(),
        input_digest: text(request, &["inputDigest"])
            .ok_or_else(invalid)?
            .to_owned(),
        job_id: text(request, &["job", "id"])
            .ok_or_else(invalid)?
            .to_owned(),
        job_revision: integer(request, &["job", "revision"]).ok_or_else(invalid)?,
        document_sha256: text(request, &["document", "sha256"])
            .ok_or_else(invalid)?
            .to_owned(),
        recipe_set_id: text(request, &["recipeSet", "id"])
            .ok_or_else(invalid)?
            .to_owned(),
        recipe_set_revision: integer(request, &["recipeSet", "revision"]).ok_or_else(invalid)?,
        recipe_set_digest: text(request, &["recipeSet", "digest"])
            .ok_or_else(invalid)?
            .to_owned(),
    })
}
fn at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    path.iter().try_fold(value, |v, key| v.get(*key))
}
fn text<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    at(value, path)?.as_str()
}
fn integer(value: &Value, path: &[&str]) -> Option<u64> {
    at(value, path)?.as_u64()
}

fn canonical_input(request: &Value) -> String {
    let mut input = request.clone();
    if let Some(o) = input.as_object_mut() {
        o.remove("requestId");
        o.remove("inputDigest");
    }
    serde_json::to_string(&sort_json(input)).expect("JSON values serialize")
}
fn sort_json(value: Value) -> Value {
    match value {
        Value::Object(object) => {
            let sorted: BTreeMap<_, _> =
                object.into_iter().map(|(k, v)| (k, sort_json(v))).collect();
            Value::Object(sorted.into_iter().collect())
        }
        Value::Array(values) => Value::Array(values.into_iter().map(sort_json).collect()),
        other => other,
    }
}

fn contract_schema() -> Value {
    serde_json::from_str(include_str!(
        "../../../contracts/xray-job-bom-v1.schema.json"
    ))
    .expect("contract schema JSON")
}
fn validate_contract(value: &Value, definition: &str) -> Result<(), String> {
    if definition == "request" && value.get("schema") != Some(&Value::String(REQUEST_SCHEMA.into()))
    {
        return Err("unsupported contract".into());
    }
    let root = contract_schema();
    let schema = root
        .pointer(&format!("/$defs/{definition}"))
        .ok_or("missing schema")?;
    validate_schema(value, schema, &root, "$".into())
}
fn validate_schema(
    value: &Value,
    schema: &Value,
    root: &Value,
    path: String,
) -> Result<(), String> {
    if let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
        let target = root
            .pointer(reference.trim_start_matches('#'))
            .ok_or_else(|| format!("{path}: reference"))?;
        return validate_schema(value, target, root, path);
    }
    if let Some(options) = schema.get("oneOf").and_then(Value::as_array) {
        if options
            .iter()
            .filter(|s| validate_schema(value, s, root, path.clone()).is_ok())
            .count()
            != 1
        {
            return Err(format!("{path}: oneOf"));
        }
    }
    if schema.get("const").is_some_and(|c| value != c) {
        return Err(format!("{path}: const"));
    }
    if schema
        .get("enum")
        .and_then(Value::as_array)
        .is_some_and(|values| !values.contains(value))
    {
        return Err(format!("{path}: enum"));
    }
    if let Some(kind) = schema.get("type") {
        let valid = match kind {
            Value::String(k) => type_matches(value, k),
            Value::Array(kinds) => kinds
                .iter()
                .filter_map(Value::as_str)
                .any(|k| type_matches(value, k)),
            _ => false,
        };
        if !valid {
            return Err(format!("{path}: type"));
        }
    }
    if let Some(object) = value.as_object() {
        if let Some(required) = schema.get("required").and_then(Value::as_array) {
            for key in required.iter().filter_map(Value::as_str) {
                if !object.contains_key(key) {
                    return Err(format!("{path}: missing {key}"));
                }
            }
        }
        if let Some(properties) = schema.get("properties").and_then(Value::as_object) {
            if schema.get("additionalProperties") == Some(&Value::Bool(false)) {
                for key in object.keys() {
                    if !properties.contains_key(key) {
                        return Err(format!("{path}: unknown {key}"));
                    }
                }
            }
            for (key, child_schema) in properties {
                if let Some(child) = object.get(key) {
                    validate_schema(child, child_schema, root, format!("{path}.{key}"))?;
                }
            }
        }
    }
    if let Some(array) = value.as_array() {
        if schema
            .get("minItems")
            .and_then(Value::as_u64)
            .is_some_and(|n| array.len() < n as usize)
        {
            return Err(format!("{path}: minItems"));
        }
        if let Some(items) = schema.get("items") {
            for (i, child) in array.iter().enumerate() {
                validate_schema(child, items, root, format!("{path}[{i}]"))?;
            }
        }
        if schema.get("uniqueItems") == Some(&Value::Bool(true)) {
            for (index, item) in array.iter().enumerate() {
                if array[..index].contains(item) {
                    return Err(format!("{path}: duplicate item"));
                }
            }
        }
    }
    if let Some(s) = value.as_str() {
        if schema
            .get("minLength")
            .and_then(Value::as_u64)
            .is_some_and(|n| s.chars().count() < n as usize)
        {
            return Err(format!("{path}: minLength"));
        }
        if schema
            .get("maxLength")
            .and_then(Value::as_u64)
            .is_some_and(|n| s.chars().count() > n as usize)
        {
            return Err(format!("{path}: maxLength"));
        }
        if let Some(pattern) = schema.get("pattern").and_then(Value::as_str) {
            let valid = if pattern.contains("[a-f0-9]{64}") {
                s.len() == 64
                    && s.bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            } else if pattern.contains("\\d") {
                is_canonical_decimal(s) && !(pattern.contains("^0\\.") && s == "0")
            } else {
                true
            };
            if !valid {
                return Err(format!("{path}: pattern"));
            }
        }
        if schema.get("format") == Some(&Value::String("date-time".into()))
            && !is_rfc3339_datetime(s)
        {
            return Err(format!("{path}: date-time format"));
        }
    }
    if let Some(number) = value.as_u64() {
        if schema
            .get("minimum")
            .and_then(Value::as_u64)
            .is_some_and(|minimum| number < minimum)
        {
            return Err(format!("{path}: below minimum"));
        }
        if schema
            .get("maximum")
            .and_then(Value::as_u64)
            .is_some_and(|maximum| number > maximum)
        {
            return Err(format!("{path}: above maximum"));
        }
    }
    if let Some(all) = schema.get("allOf").and_then(Value::as_array) {
        for condition in all {
            match (condition.get("if"), condition.get("then")) {
                (Some(predicate), Some(consequence))
                    if validate_schema(value, predicate, root, path.clone()).is_ok() =>
                {
                    validate_schema(value, consequence, root, path.clone())?;
                }
                (None, _) => validate_schema(value, condition, root, path.clone())?,
                _ => {}
            }
        }
    }
    Ok(())
}
fn type_matches(value: &Value, kind: &str) -> bool {
    match kind {
        "object" => value.is_object(),
        "array" => value.is_array(),
        "string" => value.is_string(),
        "integer" => value.as_i64().is_some() || value.as_u64().is_some(),
        "boolean" => value.is_boolean(),
        "null" => value.is_null(),
        _ => false,
    }
}
fn is_canonical_decimal(s: &str) -> bool {
    if s == "0" {
        return true;
    }
    let mut p = s.split('.');
    let i = p.next().unwrap_or_default();
    let f = p.next();
    if p.next().is_some()
        || i.is_empty()
        || (i.starts_with('0') && i.len() > 1)
        || !i.bytes().all(|b| b.is_ascii_digit())
    {
        return false;
    }
    f.is_none_or(|v| !v.is_empty() && v.bytes().all(|b| b.is_ascii_digit()) && !v.ends_with('0'))
}

fn is_rfc3339_datetime(value: &str) -> bool {
    fn digits(value: &[u8]) -> Option<u32> {
        value.iter().try_fold(0u32, |number, byte| {
            byte.is_ascii_digit()
                .then(|| number * 10 + u32::from(byte - b'0'))
        })
    }
    let bytes = value.as_bytes();
    if bytes.len() < 20
        || bytes.get(4) != Some(&b'-')
        || bytes.get(7) != Some(&b'-')
        || !matches!(bytes.get(10), Some(b'T' | b't'))
        || bytes.get(13) != Some(&b':')
        || bytes.get(16) != Some(&b':')
    {
        return false;
    }
    let (year, month, day, hour, minute, second) = match (
        digits(&bytes[0..4]),
        digits(&bytes[5..7]),
        digits(&bytes[8..10]),
        digits(&bytes[11..13]),
        digits(&bytes[14..16]),
        digits(&bytes[17..19]),
    ) {
        (Some(y), Some(m), Some(d), Some(h), Some(min), Some(s)) => (y, m, d, h, min, s),
        _ => return false,
    };
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return false,
    };
    if day == 0 || day > max_day || hour > 23 || minute > 59 || second > 60 {
        return false;
    }
    let mut cursor = 19;
    if bytes.get(cursor) == Some(&b'.') {
        cursor += 1;
        let fraction_start = cursor;
        while bytes.get(cursor).is_some_and(u8::is_ascii_digit) {
            cursor += 1;
        }
        if cursor == fraction_start {
            return false;
        }
    }
    match bytes.get(cursor) {
        Some(b'Z' | b'z') => cursor + 1 == bytes.len(),
        Some(b'+' | b'-') if cursor + 6 == bytes.len() => {
            bytes.get(cursor + 3) == Some(&b':')
                && digits(&bytes[cursor + 1..cursor + 3]).is_some_and(|h| h <= 23)
                && digits(&bytes[cursor + 4..cursor + 6]).is_some_and(|m| m <= 59)
        }
        _ => false,
    }
}

// Dependency-free SHA-256 for the canonical wire input.
fn sha256_hex(bytes: &[u8]) -> String {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut state = [
        0x6a09e667u32,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    let bit_len = (bytes.len() as u64).wrapping_mul(8);
    let mut msg = bytes.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0)
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());
    for chunk_start in (0..msg.len()).step_by(64) {
        let chunk = &msg[chunk_start..chunk_start + 64];
        let mut w = [0u32; 64];
        for (i, slot) in w.iter_mut().enumerate().take(16) {
            let offset = i * 4;
            *slot = u32::from_be_bytes(chunk[offset..offset + 4].try_into().unwrap())
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1)
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut h] = state;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = h
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            h = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2)
        }
        for (slot, v) in state.iter_mut().zip([a, b, c, d, e, f, g, h]) {
            *slot = slot.wrapping_add(v)
        }
    }
    state.iter().map(|w| format!("{w:08x}")).collect()
}

pub fn engine_exe_name() -> &'static str {
    if cfg!(windows) {
        "xray-engine.exe"
    } else {
        "xray-engine"
    }
}
/// No source-tree, `engine/bin`, or PATH-Python discovery.
pub fn resolve_engine_path() -> Option<PathBuf> {
    ConfiguredRunner::from_environment()
        .ok()
        .map(|r| r.executable)
}
pub fn engine_status() -> Value {
    match ConfiguredRunner::from_environment() {
        Ok(runner) => engine_status_with(&runner),
        Err(_) => status_envelope(false),
    }
}

fn status_envelope(available: bool) -> Value {
    json!({"engine":"xray-by-looplet","host":"tauri","available":available,"contract":REQUEST_SCHEMA,"responseContract":RESPONSE_SCHEMA,"ruleset":RULESET_ID})
}

/// Bounded cold-start allowance for a real frozen runtime, without weakening its handshake.
pub fn engine_status_with(factory: &dyn CommandFactory) -> Value {
    engine_status_with_timeout(factory, Duration::from_secs(10))
}

fn engine_status_with_timeout(factory: &dyn CommandFactory, timeout: Duration) -> Value {
    let unavailable = || json!({"engine":"xray-by-looplet","host":"tauri","available":false,"contract":REQUEST_SCHEMA,"responseContract":RESPONSE_SCHEMA,"ruleset":RULESET_ID});
    let mut command = match factory.status_command() {
        Ok(v) => v,
        Err(_) => return unavailable(),
    };
    let available = bounded_status_output(&mut command, timeout).is_some_and(|output| {
        serde_json::from_slice::<Value>(&output).is_ok_and(|s| {
            s.get("requestSchema") == Some(&Value::String(REQUEST_SCHEMA.into()))
                && s.get("responseSchema") == Some(&Value::String(RESPONSE_SCHEMA.into()))
                && s.get("ruleset") == Some(&Value::String(RULESET_ID.into()))
        })
    });
    json!({"engine":"xray-by-looplet","host":"tauri","available":available,"contract":REQUEST_SCHEMA,"responseContract":RESPONSE_SCHEMA,"ruleset":RULESET_ID})
}

fn bounded_status_output(command: &mut Command, timeout: Duration) -> Option<Vec<u8>> {
    const STATUS_LIMIT: usize = 4096;
    command
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .stdout(Stdio::piped());
    let mut process_tree = ProcessTree::prepare(command).ok()?;
    let mut child = command.spawn().ok()?;
    process_tree.attach(&mut child).ok()?;
    let stdout = child.stdout.take()?;
    let (reader, overflow) = bounded_reader(stdout, STATUS_LIMIT);
    let started = Instant::now();
    let status = loop {
        if overflow.load(Ordering::Acquire) || started.elapsed() >= timeout {
            terminate(&mut child, &mut process_tree, Duration::from_millis(100));
            return None;
        }
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => thread::sleep(Duration::from_millis(5)),
            Err(_) => {
                terminate(&mut child, &mut process_tree, Duration::from_millis(100));
                return None;
            }
        }
    };
    process_tree.kill();
    let output = reader.join().ok()?;
    (status.success() && !overflow.load(Ordering::Acquire)).then_some(output)
}
/// Fail-closed compatibility only; typed `run_bom` replaces arbitrary paths.
pub fn run_takeoff(_pdf_path: &str) -> Result<Value, EngineError> {
    Err(EngineError(
        "The legacy path-based takeoff command is disabled; use the typed BOM transport.".into(),
    ))
}

#[cfg(all(test, windows))]
mod windows_security_tests;

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::OpenOptions;
    use std::io::Cursor;
    use std::sync::atomic::AtomicUsize;
    fn fixture(name: &str) -> Value {
        serde_json::from_str(
            &std::fs::read_to_string(
                PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                    .join(format!("../fixtures/bom-contract/{name}")),
            )
            .unwrap(),
        )
        .unwrap()
    }

    fn fixture_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join(format!("../fixtures/bom-contract/{name}"))
            .canonicalize()
            .unwrap()
    }

    #[derive(Clone)]
    struct FixtureFactory {
        behavior: &'static str,
        spawned: Arc<AtomicUsize>,
        marker: Option<PathBuf>,
        stdout_bytes: Option<usize>,
    }

    impl FixtureFactory {
        fn new(behavior: &'static str) -> Self {
            Self {
                behavior,
                spawned: Arc::new(AtomicUsize::new(0)),
                marker: None,
                stdout_bytes: None,
            }
        }

        fn with_marker(behavior: &'static str, marker: PathBuf) -> Self {
            Self {
                behavior,
                spawned: Arc::new(AtomicUsize::new(0)),
                marker: Some(marker),
                stdout_bytes: None,
            }
        }

        fn with_stdout_bytes(stdout_bytes: usize) -> Self {
            Self {
                behavior: "stdout-sized",
                spawned: Arc::new(AtomicUsize::new(0)),
                marker: None,
                stdout_bytes: Some(stdout_bytes),
            }
        }
    }

    impl CommandFactory for FixtureFactory {
        fn command(&self, invocation: &Invocation) -> Result<Command, TransportError> {
            self.spawned.fetch_add(1, Ordering::SeqCst);
            let mut command = Command::new(std::env::current_exe().unwrap());
            command
                .args([
                    "--exact",
                    "tests::transport_fixture_process",
                    "--ignored",
                    "--nocapture",
                    "--quiet",
                ])
                .env("XRAY_TEST_FIXTURE", "1")
                .env("XRAY_TEST_BEHAVIOR", self.behavior)
                .env("XRAY_TEST_RESULT", &invocation.result_path)
                .env(
                    "XRAY_TEST_RESPONSE",
                    fixture_path("colorbond.response.json"),
                );
            if let Some(marker) = &self.marker {
                command.env("XRAY_TEST_MARKER", marker);
            }
            if let Some(stdout_bytes) = self.stdout_bytes {
                command.env("XRAY_TEST_STDOUT_BYTES", stdout_bytes.to_string());
            }
            Ok(command)
        }

        fn status_command(&self) -> Result<Command, TransportError> {
            let invocation = Invocation {
                scratch_dir: std::env::temp_dir(),
                result_path: std::env::temp_dir().join("unused"),
            };
            self.command(&invocation)
        }
    }

    struct MissingExecutableFactory;

    impl CommandFactory for MissingExecutableFactory {
        fn command(&self, _invocation: &Invocation) -> Result<Command, TransportError> {
            Ok(Command::new(
                std::env::temp_dir().join("xray-definitely-missing-test-executable"),
            ))
        }

        fn status_command(&self) -> Result<Command, TransportError> {
            self.command(&Invocation {
                scratch_dir: std::env::temp_dir(),
                result_path: std::env::temp_dir().join("unused"),
            })
        }
    }

    fn short_limits() -> TransportLimits {
        TransportLimits {
            max_request_bytes: DEFAULT_LIMITS.max_request_bytes,
            max_stdout_bytes: 4096,
            max_stderr_bytes: 4096,
            max_response_bytes: DEFAULT_LIMITS.max_response_bytes,
            execution_duration: Duration::from_millis(500),
            cancellation_grace: Duration::from_millis(100),
        }
    }

    fn run_fixture(
        behavior: &'static str,
        cancellation: CancellationToken,
        limits: TransportLimits,
        root: &Path,
    ) -> Result<Value, TransportError> {
        let request = std::fs::read(fixture_path("colorbond.request.json")).unwrap();
        run_bom_with(
            &FixtureFactory::new(behavior),
            &request,
            cancellation,
            limits,
            root,
        )
    }

    fn run_tree_fixture(
        behavior: &'static str,
        marker: &Path,
        cancellation: CancellationToken,
        limits: TransportLimits,
        root: &Path,
    ) -> Result<Value, TransportError> {
        let request = std::fs::read(fixture_path("colorbond.request.json")).unwrap();
        run_bom_with(
            &FixtureFactory::with_marker(behavior, marker.to_path_buf()),
            &request,
            cancellation,
            limits,
            root,
        )
    }

    fn assert_root_empty(root: &Path) {
        assert_eq!(std::fs::read_dir(root).unwrap().count(), 0);
    }

    fn assert_descendant_marker_stopped(marker: &Path) {
        assert!(marker.exists(), "descendant fixture created its marker");
        thread::sleep(Duration::from_millis(50));
        let before = std::fs::metadata(marker).unwrap().len();
        assert!(before > 0, "descendant fixture wrote its marker");
        thread::sleep(Duration::from_millis(150));
        let after = std::fs::metadata(marker).unwrap().len();
        assert_eq!(before, after, "descendant continued after tree termination");
        std::fs::remove_file(marker).unwrap();
    }

    fn capture_fixture_stdout(
        factory: &FixtureFactory,
        invocation: &Invocation,
        request: &[u8],
    ) -> Vec<u8> {
        let mut command = factory.command(invocation).unwrap();
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = command.spawn().unwrap();
        let mut stdin = child.stdin.take().unwrap();
        stdin.write_all(request).unwrap();
        drop(stdin);
        let output = child.wait_with_output().unwrap();
        assert!(output.status.success());
        output.stdout
    }

    /// Harmless child fixture. It is an ignored test and is reachable only via
    /// the injected `FixtureFactory`; it never resolves a production runner.
    #[test]
    #[ignore]
    #[allow(clippy::zombie_processes)] // The containment owner kills this fixture's full tree.
    fn transport_fixture_process() {
        if std::env::var_os("XRAY_TEST_FIXTURE").is_none() {
            return;
        }
        let behavior = std::env::var("XRAY_TEST_BEHAVIOR").unwrap();
        let result = PathBuf::from(std::env::var_os("XRAY_TEST_RESULT").unwrap());
        let response_path = PathBuf::from(std::env::var_os("XRAY_TEST_RESPONSE").unwrap());
        if behavior == "stdin-closes" {
            return;
        }
        if behavior == "stdin-never-reads" {
            loop {
                thread::sleep(Duration::from_secs(1));
            }
        }
        let mut request = Vec::new();
        std::io::stdin().read_to_end(&mut request).unwrap();
        if !behavior.starts_with("status-") && behavior != "descendant-marker" {
            assert!(!request.is_empty());
        }
        match behavior.as_str() {
            "status-ok" => print!(
                "{{\"requestSchema\":\"{REQUEST_SCHEMA}\",\"responseSchema\":\"{RESPONSE_SCHEMA}\",\"ruleset\":\"{RULESET_ID}\"}}"
            ),
            "status-over" => {
                std::io::stdout().write_all(&vec![b'x'; 8192]).unwrap();
            }
            "ok" => {
                std::fs::copy(response_path, result).unwrap();
            }
            "wrong-schema" => {
                let mut response: Value =
                    serde_json::from_slice(&std::fs::read(response_path).unwrap()).unwrap();
                response["schema"] = Value::String("xray.bom/v2".into());
                std::fs::write(result, serde_json::to_vec(&response).unwrap()).unwrap();
            }
            "response-at-limit" => {
                let mut response = std::fs::read(response_path).unwrap();
                assert!(response.len() < 8192);
                response.resize(8192, b' ');
                std::fs::write(result, response).unwrap();
            }
            "empty" => {}
            "malformed" => std::fs::write(result, b"{\"schema\":").unwrap(),
            "wrong-request" => {
                let mut response: Value =
                    serde_json::from_slice(&std::fs::read(response_path).unwrap()).unwrap();
                response["requestId"] = Value::String("different-request".into());
                std::fs::write(result, serde_json::to_vec(&response).unwrap()).unwrap();
            }
            "oversize-response" => std::fs::write(result, vec![b'x'; 8192]).unwrap(),
            "stdout-over" => {
                std::io::stdout().write_all(&vec![b'x'; 8192]).unwrap();
                std::io::stdout().flush().unwrap();
                loop {
                    thread::sleep(Duration::from_secs(1));
                }
            }
            "stdout-sized" => {
                let count = std::env::var("XRAY_TEST_STDOUT_BYTES")
                    .unwrap()
                    .parse::<usize>()
                    .unwrap();
                std::io::stdout().write_all(&vec![b'x'; count]).unwrap();
                std::io::stdout().flush().unwrap();
                std::fs::copy(response_path, result).unwrap();
            }
            "stderr-over" => {
                std::io::stderr().write_all(&vec![b'x'; 8192]).unwrap();
                std::io::stderr().flush().unwrap();
                loop {
                    thread::sleep(Duration::from_secs(1));
                }
            }
            "stderr-at-limit" => {
                std::io::stderr().write_all(&vec![b'x'; 4096]).unwrap();
                std::io::stderr().flush().unwrap();
                std::fs::copy(response_path, result).unwrap();
            }
            "never" => loop {
                thread::sleep(Duration::from_secs(1));
            },
            "tree-timeout" | "tree-cancel" | "tree-stdout-over" | "status-tree-timeout" => {
                let marker = PathBuf::from(std::env::var_os("XRAY_TEST_MARKER").unwrap());
                let mut descendant = Command::new(std::env::current_exe().unwrap());
                descendant
                    .args([
                        "--exact",
                        "tests::transport_fixture_process",
                        "--ignored",
                        "--nocapture",
                    ])
                    .env("XRAY_TEST_FIXTURE", "1")
                    .env("XRAY_TEST_BEHAVIOR", "descendant-marker")
                    .env("XRAY_TEST_RESULT", &result)
                    .env("XRAY_TEST_RESPONSE", &response_path)
                    .env("XRAY_TEST_MARKER", &marker)
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                let _descendant = descendant.spawn().unwrap();
                let deadline = Instant::now() + Duration::from_secs(2);
                while !marker.exists() {
                    assert!(Instant::now() < deadline, "descendant marker started");
                    thread::sleep(Duration::from_millis(2));
                }
                if behavior == "tree-stdout-over" {
                    std::io::stdout().write_all(&vec![b'x'; 8192]).unwrap();
                    std::io::stdout().flush().unwrap();
                }
                loop {
                    thread::sleep(Duration::from_secs(1));
                }
            }
            "descendant-marker" => {
                let marker = PathBuf::from(std::env::var_os("XRAY_TEST_MARKER").unwrap());
                loop {
                    OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&marker)
                        .and_then(|mut file| file.write_all(b"x"))
                        .unwrap();
                    thread::sleep(Duration::from_millis(10));
                }
            }
            "nonzero" => panic!("deliberate harmless fixture failure"),
            other => panic!("unknown fixture behavior: {other}"),
        }
    }
    #[test]
    fn transport_br_001_request_version_is_exact_and_br_002_unknown_fields_are_rejected() {
        let mut r = fixture("colorbond.request.json");
        assert!(validate_contract(&r, "request").is_ok());
        r["schema"] = Value::String("xray.job-to-bom/v2".into());
        assert_eq!(
            validate_contract(&r, "request"),
            Err("unsupported contract".into())
        );
        r["schema"] = Value::String(REQUEST_SCHEMA.into());
        r["job"]["surprise"] = Value::Bool(true);
        assert!(validate_contract(&r, "request")
            .unwrap_err()
            .contains("unknown"));
    }

    #[test]
    fn transport_br_001_contract_rejects_malformed_or_impossible_date_times() {
        for bad in [
            "2026-02-29T00:00:00Z",
            "2024-13-01T00:00:00Z",
            "2024-01-01T24:00:00Z",
            "2024-01-01T00:00:61Z",
            "2024-01-01 00:00:00Z",
            "2024-01-01T00:00:00",
            "2024-01-01T00:00:00+24:00",
        ] {
            let mut request = fixture("colorbond.request.json");
            request["runs"][0]["approval"]["decidedAt"] = Value::String(bad.into());
            assert!(
                validate_contract(&request, "request")
                    .unwrap_err()
                    .contains("date-time"),
                "accepted invalid date-time {bad}"
            );
        }
        for good in [
            "2024-02-29T23:59:60Z",
            "2026-09-04T00:00:00.000Z",
            "2026-09-04T10:15:30+10:00",
        ] {
            let mut request = fixture("colorbond.request.json");
            request["runs"][0]["approval"]["decidedAt"] = Value::String(good.into());
            assert!(
                validate_contract(&request, "request").is_ok(),
                "rejected {good}"
            );
        }
    }
    #[test]
    fn transport_br_003_response_rejects_unknown_fields_and_br_033_forbidden_fields() {
        let mut r = fixture("colorbond.response.json");
        assert!(validate_contract(&r, "success").is_ok());
        r["bom"]["tax"] = Value::String("10".into());
        assert!(validate_contract(&r, "success")
            .unwrap_err()
            .contains("unknown"));
    }

    #[test]
    fn transport_br_032_valid_domain_error_remains_a_bom_response() {
        let request = fixture("colorbond.request.json");
        let binding = binding_from_request(&request).unwrap();
        let mut response = fixture("blocked-overlap.response.json");
        response["requestId"] = Value::String(binding.request_id.clone());
        assert_eq!(
            validate_binding(&response, &binding).unwrap_err().code,
            TransportCode::InputDigestMismatch,
            "a post-validation engine error must remain exactly input-bound"
        );
        response["inputDigest"] = Value::String(binding.input_digest.clone());
        validate_contract(&response, "error").unwrap();
        validate_binding(&response, &binding).unwrap();
        assert_eq!(response["issues"][0]["code"], "gate-overlap");
    }
    #[test]
    fn transport_br_004_input_digest_verified_before_spawn() {
        let r = fixture("colorbond.request.json");
        let b = binding_from_request(&r).unwrap();
        assert_eq!(sha256_hex(canonical_input(&r).as_bytes()), b.input_digest);
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn transport_br_023_source_bytes_are_rehashed_before_runner_selection() {
        let selected = b"<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>";
        let expected = sha256_hex(selected);
        let runner_calls = AtomicUsize::new(0);

        verify_source_sha256(selected, &expected).expect("selected bytes match");
        let changed = b"<svg xmlns=\"http://www.w3.org/2000/svg\"><path/></svg>";
        let error = verify_source_sha256(changed, &expected)
            .map(|()| {
                runner_calls.fetch_add(1, Ordering::SeqCst);
            })
            .expect_err("changed source must fail before runner selection");
        assert_eq!(error.code, TransportCode::SourceBindingMismatch);
        assert_eq!(error.stage, TransportStage::Bind);
        assert_eq!(runner_calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn transport_br_004_and_008_invalid_or_oversize_request_never_spawns() {
        let original = std::fs::read(fixture_path("colorbond.request.json")).unwrap();
        let factory = FixtureFactory::new("ok");
        let mut changed: Value = serde_json::from_slice(&original).unwrap();
        changed["job"]["revision"] = Value::from(13);
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let err = run_bom_with(
            &factory,
            &serde_json::to_vec(&changed).unwrap(),
            CancellationToken::default(),
            short_limits(),
            &root,
        )
        .unwrap_err();
        assert_eq!(err.code, TransportCode::InputDigestMismatch);
        assert_eq!(factory.spawned.load(Ordering::SeqCst), 0);
        let result = run_bom_with(
            &factory,
            &original,
            CancellationToken::default(),
            short_limits(),
            &root,
        )
        .unwrap();
        assert_eq!(result["requestId"], "golden-colorbond");
        assert_eq!(factory.spawned.load(Ordering::SeqCst), 1);
        assert_root_empty(&root);

        let mut limits = short_limits();
        limits.max_request_bytes = original.len() - 1;
        let err = run_bom_with(
            &factory,
            &original,
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap_err();
        assert_eq!(err.code, TransportCode::InvalidRequest);
        assert_eq!(factory.spawned.load(Ordering::SeqCst), 1);
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }
    #[test]
    fn transport_br_005_006_007_identity_and_source_binding_exact() {
        let req = fixture("colorbond.request.json");
        let b = binding_from_request(&req).unwrap();
        let res = fixture("colorbond.response.json");
        validate_binding(&res, &b).unwrap();
        let mut w = res.clone();
        w["requestId"] = Value::String("other".into());
        assert_eq!(
            validate_binding(&w, &b).unwrap_err().code,
            TransportCode::RequestIdMismatch
        );
        w = res.clone();
        w["bom"]["inputDigest"] = Value::String("0".repeat(64));
        assert_eq!(
            validate_binding(&w, &b).unwrap_err().code,
            TransportCode::InputDigestMismatch
        );
        w = res;
        w["bom"]["recipeSet"]["revision"] = Value::from(99);
        assert_eq!(
            validate_binding(&w, &b).unwrap_err().code,
            TransportCode::SourceBindingMismatch
        );
        let mut wrong_version = fixture("colorbond.response.json");
        wrong_version["bom"]["ruleset"]["version"] = Value::from(2);
        assert_eq!(
            validate_binding(&wrong_version, &b).unwrap_err().code,
            TransportCode::SourceBindingMismatch
        );
    }
    #[test]
    fn transport_br_008_009_010_bounded_stream_boundaries() {
        for limit in [0usize, 1, 64] {
            let exact = vec![b'x'; limit];
            let (h, o) = bounded_reader(Cursor::new(exact.clone()), limit);
            assert_eq!(h.join().unwrap(), exact);
            assert!(!o.load(Ordering::Acquire));
            let (h, o) = bounded_reader(Cursor::new(vec![b'x'; limit + 1]), limit);
            assert_eq!(h.join().unwrap().len(), limit);
            assert!(o.load(Ordering::Acquire));
        }
    }

    #[test]
    fn transport_br_008_slow_stdin_honours_cancellation_and_cleans_scratch() {
        let mut request = fixture("colorbond.request.json");
        let run = request["runs"][0].clone();
        request["runs"] = Value::Array(vec![run; 450]);
        request["inputDigest"] = Value::String(sha256_hex(canonical_input(&request).as_bytes()));
        let encoded = serde_json::to_vec(&request).unwrap();
        assert!(encoded.len() > 128 * 1024);
        assert!(encoded.len() < DEFAULT_LIMITS.max_request_bytes);
        validate_contract(&request, "request").unwrap();

        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let cancellation = CancellationToken::default();
        let trigger = cancellation.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(50));
            trigger.cancel();
        });
        let started = Instant::now();
        let error = run_bom_with(
            &FixtureFactory::new("stdin-never-reads"),
            &encoded,
            cancellation,
            short_limits(),
            &root,
        )
        .unwrap_err();
        assert_eq!(error.code, TransportCode::Cancelled);
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_008_slow_stdin_honours_deadline_and_cleans_scratch() {
        let mut request = fixture("colorbond.request.json");
        let run = request["runs"][0].clone();
        request["runs"] = Value::Array(vec![run; 450]);
        request["inputDigest"] = Value::String(sha256_hex(canonical_input(&request).as_bytes()));
        let encoded = serde_json::to_vec(&request).unwrap();
        assert!(encoded.len() > 128 * 1024);
        assert!(encoded.len() < DEFAULT_LIMITS.max_request_bytes);
        validate_contract(&request, "request").unwrap();

        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let mut limits = short_limits();
        limits.execution_duration = Duration::from_millis(50);
        let started = Instant::now();
        let error = run_bom_with(
            &FixtureFactory::new("stdin-never-reads"),
            &encoded,
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap_err();
        assert_eq!(error.code, TransportCode::Timeout);
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_009_exact_response_boundary_preserves_valid_response() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let mut limits = short_limits();
        limits.max_response_bytes = 8192;
        let response = run_fixture(
            "response-at-limit",
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap();
        assert_eq!(response["requestId"], "golden-colorbond");
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_009_exact_streamed_stdout_boundary_is_direct() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let request = std::fs::read(fixture_path("colorbond.request.json")).unwrap();
        let calibration_result = root.join("calibration.json");
        let invocation = Invocation {
            scratch_dir: root.clone(),
            result_path: calibration_result.clone(),
        };
        let harness_bytes =
            capture_fixture_stdout(&FixtureFactory::with_stdout_bytes(0), &invocation, &request)
                .len();
        std::fs::remove_file(&calibration_result).unwrap();

        let limits = short_limits();
        assert!(harness_bytes < limits.max_stdout_bytes);
        let fixture_bytes = limits.max_stdout_bytes - harness_bytes;
        let exact_stream = capture_fixture_stdout(
            &FixtureFactory::with_stdout_bytes(fixture_bytes),
            &invocation,
            &request,
        );
        assert_eq!(exact_stream.len(), limits.max_stdout_bytes);
        std::fs::remove_file(&calibration_result).unwrap();

        let response = run_bom_with(
            &FixtureFactory::with_stdout_bytes(fixture_bytes),
            &request,
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap();
        assert_eq!(response["requestId"], "golden-colorbond");
        assert_root_empty(&root);

        let error = run_bom_with(
            &FixtureFactory::with_stdout_bytes(fixture_bytes + 1),
            &request,
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap_err();
        assert_eq!(error.code, TransportCode::StdoutLimit);
        assert_root_empty(&root);
        println!(
            "SC07G_BR009_STREAMED_STDOUT_BOUNDARY harness_bytes={harness_bytes} fixture_bytes={fixture_bytes} exact_total={} boundary_plus_one={} outcomes=accepted,stdout-limit",
            limits.max_stdout_bytes,
            limits.max_stdout_bytes + 1,
        );
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_009_010_process_output_overflow_is_typed_and_cleaned() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let stdout = run_fixture(
            "stdout-over",
            CancellationToken::default(),
            short_limits(),
            &root,
        )
        .unwrap_err();
        assert_eq!(stdout.code, TransportCode::StdoutLimit);
        assert_root_empty(&root);
        let stderr = run_fixture(
            "stderr-over",
            CancellationToken::default(),
            short_limits(),
            &root,
        )
        .unwrap_err();
        assert_eq!(stderr.code, TransportCode::StderrLimit);
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_010_stderr_at_exact_limit_preserves_valid_result() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let limits = short_limits();
        assert_eq!(limits.max_stderr_bytes, 4096);

        let response = run_fixture(
            "stderr-at-limit",
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap();

        assert_eq!(response["schema"], RESPONSE_SCHEMA);
        assert_eq!(response["requestId"], "golden-colorbond");
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_011_timeout_terminates_process_and_cleans_scratch() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let started = Instant::now();
        let err =
            run_fixture("never", CancellationToken::default(), short_limits(), &root).unwrap_err();
        assert_eq!(err.code, TransportCode::Timeout);
        assert!(started.elapsed() < Duration::from_secs(2));
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_012_cancellation_is_distinct_and_cleans_scratch() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let cancellation = CancellationToken::default();
        let trigger = cancellation.clone();
        thread::spawn(move || {
            thread::sleep(Duration::from_millis(50));
            trigger.cancel();
        });
        let err = run_fixture("never", cancellation, short_limits(), &root).unwrap_err();
        assert_eq!(err.code, TransportCode::Cancelled);
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_013_timeout_cancel_and_overflow_terminate_descendants() {
        for behavior in ["tree-timeout", "tree-cancel", "tree-stdout-over"] {
            let root = std::env::temp_dir().join(next_diagnostic_id());
            std::fs::create_dir(&root).unwrap();
            let marker = root.with_extension(format!("{behavior}.marker"));
            let cancellation = CancellationToken::default();
            let cancel_monitor = if behavior == "tree-cancel" {
                let watched_marker = marker.clone();
                let trigger = cancellation.clone();
                Some(thread::spawn(move || {
                    let deadline = Instant::now() + Duration::from_secs(2);
                    while !watched_marker.exists() {
                        assert!(Instant::now() < deadline, "descendant marker started");
                        thread::sleep(Duration::from_millis(2));
                    }
                    trigger.cancel();
                }))
            } else {
                None
            };
            let error = run_tree_fixture(behavior, &marker, cancellation, short_limits(), &root)
                .unwrap_err();
            if let Some(monitor) = cancel_monitor {
                monitor.join().unwrap();
            }
            let expected = match behavior {
                "tree-timeout" => TransportCode::Timeout,
                "tree-cancel" => TransportCode::Cancelled,
                "tree-stdout-over" => TransportCode::StdoutLimit,
                _ => unreachable!(),
            };
            assert_eq!(error.code, expected, "behavior {behavior}");
            assert_descendant_marker_stopped(&marker);
            assert_root_empty(&root);
            std::fs::remove_dir(root).unwrap();
        }
    }

    #[cfg(unix)]
    #[test]
    fn transport_br_013_unix_process_group_kills_descendants_on_timeout_and_cancel() {
        for behavior in ["tree-timeout", "tree-cancel"] {
            let root = std::env::temp_dir().join(next_diagnostic_id());
            std::fs::create_dir(&root).unwrap();
            let marker = root.with_extension(format!("unix-{behavior}.marker"));
            let cancellation = CancellationToken::default();
            let cancel_monitor = if behavior == "tree-cancel" {
                let watched_marker = marker.clone();
                let trigger = cancellation.clone();
                Some(thread::spawn(move || {
                    let deadline = Instant::now() + Duration::from_secs(2);
                    while !watched_marker.exists() {
                        assert!(Instant::now() < deadline, "descendant marker started");
                        thread::sleep(Duration::from_millis(2));
                    }
                    trigger.cancel();
                }))
            } else {
                None
            };
            let error = run_tree_fixture(behavior, &marker, cancellation, short_limits(), &root)
                .unwrap_err();
            if let Some(monitor) = cancel_monitor {
                monitor.join().unwrap();
            }
            let expected = if behavior == "tree-timeout" {
                TransportCode::Timeout
            } else {
                TransportCode::Cancelled
            };
            assert_eq!(error.code, expected, "behavior {behavior}");
            assert_descendant_marker_stopped(&marker);
            assert_root_empty(&root);
            std::fs::remove_dir(root).unwrap();
        }
        println!("SC07G_BR013_UNIX_PROCESS_GROUP_EXECUTED platform=unix cases=timeout,cancel");
    }
    #[test]
    fn transport_br_015_errors_are_closed_safe_objects() {
        let v = serde_json::to_value(error(
            TransportCode::NonzeroExit,
            TransportStage::Execute,
            true,
            "The calculation engine stopped before producing a result.",
        ))
        .unwrap();
        assert_eq!(v["code"], "nonzero-exit");
        assert_eq!(v["stage"], "execute");
        assert!(v.get("detail").is_none());
    }
    #[test]
    fn transport_br_017_only_exact_regular_result_identity() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let b = binding_from_request(&fixture("colorbond.request.json")).unwrap();
        let expected = root.join("expected.json");
        std::fs::write(
            root.join("unrelated.json"),
            serde_json::to_vec(&fixture("colorbond.response.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            read_and_validate_result(&expected, &root, &b, DEFAULT_LIMITS.max_response_bytes)
                .unwrap_err()
                .code,
            TransportCode::MissingResult
        );
        std::fs::create_dir(&expected).unwrap();
        assert_eq!(
            read_and_validate_result(&expected, &root, &b, DEFAULT_LIMITS.max_response_bytes)
                .unwrap_err()
                .code,
            TransportCode::UnsafeResult
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn transport_br_016_017_019_result_failures_are_closed_and_cleaned() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        for (behavior, code) in [
            ("empty", TransportCode::MissingResult),
            ("malformed", TransportCode::MalformedResult),
            ("wrong-request", TransportCode::RequestIdMismatch),
            ("wrong-schema", TransportCode::ResponseContract),
            ("nonzero", TransportCode::NonzeroExit),
        ] {
            let err = run_fixture(
                behavior,
                CancellationToken::default(),
                short_limits(),
                &root,
            )
            .unwrap_err();
            assert_eq!(err.code, code, "behavior {behavior}");
            assert_root_empty(&root);
        }
        let mut limits = short_limits();
        limits.max_response_bytes = 1024;
        let err = run_fixture(
            "oversize-response",
            CancellationToken::default(),
            limits,
            &root,
        )
        .unwrap_err();
        assert_eq!(err.code, TransportCode::ResponseLimit);
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_017_result_link_is_rejected_where_platform_supports_links() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let target = root.join("target.json");
        let expected = root.join("expected.json");
        std::fs::write(
            &target,
            serde_json::to_vec(&fixture("colorbond.response.json")).unwrap(),
        )
        .unwrap();
        #[cfg(unix)]
        let link_result = std::os::unix::fs::symlink(&target, &expected);
        #[cfg(windows)]
        let link_result = std::os::windows::fs::symlink_file(&target, &expected);
        #[cfg(not(any(unix, windows)))]
        let link_result: std::io::Result<()> = Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "links unavailable",
        ));
        if link_result.is_ok() {
            let binding = binding_from_request(&fixture("colorbond.request.json")).unwrap();
            let error = read_and_validate_result(
                &expected,
                &root,
                &binding,
                DEFAULT_LIMITS.max_response_bytes,
            )
            .unwrap_err();
            assert_eq!(error.code, TransportCode::UnsafeResult);
        }
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn transport_br_019_spawn_failure_removes_scratch_without_masking_primary_error() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let request = std::fs::read(fixture_path("colorbond.request.json")).unwrap();
        let error = run_bom_with(
            &MissingExecutableFactory,
            &request,
            CancellationToken::default(),
            short_limits(),
            &root,
        )
        .unwrap_err();
        assert_eq!(error.code, TransportCode::SpawnFailed);
        assert_eq!(error.stage, TransportStage::Spawn);
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_019_030_031_success_is_exact_repeatable_and_isolated() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let first = run_fixture("ok", CancellationToken::default(), short_limits(), &root).unwrap();
        assert_root_empty(&root);
        let second =
            run_fixture("ok", CancellationToken::default(), short_limits(), &root).unwrap();
        assert_eq!(first, second);
        assert_root_empty(&root);
        std::fs::remove_dir(root).unwrap();
    }
    #[test]
    fn transport_br_018_019_scratch_permissions_identity_and_guard_cleanup() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let first;
        let second;
        {
            let first_guard = create_scratch(&root).unwrap();
            let second_guard = create_scratch(&root).unwrap();
            first = first_guard.0.clone();
            second = second_guard.0.clone();
            assert_eq!(first.parent(), Some(root.as_path()));
            assert_eq!(second.parent(), Some(root.as_path()));
            assert_ne!(first, second);
            for scratch in [&first, &second] {
                let identity = scratch.file_name().unwrap().to_string_lossy();
                let mut parts = identity.split('-');
                assert_eq!(parts.next(), Some("xray"));
                let time = parts.next().unwrap();
                let serial = parts.next().unwrap();
                assert!(parts.next().is_none());
                assert_eq!(time.len(), 32);
                assert_eq!(serial.len(), 16);
                assert!(time.bytes().all(|byte| byte.is_ascii_hexdigit()));
                assert!(serial.bytes().all(|byte| byte.is_ascii_hexdigit()));
                let metadata = std::fs::symlink_metadata(scratch).unwrap();
                assert!(metadata.is_dir());
                assert!(!metadata.file_type().is_symlink());
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    assert_eq!(metadata.permissions().mode() & 0o777, 0o700);
                }
                #[cfg(windows)]
                {
                    // Rust's portable metadata API cannot inspect the inherited
                    // Windows DACL. Assert only the directly observable owned-
                    // scope invariants here; a platform-gated ACL test remains
                    // necessary before BR-018 is unconditional on Windows.
                    assert!(!metadata.permissions().readonly());
                    let canonical_root = root.canonicalize().unwrap();
                    assert_eq!(
                        scratch.canonicalize().unwrap().parent(),
                        Some(canonical_root.as_path())
                    );
                }
            }
            std::fs::write(first.join("artifact"), b"proof").unwrap();
            std::fs::write(second.join("artifact"), b"proof").unwrap();
        }
        assert!(!first.exists());
        assert!(!second.exists());
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn transport_br_015_019_terminal_path_error_and_cleanup_table() {
        struct TerminalCase {
            name: &'static str,
            behavior: Option<&'static str>,
            expected_code: Option<TransportCode>,
            expected_stage: Option<TransportStage>,
            cancel_after_start: bool,
            response_limit: Option<usize>,
            large_request: bool,
        }

        let cases = [
            TerminalCase {
                name: "success",
                behavior: Some("ok"),
                expected_code: None,
                expected_stage: None,
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "spawn-error",
                behavior: None,
                expected_code: Some(TransportCode::SpawnFailed),
                expected_stage: Some(TransportStage::Spawn),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "write-error",
                behavior: Some("stdin-closes"),
                expected_code: Some(TransportCode::RequestWriteFailed),
                expected_stage: Some(TransportStage::Write),
                cancel_after_start: false,
                response_limit: None,
                large_request: true,
            },
            TerminalCase {
                name: "nonzero-exit",
                behavior: Some("nonzero"),
                expected_code: Some(TransportCode::NonzeroExit),
                expected_stage: Some(TransportStage::Execute),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "timeout",
                behavior: Some("never"),
                expected_code: Some(TransportCode::Timeout),
                expected_stage: Some(TransportStage::Execute),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "cancel",
                behavior: Some("never"),
                expected_code: Some(TransportCode::Cancelled),
                expected_stage: Some(TransportStage::Execute),
                cancel_after_start: true,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "stdout-size",
                behavior: Some("stdout-over"),
                expected_code: Some(TransportCode::StdoutLimit),
                expected_stage: Some(TransportStage::Read),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "stderr-size",
                behavior: Some("stderr-over"),
                expected_code: Some(TransportCode::StderrLimit),
                expected_stage: Some(TransportStage::Read),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "response-size",
                behavior: Some("oversize-response"),
                expected_code: Some(TransportCode::ResponseLimit),
                expected_stage: Some(TransportStage::Read),
                cancel_after_start: false,
                response_limit: Some(1024),
                large_request: false,
            },
            TerminalCase {
                name: "parse",
                behavior: Some("malformed"),
                expected_code: Some(TransportCode::MalformedResult),
                expected_stage: Some(TransportStage::Parse),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "contract",
                behavior: Some("wrong-schema"),
                expected_code: Some(TransportCode::ResponseContract),
                expected_stage: Some(TransportStage::Validate),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
            TerminalCase {
                name: "binding",
                behavior: Some("wrong-request"),
                expected_code: Some(TransportCode::RequestIdMismatch),
                expected_stage: Some(TransportStage::Bind),
                cancel_after_start: false,
                response_limit: None,
                large_request: false,
            },
        ];
        let request = std::fs::read(fixture_path("colorbond.request.json")).unwrap();
        let mut large_request_value: Value = serde_json::from_slice(&request).unwrap();
        let run = large_request_value["runs"][0].clone();
        large_request_value["runs"] = Value::Array(vec![run; 450]);
        large_request_value["inputDigest"] =
            Value::String(sha256_hex(canonical_input(&large_request_value).as_bytes()));
        let large_request = serde_json::to_vec(&large_request_value).unwrap();
        assert!(large_request.len() > 128 * 1024);

        for case in cases {
            let root = std::env::temp_dir().join(next_diagnostic_id());
            std::fs::create_dir(&root).unwrap();
            let cancellation = CancellationToken::default();
            let cancel_thread = case.cancel_after_start.then(|| {
                let trigger = cancellation.clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(25));
                    trigger.cancel();
                })
            });
            let mut limits = short_limits();
            limits.execution_duration = Duration::from_millis(100);
            if let Some(limit) = case.response_limit {
                limits.max_response_bytes = limit;
            }
            let request_bytes = if case.large_request {
                large_request.as_slice()
            } else {
                request.as_slice()
            };

            let outcome = match case.behavior {
                Some(behavior) => run_bom_with(
                    &FixtureFactory::new(behavior),
                    request_bytes,
                    cancellation,
                    limits,
                    &root,
                ),
                None => run_bom_with(
                    &MissingExecutableFactory,
                    request_bytes,
                    cancellation,
                    limits,
                    &root,
                ),
            };
            if let Some(handle) = cancel_thread {
                handle.join().unwrap();
            }

            match (case.expected_code, case.expected_stage) {
                (None, None) => {
                    let response = outcome.unwrap_or_else(|error| {
                        panic!("{} unexpectedly failed: {error:?}", case.name)
                    });
                    assert_eq!(response["schema"], RESPONSE_SCHEMA, "{}", case.name);
                }
                (Some(code), Some(stage)) => {
                    let error = match outcome {
                        Err(error) => error,
                        Ok(_) => panic!("{} unexpectedly succeeded", case.name),
                    };
                    assert_eq!(error.code, code, "{} code", case.name);
                    assert_eq!(error.stage, stage, "{} stage", case.name);
                    assert!(error.safe_message.len() <= 80, "{} message", case.name);
                    assert!(error.diagnostic_id.is_none(), "{} diagnostic", case.name);
                }
                _ => unreachable!(),
            }
            assert_root_empty(&root);
            std::fs::remove_dir(root).unwrap();
        }
    }
    #[test]
    fn transport_br_020_diagnostics_bounded_and_controls_removed() {
        let raw = [
            b"C:\\secret\\plan.pdf\ntraceback\0token=secret".as_slice(),
            &vec![b'x'; 5000],
        ]
        .concat();
        let safe = bounded_diagnostic(&[], &raw);
        assert_eq!(safe.len(), 1024);
        assert!(!safe.contains(&0));
    }
    #[test]
    fn transport_br_021_status_truthful_without_config_no_path() {
        if std::env::var_os("XRAY_ENGINE_PATH").is_none() {
            let s = engine_status();
            assert_eq!(s["available"], false);
            assert!(s.get("sidecar").is_none());
            assert!(s.get("pythonSrc").is_none());
        }
    }

    #[test]
    fn transport_br_021_status_probe_is_bounded_and_actually_launches() {
        let compatible = FixtureFactory::new("status-ok");
        let mut command = compatible.status_command().unwrap();
        let output = bounded_status_output(&mut command, Duration::from_secs(10)).unwrap();
        assert!(String::from_utf8_lossy(&output).contains(REQUEST_SCHEMA));
        assert_eq!(compatible.spawned.load(Ordering::SeqCst), 1);

        let overflow = FixtureFactory::new("status-over");
        let mut command = overflow.status_command().unwrap();
        assert!(bounded_status_output(&mut command, Duration::from_secs(10)).is_none());
    }

    struct JsonStatusFactory { delay_ms: u64, fail: bool }
    impl CommandFactory for JsonStatusFactory {
        fn command(&self, _: &Invocation) -> Result<Command, TransportError> { self.status_command() }
        fn status_command(&self) -> Result<Command, TransportError> {
            let payload = format!("{{\"requestSchema\":\"{REQUEST_SCHEMA}\",\"responseSchema\":\"{RESPONSE_SCHEMA}\",\"ruleset\":\"{RULESET_ID}\"}}");
            #[cfg(windows)]
            let mut command = {
                let mut c = Command::new(PathBuf::from(std::env::var_os("SystemRoot").unwrap()).join("System32/WindowsPowerShell/v1.0/powershell.exe"));
                c.creation_flags(0x08000000);
                c.args(["-NoProfile", "-Command", &format!("Start-Sleep -Milliseconds {}; Write-Output '{}'; exit {}", self.delay_ms, payload, if self.fail { 1 } else { 0 })]);
                c
            };
            #[cfg(not(windows))]
            let mut command = {
                let mut c = Command::new("/bin/sh");
                c.args(["-c", &format!("sleep {}; printf '%s' '{}'; exit {}", self.delay_ms as f64 / 1000.0, payload, if self.fail { 1 } else { 0 })]);
                c
            };
            command.stdin(Stdio::null());
            Ok(command)
        }
    }

    #[test]
    fn transport_status_accepts_real_delayed_handshake_beyond_old_two_second_budget() {
        let started = Instant::now();
        let status = engine_status_with(&JsonStatusFactory { delay_ms: 2200, fail: false });
        assert_eq!(status["available"], true);
        assert!(started.elapsed() >= Duration::from_millis(2200));
        assert!(started.elapsed() < Duration::from_secs(10));
    }

    #[test]
    fn transport_status_nonzero_and_short_deadline_never_report_available() {
        assert_eq!(engine_status_with(&JsonStatusFactory { delay_ms: 0, fail: true })["available"], false);
        let started = Instant::now();
        assert_eq!(engine_status_with_timeout(&JsonStatusFactory { delay_ms: 3000, fail: false }, Duration::from_millis(100))["available"], false);
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn transport_status_deadline_terminates_descendant_tree() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let marker = root.join("child.marker");
        let mut factory = FixtureFactory::new("status-tree-timeout");
        factory.marker = Some(marker.clone());
        assert_eq!(engine_status_with_timeout(&factory, Duration::from_millis(800))["available"], false);
        assert!(marker.exists(), "descendant must actually start before cleanup is asserted");
        let before = std::fs::read(&marker).unwrap();
        thread::sleep(Duration::from_millis(150));
        assert_eq!(std::fs::read(&marker).unwrap(), before, "descendant stopped writing after deadline");
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn transport_br_034_035_paths_and_python_fallback_disabled() {
        let e = run_takeoff("C:\\private\\plan.pdf").unwrap_err();
        assert!(!e.0.contains("C:\\private"));
        assert!(resolve_engine_path().is_none() || std::env::var_os("XRAY_ENGINE_PATH").is_some());
    }

    #[test]
    fn transport_br_034_child_arguments_expose_only_owned_transport_handles() {
        let root = std::env::temp_dir().join(next_diagnostic_id());
        std::fs::create_dir(&root).unwrap();
        let executable = root.join(if cfg!(windows) {
            "owned-engine.exe"
        } else {
            "owned-engine"
        });
        std::fs::write(&executable, b"not executed").unwrap();
        let scratch = root.join("host-owned-scratch");
        std::fs::create_dir(&scratch).unwrap();
        let result_path = scratch.join("result-host-owned.json");
        let runner = ConfiguredRunner::new(executable.clone()).unwrap();
        let command = runner
            .command(&Invocation {
                scratch_dir: scratch.clone(),
                result_path: result_path.clone(),
            })
            .unwrap();
        let arguments: Vec<_> = command.get_args().map(|arg| arg.to_os_string()).collect();

        assert_eq!(command.get_program(), executable.as_os_str());
        assert_eq!(
            arguments,
            vec![
                std::ffi::OsString::from("job-to-bom"),
                std::ffi::OsString::from("--request-stdin"),
                std::ffi::OsString::from("--result"),
                result_path.as_os_str().to_os_string(),
            ]
        );
        assert_eq!(result_path.parent(), Some(scratch.as_path()));
        assert!(arguments.iter().all(|argument| {
            let text = argument.to_string_lossy();
            !text.contains("plan.pdf") && !text.contains("document.dxf")
        }));
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn transport_limits_are_frozen_and_printed() {
        println!(
            "SC07G_LIMITS request={} stdout={} stderr={} response={} duration_ms={} grace_ms={}",
            DEFAULT_LIMITS.max_request_bytes,
            DEFAULT_LIMITS.max_stdout_bytes,
            DEFAULT_LIMITS.max_stderr_bytes,
            DEFAULT_LIMITS.max_response_bytes,
            DEFAULT_LIMITS.execution_duration.as_millis(),
            DEFAULT_LIMITS.cancellation_grace.as_millis()
        );
        assert_eq!(
            serde_json::to_value(DEFAULT_LIMITS).unwrap()["maxRequestBytes"],
            1_048_576
        );
        assert_eq!(DEFAULT_LIMITS.max_response_bytes, 4_194_304);
        assert_eq!(DEFAULT_LIMITS.max_stdout_bytes, 65_536);
        assert_eq!(DEFAULT_LIMITS.max_stderr_bytes, 65_536);
        assert_eq!(
            DEFAULT_LIMITS.execution_duration,
            Duration::from_millis(30_000)
        );
        assert_eq!(
            DEFAULT_LIMITS.cancellation_grace,
            Duration::from_millis(2_000)
        );
    }
}
