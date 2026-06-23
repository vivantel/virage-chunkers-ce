#![deny(clippy::all)]

use napi_derive::napi;

mod parser;

/// Parse Markdown (or MDX) source and return a JSON-encoded ViDoc DocNode tree.
///
/// The returned string is `serde_json::to_string(&DocNode)` — the TypeScript
/// side deserializes it with `JSON.parse(result) as DocNode`.
///
/// # Errors
///
/// Returns an napi Error if parsing or serialization fails.
#[napi]
pub fn parse_md(src: String) -> napi::Result<String> {
    let doc = parser::parse(&src).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Markdown parse error: {e}"),
        )
    })?;
    serde_json::to_string(&doc).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Serialization error: {e}"),
        )
    })
}
