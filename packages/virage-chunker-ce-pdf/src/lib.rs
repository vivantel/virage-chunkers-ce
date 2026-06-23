#![deny(clippy::all)]

use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

mod parser;

/// Parse a PDF buffer and return a JSON-encoded ViDoc DocNode tree.
///
/// The returned string is `serde_json::to_string(&DocNode)` — the TypeScript
/// side deserializes it with `JSON.parse(result) as DocNode`.
///
/// # Errors
///
/// Returns an napi Error if the buffer is not a valid PDF or parsing fails.
#[napi]
pub fn parse_pdf(buf: Buffer) -> napi::Result<String> {
    let bytes: &[u8] = &buf;
    let doc = parser::parse(bytes).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("PDF parse error: {e}"),
        )
    })?;
    serde_json::to_string(&doc).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Serialization error: {e}"),
        )
    })
}
