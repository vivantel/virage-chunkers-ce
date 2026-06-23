use virage_vidoc::{DocNode, DocNodeAttrs, DocNodeType};

/// Parse raw PDF bytes into a ViDoc DocNode tree.
///
/// TODO(phase-2): Implement using lopdf.
///   1. Load document with `lopdf::Document::load_mem(bytes)`
///   2. Iterate pages, extract text streams
///   3. Use font-size heuristics (or PDF outline bookmarks) to detect headings
///   4. Build DocNode tree: document → [section → [heading?, paragraph*]]*
///   5. Populate byteStart/byteEnd from stream offsets, pageNumber from page iterator
pub fn parse(_bytes: &[u8]) -> Result<DocNode, Box<dyn std::error::Error>> {
    // Stub: returns an empty document node until the parser is implemented.
    Ok(DocNode {
        node_type: DocNodeType::Document,
        children: Some(vec![]),
        text: None,
        attrs: DocNodeAttrs {
            byte_start: 0,
            byte_end: _bytes.len() as u64,
            source_format: Some("pdf".to_string()),
            ..Default::default()
        },
    })
}
