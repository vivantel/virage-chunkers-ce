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

// ── Search / Candidate / Final split (Level 0 multi-artifact model) ──────────

/**
 * Filterable metadata stored alongside the Search Representation in the vector
 * index. Contains only fields that are useful for pre-retrieval filtering.
 */
export interface FilterMeta {
  sourceFile: string;
  sourceFormat: string;
  breadcrumb: string[];
  byteStart: number;
  byteEnd: number;
  lineStart?: number;
  lineEnd?: number;
  pageStart?: number;
  pageEnd?: number;
  lang?: string;
  codeLanguage?: string;
  chunkIndex: number;
  totalChunks: number;
  strategy: string;
  estimatedTokens: number;
  fileHash?: string;
  fileModifiedAt?: string;
  fileSizeBytes?: number;
}

/**
 * Full enrichment payload carried by CandidateChunk. A superset of FilterMeta
 * that includes hierarchy details, sibling links, and format-specific fields
 * used during cross-encoder re-ranking.
 */
export interface ChunkMeta extends FilterMeta {
  sectionTitle?: string;
  headingLevel?: number;
  documentOutline?: string[];
  siblingPrev?: string;
  siblingNext?: string;
  qualityScore?: number;
  truncated?: boolean;

  // Code-specific enrichment
  fqn?: string;
  imports?: string[];
  inheritanceChain?: string[];

  // Spreadsheet-specific enrichment
  sheetName?: string;
  columnHeaders?: string[];
  cellReference?: string;
  formulaDependencies?: string[];

  // Post-processing hooks (populated downstream by enrichment pipeline, not by chunker)
  keywords?: string[];
  summary?: string;
  nerEntities?: Array<{ text: string; label: string }>;
}

/** Extra context injected into FinalAnswerChunk that was NOT used for search. */
export interface InjectedContext {
  parentSectionText?: string;
  imports?: string[];
  fqnDeclarations?: string[];
  neighborPrev?: string;
  neighborNext?: string;
}

// ── Three artifact types (Level 0) ───────────────────────────────────────────

/**
 * Stored in the vector index. Contains sanitized anchor text for dense/sparse
 * retrieval and filterable metadata only — no raw content dump.
 */
export interface SearchRepresentation {
  id: string;
  anchorText: string;
  sparseTerms?: string[];
  filterMetadata: FilterMeta;
}

/**
 * Returned by ANN retrieval. Contains a short preview and full metadata
 * for cross-encoder re-ranking. Fetched from the vector store payload.
 */
export interface CandidateChunk {
  id: string;
  preview: string;
  fullMeta: ChunkMeta;
}

/**
 * Fetched after re-ranking. Contains the full raw text (with optional boundary
 * padding and injected context) that is passed to the LLM prompt.
 */
export interface FinalAnswerChunk {
  id: string;
  content: string;
  paddedContent?: string;
  injectedContext?: InjectedContext;
}

/**
 * The atomic unit produced by walkToChunks — one per logical segment.
 * Encapsulates all three artifact tiers derived from the same source window.
 */
export interface ArtifactSet {
  sourceFile: string;
  commitHash: string;
  searchRepresentation: SearchRepresentation;
  candidateChunk: CandidateChunk;
  finalAnswerChunk: FinalAnswerChunk;
}

/**
 * Upgraded chunker contract that returns ArtifactSet[].
 * Replaces the virage-core FileChunker once Phase 5 lands in the main repo.
 */
export interface ArtifactChunker {
  name: string;
  patterns: string[];
  chunk(filePath: string, commitHash: string): Promise<ArtifactSet[]>;
  canProcess?(filePath: string, content?: string): Promise<boolean>;
}
