# Chunking System Roadmap (CE)

For the full system design (plugin contract, ChunkMeta spec, ViDoc AST), see `docs/CHUNKING_ROADMAP.md` in [vivantel/virage](https://github.com/vivantel/virage).

---

## Shared Internal Packages

These are not format chunkers — they are libraries reused by every chunker's TypeScript layer.

| Package | Role |
|---------|------|
| `crates/virage-vidoc` | Rust serde structs for DocNode — shared across all Rust chunker crates |
| `@vivantel/virage-chunker-ce-ast` | TS AST walker, `maxTokens` windowing, `ChunkMeta` builder — imported by every chunker's `src-ts/` |

---

## Format Chunkers

All format chunkers follow the napi-rs pattern: a Rust cdylib crate parses the format and returns a JSON-encoded `DocNode`; the TypeScript layer walks the AST and emits `Chunk[]`.

| Package | Format | Rust parser | Phase |
|---------|--------|-------------|-------|
| `@vivantel/virage-chunker-ce-md` | Markdown / MDX | comrak | 1 |
| `@vivantel/virage-chunker-ce-pdf` | PDF | lopdf | 2 |
| `@vivantel/virage-chunker-ce-docx` | DOCX | docx-rs | 2 |
| `@vivantel/virage-chunker-ce-latex` | LaTeX | custom lexer | 2 |

---

## Phase 1 — Markdown (Reference Implementation)

`virage-chunker-ce-md` serves as the reference napi-rs chunker: simple format, well-supported Rust parser (comrak), good for validating the full pipeline before tackling binary formats.

- [ ] `src/lib.rs`: `#[napi] pub fn parse_md(src: String) -> Result<String>` using comrak
- [ ] Map comrak AST → `DocNode` (headings → breadcrumb, paragraphs → text, code blocks → code)
- [ ] Handle GFM tables and task lists
- [ ] Frontmatter stripping (YAML via gray-matter on the TS side)
- [ ] MDX: strip JSX expressions before parsing
- [ ] Unit tests: fixture `.md` files → expected `DocNode` JSON

Also in Phase 1:
- [ ] Migrate `DocNode` / `ChunkMeta` TS interfaces to `@vivantel/virage-core`
- [ ] Extend `strategy-registry.ts` in virage-core: `"package"` strategy type

---

## Phase 2 — Binary Formats (Rust Core)

- [ ] `virage-chunker-ce-pdf`: lopdf text extraction, heading heuristics from font size, page number tracking
- [ ] `virage-chunker-ce-docx`: docx-rs, paragraph styles → heading levels, table → code-block node, embedded images skipped
- [ ] `virage-chunker-ce-latex`: lexer for `\section`/`\subsection`/`\begin{...}`, math env → `type: "math"` node
- [ ] Cross-format eval: chunk quality and index latency vs JS alternatives in `vivantel/virage`

---

## EE Formats

XLSX, PPTX, HTML, ePub, RST are in the private `vivantel/virage-chunkers-ee` repo.
