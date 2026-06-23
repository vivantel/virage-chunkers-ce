/**
 * Markdown end-to-end throughput benchmarks.
 *
 * The native `parseMd` bench requires `virage_chunker_ce_md.node` to be built
 * first (`npm run build:native -w @vivantel/virage-chunker-ce-md`). If the
 * binary is absent the bench is skipped gracefully.
 *
 * The walkToChunks bench uses the pre-parsed JSON from the large fixture and
 * does NOT require a native binary.
 *
 * Run: npm run bench
 */
import { readFileSync } from "fs";
import { bench, describe } from "vitest";
import { walkToChunks } from "@vivantel/virage-chunker-ce-ast";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_MD = join(__dirname, "fixtures/large-50k.md");

const WALK_OPTS = {
  sourceFile: "large-50k.md",
  sourceFormat: "md" as const,
  commitHash: "bench",
  strategy: "@vivantel/virage-chunker-ce-md",
  maxTokens: 512,
};

// ──── optional native binary ──────────────────────────────────────────────────

let parseMdNative: ((src: string) => string) | null = null;

try {
  const { createRequire } = await import("module");
  const req = createRequire(import.meta.url);
  // Resolve from the md package's dist so the .node file is found.
  const binding = req(
    "../packages/virage-chunker-ce-md/virage_chunker_ce_md.node",
  ) as { parseMd: (src: string) => string };
  parseMdNative = binding.parseMd;
} catch {
  // Native binary not built — native bench will be skipped.
}

// ──── fixtures ────────────────────────────────────────────────────────────────

const mdSource = readFileSync(FIXTURE_MD, "utf8");

// Pre-parse the DocNode via native binary (if available) so that the
// walkToChunks bench only measures the walker, not the parser.
let prebuiltDocNode: DocNode | null = null;
if (parseMdNative) {
  prebuiltDocNode = JSON.parse(parseMdNative(mdSource)) as DocNode;
}

// ──── benchmarks ─────────────────────────────────────────────────────────────

describe("Markdown parse (native, requires built binary)", () => {
  if (!parseMdNative) {
    bench.skip("parseMd native (binary not built)", () => {});
    bench.skip("parseMd + walkToChunks end-to-end", () => {});
    return;
  }

  const nativeFn = parseMdNative;

  bench("parseMd native — 238 KB fixture", () => {
    nativeFn(mdSource);
  });

  bench("parseMd + walkToChunks end-to-end — 238 KB fixture", () => {
    const doc = JSON.parse(nativeFn(mdSource)) as DocNode;
    walkToChunks(doc, WALK_OPTS);
  });
});

describe("Markdown walkToChunks (pre-parsed DocNode)", () => {
  if (!prebuiltDocNode) {
    // Fall back to a small synthetic doc so the bench always produces output.
    const synthetic: DocNode = {
      type: "document",
      attrs: { byteStart: 0, byteEnd: 1000 },
      children: Array.from({ length: 50 }, (_, i) => ({
        type: "paragraph" as const,
        text: `Paragraph ${i} with lorem ipsum content filling this chunk window.`,
        attrs: { byteStart: i * 20, byteEnd: i * 20 + 20 },
      })),
    };

    bench("walkToChunks — synthetic 50-para doc (maxTokens=512)", () => {
      walkToChunks(synthetic, WALK_OPTS);
    });
    return;
  }

  const doc = prebuiltDocNode;

  bench("walkToChunks — 238 KB fixture (maxTokens=512)", () => {
    walkToChunks(doc, WALK_OPTS);
  });

  bench("walkToChunks — 238 KB fixture (maxTokens=128)", () => {
    walkToChunks(doc, { ...WALK_OPTS, maxTokens: 128 });
  });
});
