# virage-chunkers-ce

Community Edition chunker plugins for [Virage](https://github.com/vivantel/virage) — the AI-powered codebase retrieval platform.

Chunkers extend Virage with support for structured document formats. Each chunker is a standalone npm package that implements the `createChunker(opts): FileChunker` contract from `@vivantel/virage-core`, produces standardized `ChunkMeta` metadata, and publishes pre-built native binaries (via napi-rs) for all major platforms.

## Packages

| Package | Format | Phase |
|---------|--------|-------|
| [`@vivantel/virage-chunker-ce-ast`](packages/virage-chunker-ce-ast) | Generalized ViDoc AST walker (shared by all structured chunkers) | 1 |
| [`@vivantel/virage-chunker-ce-pdf`](packages/virage-chunker-ce-pdf) | PDF — text layer extraction via Rust (lopdf) | 2 |
| `@vivantel/virage-chunker-ce-docx` | DOCX / OOXML — Rust (docx-rs) | 2 |
| `@vivantel/virage-chunker-ce-latex` | LaTeX — custom Rust lexer | 2 |
| `@vivantel/virage-chunker-ce-md` | Markdown / MDX — TypeScript (remark) | 1 |

Enterprise Edition chunkers (XLSX, PPTX, HTML, ePub, RST) are in the private `vivantel/virage-chunkers-ee` repository.

## Usage

```bash
npm install @vivantel/virage-chunker-ce-pdf
```

```json
{
  "chunking": {
    "chunkers": [
      {
        "name": "pdf-docs",
        "patterns": ["**/*.pdf"],
        "strategy": "package",
        "package": "@vivantel/virage-chunker-ce-pdf",
        "strategyOptions": { "maxTokens": 512 }
      }
    ]
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Type-check all packages
npm run type-check

# Run all tests
npm test

# Lint
npm run lint

# Build native binaries (requires Rust + napi-rs CLI)
npx napi build --release --target x86_64-unknown-linux-gnu
```

See [docs/ai/INDEX.md](docs/ai/INDEX.md) for full development guidance.

## License

Dual-licensed under [MIT](LICENSE-MIT) and [Apache 2.0](LICENSE-APACHE). You may choose either license.
