//! Standalone compiled binary for xray-engine.
//! Executes takeoff commands, health checks, or delegates to python engine.

use std::env;
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 || args[1] == "--help" || args[1] == "-h" {
        println!("xray-engine 0.1.0 — High-performance vector takeoff sidecar");
        println!("Usage: xray-engine run <PDF_PATH> [OPTIONS]");
        println!("       xray-engine --version");
        println!("       xray-engine status");
        return;
    }

    if args[1] == "--version" || args[1] == "-V" {
        println!("xray-engine 0.1.0");
        return;
    }

    if args[1] == "status" {
        println!("{}", xray_engine_host::engine_status());
        return;
    }

    if args[1] == "run" {
        if args.len() < 3 {
            eprintln!("Error: missing plan path for 'run' command");
            process::exit(1);
        }
        let pdf = &args[2];
        match xray_engine_host::run_takeoff(pdf) {
            Ok(json) => println!("{}", json),
            Err(e) => {
                eprintln!("Takeoff error: {}", e);
                process::exit(1);
            }
        }
        return;
    }

    eprintln!("Unknown command: {}", args[1]);
    process::exit(1);
}
