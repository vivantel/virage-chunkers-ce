# Guardrail: Plugin Contract

Every chunker package MUST export a `createChunker` factory and include a `rag-plugin` manifest in its `package.json`.

## Required Export

```typescript
export function createChunker(opts: MyOptions = {}): FileChunker;
// or async:
export async function createChunker(opts: MyOptions): Promise<FileChunker>;
```

## `FileChunker` Interface

```typescript
interface FileChunker {
  name: string;          // package name string, e.g. "@vivantel/virage-chunker-ce-pdf"
  patterns: string[];    // glob patterns this chunker handles
  chunk(filePath: string, commitHash: string): Promise<Chunk[]>;
  canProcess?(filePath: string, content?: string): Promise<boolean>;
}
```

Use `createChunker` from `@vivantel/virage-core` to avoid re-implementing file-reading and ignore-pattern logic:

```typescript
import { createChunker } from "@vivantel/virage-core";

export function createChunker(opts) {
  return createChunker({
    patterns: ["**/*.pdf"],
    ignorePatterns: opts.ignore,
    strategy: new MyPdfStrategy(opts),
  });
}
```

## `ChunkMeta` Required Fields

Every `Chunk.metadata` MUST include these fields:

| Field | Type | Notes |
|-------|------|-------|
| `sourceFile` | `string` | repo-relative normalized path |
| `sourceFormat` | `string` | `'md'`, `'pdf'`, `'docx'`, `'latex'`, … |
| `byteStart` | `number` | byte offset of chunk start in source file |
| `byteEnd` | `number` | byte offset one past chunk end |
| `breadcrumb` | `string[]` | heading ancestry path (empty array if unavailable) |
| `strategy` | `string` | package name, e.g. `"@vivantel/virage-chunker-ce-pdf@1.0.0"` |
| `chunkIndex` | `number` | 0-based index within this file |
| `totalChunks` | `number` | total chunks produced from this file |
| `estimatedTokens` | `number` | `Math.ceil(content.length / 4)` |

## Quality Gates

| Metric | Threshold |
|--------|-----------|
| `breadcrumb` non-empty | ≥ 90% of chunks |
| `byteStart` and `byteEnd` set | 100% of chunks |
| `strategy` matches package name | 100% of chunks |

## `rag-plugin` Manifest

Every `package.json` MUST include:

```json
{
  "rag-plugin": {
    "type": "chunker",
    "label": "Human-readable label shown in virage init",
    "key": "format-short-name",
    "defaultConfig": {
      "maxTokens": 512
    }
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `type` | yes | must be `"chunker"` |
| `label` | yes | shown in `virage init` format selection wizard |
| `key` | yes | telemetry tag and config key |
| `defaultConfig` | no | merged under `strategyOptions` when not overridden |
