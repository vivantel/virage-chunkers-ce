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

| Package | Format | Rust parser | Phase | Status |
|---------|--------|-------------|-------|--------|
| `@vivantel/virage-chunker-ce-md` | Markdown / MDX | comrak 0.52 | 1 | ✅ done |
| `@vivantel/virage-chunker-ce-pdf` | PDF | lopdf 0.41 | 2 | ✅ done |
| `@vivantel/virage-chunker-ce-docx` | DOCX | docx-rs 0.4 | 2 | ✅ done |
| `@vivantel/virage-chunker-ce-latex` | LaTeX | custom lexer | 2 | ✅ done |

---

## Phase 1 — Markdown (Reference Implementation) ✅

`virage-chunker-ce-md` serves as the reference napi-rs chunker: simple format, well-supported Rust parser (comrak), good for validating the full pipeline before tackling binary formats.

- [x] `src/lib.rs`: `#[napi] pub fn parse_md(src: String) -> Result<String>` using comrak 0.52
- [x] Map comrak AST → `DocNode` (headings → breadcrumb, paragraphs → text, code blocks → code)
- [x] Handle GFM tables and task lists
- [x] Frontmatter stripping via comrak `front_matter_delimiter`
- [x] MDX: strip JSX expressions before parsing
- [x] Unit tests: 6 Rust `#[cfg(test)]` unit tests + 10 TS-layer tests

Also in Phase 1:
- [ ] Migrate `DocNode` / `ChunkMeta` TS interfaces to `@vivantel/virage-core`
- [ ] Extend `strategy-registry.ts` in virage-core: `"package"` strategy type

---

## Phase 2 — Binary Formats (Rust Core) ✅

- [x] `virage-chunker-ce-pdf`: lopdf text extraction, paragraph-level heading heuristic (short line + no terminal punctuation), per-page Section nodes, page number in attrs
- [x] `virage-chunker-ce-docx`: docx-rs, paragraph styles → heading levels (Heading1–Heading6), tracked-change support (Insert included, Delete skipped), table → `table` / `table-row` / `table-cell` nodes
- [x] `virage-chunker-ce-latex`: custom single-pass lexer/parser; sectioning commands → headings; `verbatim`/`lstlisting`/`minted` → code nodes with language extraction; `equation`/`align`/`$$`/`$` → formula nodes; `tabular` → table tree; `\begin{abstract}` → abstract node; preamble `\title`/`\author` → metadata node
- [ ] Cross-format eval: chunk quality and index latency vs JS alternatives in `vivantel/virage`

---

## Design Notes

### Parser choice rationale

| Format | Choice | Reason |
|--------|--------|--------|
| Markdown | comrak 0.52 | Full CommonMark + GFM compliance, actively maintained, available as Rust crate |
| PDF | lopdf 0.41 | Handles compressed/cross-ref PDFs without spawning a subprocess; pure Rust |
| DOCX | docx-rs 0.4 | Best-maintained pure-Rust DOCX reader; exposes paragraph styles directly |
| LaTeX | custom | No production-quality Rust LaTeX parser exists; a targeted single-pass lexer is sufficient for structural extraction |

### Heading detection strategy

- **Markdown**: comrak `NodeValue::Heading { level }` — exact, no heuristic needed.
- **PDF**: heuristic — a text block is a heading if it fits on a single line, is ≤ 120 chars, and does not end with sentence-terminating punctuation (`.`, `,`, `;`, `:`, `!`, `?`, `)`). Level 1 if ALL CAPS or ≤ 30 chars; level 2 otherwise.
- **DOCX**: paragraph `property.style.val` — `"Heading1"` through `"Heading6"` (with or without space). Exact, no heuristic needed.
- **LaTeX**: `\chapter` → 1, `\section` → 2, `\subsection` → 3, `\subsubsection` → 4, `\paragraph` → 5, `\subparagraph` → 6.

