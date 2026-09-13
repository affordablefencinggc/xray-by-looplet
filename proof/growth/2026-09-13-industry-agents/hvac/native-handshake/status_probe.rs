fn main() {
    for index in 0..5 {
        let started = std::time::Instant::now();
        let status = xray_engine_host::engine_status();
        println!("{}", serde_json::json!({"index":index,"elapsedMs":started.elapsed().as_millis(),"status":status}));
    }
}
