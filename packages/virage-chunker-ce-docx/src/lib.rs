#![deny(clippy::all)]

use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

mod parser;

#[napi]
pub fn parse_docx(buf: Buffer) -> napi::Result<String> {
    let bytes: &[u8] = &buf;
    let doc = parser::parse(bytes).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("DOCX parse error: {e}"),
        )
    })?;
    serde_json::to_string(&doc).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Serialization error: {e}"),
        )
    })
}