### Known limitations

- **PDF**: `lopdf::Document::extract_text` concatenates text without font-size information, so heading detection is heuristic-only. Multi-column layouts produce interleaved text. Scanned PDFs (no text layer) produce empty output.
- **DOCX**: Byte offsets are approximated from accumulated character counts — DOCX is a ZIP archive and there are no raw byte positions after decompression.
- **LaTeX**: Custom parser handles common academic patterns but does not implement the full TeX macro expansion model. User-defined macros (`\newcommand`) are skipped.
- **Markdown**: MDX JSX expressions are stripped before parsing; React component props containing LaTeX math may be lost.

---

## Test Strategy

### Layers

| Layer | Location | Requires native binary? |
|-------|----------|------------------------|
| Rust unit tests | `src/parser.rs` `#[cfg(test)]` | No (runs with `cargo test`) |
| TS-layer unit tests | `__test__/*.spec.ts` | No (native module mocked with `vi.mock`) |
| Integration tests | (future) `__test__/*.integration.ts` | Yes (needs `napi build --release`) |
| Benchmarks | `bench/*.bench.ts` | No for AST walker; optional for native parser |

### Running

```sh
# Rust unit tests (all packages)
cargo test

# TypeScript unit tests (all packages, no binary needed)
npm test

# Benchmarks
npm run bench

# Full Rust quality gate
cargo fmt --check && cargo clippy -- -D warnings && cargo build
```

### Coverage targets

| Package | Rust tests | TS tests |
|---------|-----------|---------|
| `virage-vidoc` | 1 (round-trip) | — |
| `virage-chunker-ce-ast` | — | 12 |
| `virage-chunker-ce-md` | 6 | 10 |
| `virage-chunker-ce-pdf` | 4 | 3 |
| `virage-chunker-ce-docx` | 2 | 10 |
| `virage-chunker-ce-latex` | 7 | 10 |

---

## Benchmarks

Benchmarks live in `bench/` and are run with `npm run bench` (Vitest bench mode).

### Fixtures

| File | Size | Description |
|------|------|-------------|
| `bench/fixtures/large-50k.md` | ~238 KB | Synthetic Markdown: 40 sections × 15 paragraphs + occasional code blocks |

### Baseline results (2026-06-23, linux-x64, AMD EPYC)

| Benchmark | ops/sec | mean (ms) |
|-----------|---------|-----------|
| walkToChunks — 100 paragraphs, maxTokens=512 | 20 415 | 0.049 |
| walkToChunks — 100 paragraphs, maxTokens=128 | 20 571 | 0.049 |
| walkToChunks — 1 000 paragraphs, maxTokens=512 | 2 287 | 0.437 |
| walkToChunks — 1 000 paragraphs, maxTokens=128 | 2 028 | 0.493 |

### Targets (goals, not CI gates)

| Format | Target |
|--------|--------|
| `walkToChunks` 1 000-paragraph doc | ≥ 1 000 ops/sec |
| `parseMd` native (238 KB) | ≥ 5 MB/s |
| `parsePdf` native | ≥ 1 MB/s |
| `parseDocx` native | ≥ 2 MB/s |

---

## Phase 3 — Hardening and Integration

- [ ] Cross-format eval: chunk quality comparison vs JS alternatives (`marked`, `pdf.js`, `mammoth`)
- [ ] Integration tests with real fixture files (requires native build in CI)
- [ ] CI matrix builds for linux-x64, darwin-arm64, win32-x64
- [ ] Publish native platform packages to npm
- [ ] `@vivantel/virage-chunker-ce-ast` additional edge-case tests: oversized segment truncation, `minTokens` merge, `pageNumber` propagation
- [ ] Pure-TS fallback for Markdown (remark-based) for environments without native binaries

---

## EE Formats

XLSX, PPTX, HTML, ePub, RST are in the private `vivantel/virage-chunkers-ee` repo.
