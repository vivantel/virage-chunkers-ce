use serde::{Deserialize, Serialize};

/// Every node type in the ViDoc AST.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DocNodeType {
    Document,
    Section,
    Heading,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    List,
    ListItem,
    Code,
    Formula,
    Image,
    Link,
    Footnote,
    Caption,
    Abstract,
    Metadata,
}

/// Semantic role of a node (used for structural nodes that aren't headings).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NodeRole {
    Caption,
    Footnote,
    Abstract,
    TocEntry,
    Header,
    Footer,
}

/// Per-node attribute bag.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocNodeAttrs {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub heading_level: Option<u8>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<NodeRole>,

    /// Ancestor heading texts from outermost to innermost.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub breadcrumb: Option<Vec<String>>,

    /// Byte offset of first byte in source file.
    pub byte_start: u64,
    /// Byte offset one past last byte.
    pub byte_end: u64,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_start: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_end: Option<u32>,

    /// 1-based page number (paginated formats: PDF, DOCX).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_number: Option<u32>,

    /// BCP-47 language tag, e.g. "en", "de", "zh-Hans".
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,

    /// Programming language identifier for code nodes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code_language: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub table_row: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub table_col: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_header: Option<bool>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub list_depth: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ordered: Option<bool>,

    /// Source format of the original document.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_format: Option<String>,
}

/// A node in the ViDoc AST.
///
/// Structural nodes (document, section, heading, table, list, …) carry `children`.
/// Leaf nodes (paragraph, table-cell, list-item, code, formula, …) carry `text`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DocNode {
    #[serde(rename = "type")]
    pub node_type: DocNodeType,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<DocNode>>,

    /// Leaf text content.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    pub attrs: DocNodeAttrs,
}

impl DocNode {
    /// Serialize the tree to JSON (the Rust↔JS boundary format).
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Deserialize from JSON received from a TypeScript caller.
    pub fn from_json(s: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_json() {
        let node = DocNode {
            node_type: DocNodeType::Paragraph,
            children: None,
            text: Some("Hello world".to_string()),
            attrs: DocNodeAttrs {
                byte_start: 0,
                byte_end: 11,
                breadcrumb: Some(vec!["Introduction".to_string()]),
                ..Default::default()
            },
        };
        let json = node.to_json().unwrap();
        let back = DocNode::from_json(&json).unwrap();
        assert_eq!(node, back);
    }
}
