# Contributing to virage-chunkers-ce

## Prerequisites

- Node.js ≥ 18
- Rust stable (install via [rustup](https://rustup.rs))
- `@napi-rs/cli`: `npm install -g @napi-rs/cli`

## Setup

```bash
git clone https://github.com/vivantel/virage-chunkers-ce
cd virage-chunkers-ce
npm install
```

## Running checks

```bash
npm run type-check   # TypeScript
npm run lint         # ESLint
cargo fmt --check    # Rust formatting
cargo clippy         # Rust lints
npm test             # Vitest
```

## Commit convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Release-please reads these to determine version bumps and changelog entries.

| Prefix | Effect | Changelog |
|--------|--------|-----------|
| `feat:` | minor bump | ✓ Features |
| `fix:` | patch bump | ✓ Bug Fixes |
| `perf:` | patch bump | ✓ Performance |
| `refactor:` | patch bump | ✓ Code Refactoring |
| `docs:` | patch bump | ✓ Documentation |
| `style:` | no release | hidden |
| `test:` | no release | hidden |
| `chore:` | no release | hidden |

`BREAKING CHANGE:` in the footer causes a major bump.

## Adding a new chunker package

See [docs/ai/INDEX.md](docs/ai/INDEX.md#adding-a-new-package) for the step-by-step guide.

## Pull request checklist

- [ ] `npm run type-check` passes
- [ ] `cargo clippy -- -D warnings` passes
- [ ] `cargo fmt --check` passes
- [ ] `npm test` passes
- [ ] New chunker exports `createChunker(opts): FileChunker`
- [ ] `ChunkMeta` required fields populated (see guardrails)
- [ ] `rag-plugin` manifest in `package.json`
- [ ] Unit tests cover at least one fixture file per format
