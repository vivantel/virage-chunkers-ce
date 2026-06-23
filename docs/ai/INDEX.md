# virage-chunkers-ce — Development Guide

This document is the primary reference for AI agents working in this repository.

## Repo Purpose

This monorepo contains Community Edition chunker plugins for [Virage](https://github.com/vivantel/virage). Each package:
- Exports `createChunker(opts): FileChunker` (see [guardrails/chunker.md](guardrails/chunker.md))
- Produces `Chunk[]` with standardized `ChunkMeta` metadata
- Publishes pre-built native binaries for 5 platforms via napi-rs

## Package List

| Package | Type | Description |
|---------|------|-------------|
| `@vivantel/virage-chunker-ce-ast` | TypeScript | Generalized ViDoc AST walker — used as dependency by Rust chunkers |
| `@vivantel/virage-chunker-ce-pdf` | Rust + TS | PDF text extraction (Phase 2 stub) |
| `crates/virage-vidoc` | Rust | Shared DocNode serde structs (path dep, not published) |

## Key Commands

```bash
# Install all dependencies
npm install

# Type-check all TypeScript packages
npm run type-check

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format

# Build TypeScript packages
npm run build

# Build one Rust package for current platform (requires Rust)
cd packages/virage-chunker-ce-pdf
npx napi build --release
```

## Build Order

`virage-chunker-ce-ast` has no dependencies on other packages here and builds first.
`virage-chunker-ce-pdf` depends on `virage-chunker-ce-ast` at runtime.

## Conventions

- **Module system**: ESM (`"type": "module"`) — all imports use `.js` extension even for `.ts` sources
- **TypeScript**: NodeNext module + resolution, strict mode
- **Commits**: Conventional Commits (see [guardrails/release.md](guardrails/release.md))
- **Tests**: Vitest; place in `__test__/` next to `src/`

## Adding a New Package

1. Create `packages/virage-chunker-ce-{format}/`
2. Add `package.json` with `"rag-plugin"` manifest (see [guardrails/chunker.md](guardrails/chunker.md))
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. For Rust packages: add `Cargo.toml` with `[lib] crate-type = ["cdylib"]` and workspace deps
5. Implement `createChunker(opts): FileChunker` in `src/index.ts` or `src-ts/index.ts`
6. Add the package to `.release-please-manifest.json` and `.github/config/release-please.json`
7. For Rust packages: add a `build-native.yml` workflow path filter for the new package

## Guardrails

- [chunker.md](guardrails/chunker.md) — plugin contract, ChunkMeta, rag-plugin manifest
- [rust-napi.md](guardrails/rust-napi.md) — napi-rs patterns, Rust↔JS boundary
- [release.md](guardrails/release.md) — commits, versioning, publishing
