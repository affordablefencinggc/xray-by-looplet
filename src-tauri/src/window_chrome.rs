//! Native Windows title-bar palette. Keep system caption buttons and hit testing.
use std::ffi::c_void;

const DWMWA_USE_IMMERSIVE_DARK_MODE: u32 = 20;
const DWMWA_BORDER_COLOR: u32 = 34;
const DWMWA_CAPTION_COLOR: u32 = 35;
const DWMWA_TEXT_COLOR: u32 = 36;

// COLORREF is 0x00BBGGRR: cool silver, a fine silver edge, dark readable controls.
const SILVER_CAPTION: u32 = 0x00EBE6E2; // #e2e6eb
const SILVER_BORDER: u32 = 0x00B8AFA7; // #a7afb8
const CAPTION_INK: u32 = 0x003A3028; // #28303a

#[link(name = "dwmapi")]
extern "system" {
    fn DwmSetWindowAttribute(hwnd: *mut c_void, attribute: u32, value: *const c_void, size: u32) -> i32;
}

pub fn apply(window: &tauri::Window) {
    let Ok(handle) = window.hwnd() else { return };
    for (attribute, value) in [
        (DWMWA_USE_IMMERSIVE_DARK_MODE, 0_u32),
        (DWMWA_CAPTION_COLOR, SILVER_CAPTION),
        (DWMWA_TEXT_COLOR, CAPTION_INK),
        (DWMWA_BORDER_COLOR, SILVER_BORDER),
    ] {
        // SAFETY: Tauri supplies a live HWND; each call borrows a four-byte value
        // synchronously. Older Windows versions may reject color attributes;
        // retain their native caption rather than preventing app startup.
        unsafe {
            DwmSetWindowAttribute(handle.0, attribute, (&value as *const u32).cast(), 4);
        }
    }
}
