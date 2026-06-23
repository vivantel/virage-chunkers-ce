#![deny(clippy::all)]

use napi_derive::napi;

mod parser;

#[napi]
pub fn parse_latex(src: String) -> napi::Result<String> {
    let doc = parser::parse(&src).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("LaTeX parse error: {e}"),
        )
    })?;
    serde_json::to_string(&doc).map_err(|e| {
        napi::Error::new(
            napi::Status::GenericFailure,
            format!("Serialization error: {e}"),
        )
    })
}
