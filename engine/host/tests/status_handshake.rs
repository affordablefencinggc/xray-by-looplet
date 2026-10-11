//! Test-only raw-JSON child dispatch, before any libtest stdout decoration.
//! Every spawned child is this compiled integration executable; no shell/runtime lookup.
use std::{
    io::Write,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
use xray_engine_host::{
    engine_status_with, CommandFactory, Invocation, TransportError, REQUEST_SCHEMA,
    RESPONSE_SCHEMA, RULESET_ID,
};

struct StatusFixture {
    delay_ms: u64,
    exit_code: i32,
    payload: String,
}

impl StatusFixture {
    fn compatible(delay_ms: u64, exit_code: i32) -> Self {
        Self {
            delay_ms,
            exit_code,
            payload: serde_json::json!({
                "requestSchema": REQUEST_SCHEMA,
                "responseSchema": RESPONSE_SCHEMA,
                "ruleset": RULESET_ID,
            })
            .to_string(),
        }
    }
}

impl CommandFactory for StatusFixture {
    fn command(&self, _: &Invocation) -> Result<Command, TransportError> {
        self.status_command()
    }

    fn status_command(&self) -> Result<Command, TransportError> {
        let mut command = Command::new(std::env::current_exe().unwrap());
        command
            .arg("--status-fixture")
            .env("XRAY_STATUS_FIXTURE_DELAY_MS", self.delay_ms.to_string())
            .env("XRAY_STATUS_FIXTURE_EXIT_CODE", self.exit_code.to_string())
            .env("XRAY_STATUS_FIXTURE_PAYLOAD", &self.payload)
            .stdin(Stdio::null());
        Ok(command)
    }
}

fn transport_status_raw_delayed_handshake_reports_available() {
    let started = Instant::now();
    let status = engine_status_with(&StatusFixture::compatible(2200, 0));
    assert_eq!(status["available"], true);
    assert_eq!(status["contract"], REQUEST_SCHEMA);
    assert_eq!(status["responseContract"], RESPONSE_SCHEMA);
    assert_eq!(status["ruleset"], RULESET_ID);
    assert!(started.elapsed() >= Duration::from_millis(2200));
    assert!(started.elapsed() < Duration::from_secs(10));
}

fn transport_status_raw_nonzero_valid_json_reports_unavailable() {
    let status = engine_status_with(&StatusFixture::compatible(0, 7));
    assert_eq!(status["available"], false);
}

fn transport_status_raw_rejects_each_missing_wrong_or_mistyped_contract_field() {
    let baseline: serde_json::Value =
        serde_json::from_str(&StatusFixture::compatible(0, 0).payload).unwrap();
    for field in ["requestSchema", "responseSchema", "ruleset"] {
        for replacement in [
            None,
            Some(serde_json::json!("wrong")),
            Some(serde_json::json!(1)),
        ] {
            let mut invalid = baseline.clone();
            if let Some(value) = replacement {
                invalid[field] = value;
            } else {
                invalid.as_object_mut().unwrap().remove(field);
            }
            let fixture = StatusFixture {
                delay_ms: 0,
                exit_code: 0,
                payload: invalid.to_string(),
            };
            assert_eq!(engine_status_with(&fixture)["available"], false, "{field}");
        }
    }
}

fn transport_status_raw_rejects_noise_truncation_and_overflow() {
    let valid = StatusFixture::compatible(0, 0).payload;
    for payload in [
        String::new(),
        "{".into(),
        format!("running 1 test\n{valid}"),
        format!("{valid}\ntest result: ok."),
        format!("{valid}{valid}"),
        "x".repeat(8192),
    ] {
        let fixture = StatusFixture {
            delay_ms: 0,
            exit_code: 0,
            payload,
        };
        assert_eq!(engine_status_with(&fixture)["available"], false);
    }
}

fn fixture_main() -> ! {
    let delay_ms = std::env::var("XRAY_STATUS_FIXTURE_DELAY_MS")
        .unwrap()
        .parse::<u64>()
        .unwrap();
    let exit_code = std::env::var("XRAY_STATUS_FIXTURE_EXIT_CODE")
        .unwrap()
        .parse::<i32>()
        .unwrap();
    let payload = std::env::var("XRAY_STATUS_FIXTURE_PAYLOAD").unwrap();
    thread::sleep(Duration::from_millis(delay_ms));
    let mut stdout = std::io::stdout().lock();
    stdout.write_all(payload.as_bytes()).unwrap();
    stdout.flush().unwrap();
    std::process::exit(exit_code);
}

fn main() {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.iter().any(|arg| arg == "--status-fixture") {
        fixture_main();
    }
    let tests: [(&str, fn()); 4] = [
        (
            "transport_status_raw_delayed_handshake_reports_available",
            transport_status_raw_delayed_handshake_reports_available,
        ),
        (
            "transport_status_raw_nonzero_valid_json_reports_unavailable",
            transport_status_raw_nonzero_valid_json_reports_unavailable,
        ),
        (
            "transport_status_raw_rejects_each_missing_wrong_or_mistyped_contract_field",
            transport_status_raw_rejects_each_missing_wrong_or_mistyped_contract_field,
        ),
        (
            "transport_status_raw_rejects_noise_truncation_and_overflow",
            transport_status_raw_rejects_noise_truncation_and_overflow,
        ),
    ];
    let filters: Vec<_> = args.iter().filter(|arg| !arg.starts_with('-')).collect();
    let exact = args.iter().any(|arg| arg == "--exact");
    let selected: Vec<_> = tests
        .into_iter()
        .filter(|(name, _)| {
            filters.is_empty()
                || filters.iter().any(|filter| {
                    if exact {
                        name == filter
                    } else {
                        name.contains(filter.as_str())
                    }
                })
        })
        .collect();
    if args.iter().any(|arg| arg == "--list") {
        for (name, _) in selected {
            println!("{name}: test");
        }
        return;
    }
    let selected = if args.iter().any(|arg| arg == "--ignored") {
        Vec::new()
    } else {
        selected
    };
    let mut passed = 0;
    let mut failed = 0;
    for (name, test) in selected {
        if std::panic::catch_unwind(test).is_ok() {
            passed += 1;
            println!("test {name} ... ok");
        } else {
            failed += 1;
            println!("test {name} ... FAILED");
        }
    }
    let status = if failed == 0 { "ok" } else { "FAILED" };
    println!("test result: {status}. {passed} passed; {failed} failed; 0 ignored");
    if failed != 0 {
        std::process::exit(1);
    }
}
