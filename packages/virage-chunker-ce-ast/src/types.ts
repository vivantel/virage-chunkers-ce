// ViDoc AST types.
// These mirror the Rust structs in crates/virage-vidoc/src/lib.rs.
// TODO(phase-1): move to @vivantel/virage-core once the core PR lands.

export type DocNodeType =
  | "document"
  | "section"
  | "heading"
  | "paragraph"
  | "table"
  | "table-row"
  | "table-cell"
  | "list"
  | "list-item"
  | "code"
  | "formula"
  | "image"
  | "link"
  | "footnote"
  | "caption"
  | "abstract"
  | "metadata";

export interface DocNodeAttrs {
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  role?: "caption" | "footnote" | "abstract" | "toc-entry" | "header" | "footer";
  breadcrumb?: string[];
  byteStart: number;
  byteEnd: number;
  lineStart?: number;
  lineEnd?: number;
  pageNumber?: number;
  lang?: string;
  codeLanguage?: string;
  tableRow?: number;
  tableCol?: number;
  isHeader?: boolean;
  listDepth?: number;
  ordered?: boolean;
  sourceFormat?: string;
}

export interface DocNode {
  type: DocNodeType;
  children?: DocNode[];
  text?: string;
  attrs: DocNodeAttrs;
}

// ChunkMeta — standard metadata shape for every emitted chunk.
// TODO(phase-1): move to @vivantel/virage-core.
export interface ChunkMeta extends Record<string, unknown> {
  // ── Provenance ────────────────────────────────────────────────────────
  sourceFile: string;
  sourceFormat: string;
  byteStart: number;
  byteEnd: number;
  lineStart?: number;
  lineEnd?: number;
  pageStart?: number;
  pageEnd?: number;

  // ── File-level ────────────────────────────────────────────────────────
  fileSizeBytes?: number;
  fileModifiedAt?: string;
  fileHash?: string;

  // ── Hierarchy ────────────────────────────────────────────────────────
  breadcrumb: string[];
  sectionTitle?: string;
  headingLevel?: number;
  documentOutline?: string[];

  // ── Language ─────────────────────────────────────────────────────────
  lang?: string;
  codeLanguage?: string;

  // ── Chunker identity ─────────────────────────────────────────────────
  strategy: string;
  chunkIndex: number;
  totalChunks: number;

  // ── Observability ────────────────────────────────────────────────────
  estimatedTokens: number;
  qualityScore?: number;
  truncated?: boolean;
}
