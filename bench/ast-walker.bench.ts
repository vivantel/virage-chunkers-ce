/**
 * AST walker throughput benchmarks.
 *
 * These benchmarks measure the pure-TS walkToChunks pipeline and do NOT require
 * a compiled native binary. They are the primary performance signal for the
 * shared chunking infrastructure used by every format.
 *
 * Run: npm run bench
 */
import { bench, describe } from "vitest";
import { walkToChunks } from "@vivantel/virage-chunker-ce-ast";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";

// ──── fixture builders ────────────────────────────────────────────────────────

const PARA_WORDS =
  "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua".split(
    " ",
  );

function makeWord(i: number): string {
  return PARA_WORDS[i % PARA_WORDS.length]!;
}

function makeText(wordCount: number, offset: number): string {
  return Array.from({ length: wordCount }, (_, i) => makeWord(offset + i)).join(" ");
}

function makeLargeDoc(paragraphCount: number, wordsPerParagraph: number): DocNode {
  const children: DocNode[] = [];
  let byteOffset = 0;

  for (let i = 0; i < paragraphCount; i++) {
    // Insert a heading every 10 paragraphs.
    if (i % 10 === 0) {
      const section = Math.floor(i / 10) + 1;
      const headingText = `Section ${section} heading text`;
      children.push({
        type: "heading",
        text: headingText,
        attrs: {
          headingLevel: 2,
          byteStart: byteOffset,
          byteEnd: byteOffset + headingText.length,
        },
      });
      byteOffset += headingText.length + 1;
    }

    const text = makeText(wordsPerParagraph, i * 3);
    children.push({
      type: "paragraph",
      text,
      attrs: { byteStart: byteOffset, byteEnd: byteOffset + text.length },
    });
    byteOffset += text.length + 2;
  }

  return {
    type: "document",
    attrs: { byteStart: 0, byteEnd: byteOffset },
    children,
  };
}

// Pre-build fixtures outside the bench loop so construction cost is excluded.
const DOC_SMALL = makeLargeDoc(100, 40); //  ~4k tokens
const DOC_LARGE = makeLargeDoc(1000, 40); // ~40k tokens

const WALK_OPTS_512 = {
  sourceFile: "bench.md",
  sourceFormat: "md",
  commitHash: "abc123",
  strategy: "@vivantel/virage-chunker-ce-md",
  maxTokens: 512,
} as const;

const WALK_OPTS_128 = { ...WALK_OPTS_512, maxTokens: 128 };

// ──── benchmarks ─────────────────────────────────────────────────────────────

describe("walkToChunks — small doc (100 paragraphs)", () => {
  bench("maxTokens=512", () => {
    walkToChunks(DOC_SMALL, WALK_OPTS_512);
  });

  bench("maxTokens=128", () => {
    walkToChunks(DOC_SMALL, WALK_OPTS_128);
  });
});

describe("walkToChunks — large doc (1 000 paragraphs)", () => {
  bench("maxTokens=512", () => {
    walkToChunks(DOC_LARGE, WALK_OPTS_512);
  });

  bench("maxTokens=128", () => {
    walkToChunks(DOC_LARGE, WALK_OPTS_128);
  });
});
