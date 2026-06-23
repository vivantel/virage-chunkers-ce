# Chunking System Roadmap (CE)

This is the CE edition of the chunking system roadmap.
For the full system design including EE formats, see `docs/CHUNKING_ROADMAP.md` in [vivantel/virage](https://github.com/vivantel/virage).

## Packages in This Repo

| Package | Format | Phase |
|---------|--------|-------|
| `@vivantel/virage-chunker-ce-ast` | ViDoc AST walker (shared) | 1 ✓ |
| `@vivantel/virage-chunker-ce-pdf` | PDF (Rust: lopdf) | 2 |
| `@vivantel/virage-chunker-ce-docx` | DOCX (Rust: docx-rs) | 2 |
| `@vivantel/virage-chunker-ce-latex` | LaTeX (Rust: custom) | 2 |
| `@vivantel/virage-chunker-ce-md` | Markdown (TypeScript: remark) | 1 |

## Phase 1 — Foundation (TypeScript only)

- [x] `virage-chunker-ce-ast`: ViDoc AST walker, `maxTokens` windowing, `ChunkMeta` emission
- [ ] `virage-chunker-ce-md`: markdown → ViDoc via remark, frontmatter, full breadcrumb
- [ ] Add `DocNode`, `ChunkMeta` types to `@vivantel/virage-core`
- [ ] Extend `strategy-registry.ts` in virage-core: `"package"` strategy type

## Phase 2 — Rust Core

- [ ] `virage-chunker-ce-pdf`: lopdf parser, heading heuristics, page tracking
- [ ] `virage-chunker-ce-docx`: docx-rs, OOXML structure, tables, images
- [ ] `virage-chunker-ce-latex`: custom lexer, math, section hierarchy
- [ ] Per-format benchmark: index time + chunk quality vs JS alternatives

## EE Formats

XLSX, PPTX, HTML, ePub, RST are in the `vivantel/virage-chunkers-ee` private repo.
