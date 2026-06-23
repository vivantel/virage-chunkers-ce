import { describe, it, expect, vi } from "vitest";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";

// Mock the native binary — not present in CI without a Rust build step.
vi.mock("../src-ts/native.js", () => ({
  parseMd: vi.fn(),
}));

// Mock the filesystem so chunk() doesn't require a real file on disk.
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("# Mock\n\nContent."),
  stat: vi.fn().mockResolvedValue({ size: 100, mtime: new Date("2026-01-01") }),
}));

import { parseMd } from "../src-ts/native.js";
import { createChunker } from "../src-ts/index.js";

const mockParseMd = vi.mocked(parseMd);

function makeDocNode(overrides: Partial<DocNode> = {}): DocNode {
  return {
    type: "document",
    attrs: { byteStart: 0, byteEnd: 200 },
    children: [
      {
        type: "heading",
        text: "Introduction",
        attrs: { headingLevel: 1, byteStart: 0, byteEnd: 14 },
      },
      {
        type: "paragraph",
        text: "This is an introductory paragraph with enough text to form a chunk.",
        attrs: { byteStart: 16, byteEnd: 82 },
      },
    ],
    ...overrides,
  };
}

describe("createChunker", () => {
  it("returns a FileChunker with the correct name", () => {
    const chunker = createChunker();
    expect(chunker.name).toBe("@vivantel/virage-chunker-ce-md");
  });

  it("patterns include .md and .mdx", () => {
    const chunker = createChunker();
    expect(chunker.patterns).toContain("**/*.md");
    expect(chunker.patterns).toContain("**/*.mdx");
  });

  it("canProcess returns true for .md files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("README.md")).toBe(true);
    expect(await chunker.canProcess?.("docs/guide.md")).toBe(true);
  });

  it("canProcess returns true for .mdx files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("pages/index.mdx")).toBe(true);
  });

  it("canProcess returns false for non-markdown files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("main.ts")).toBe(false);
    expect(await chunker.canProcess?.("report.pdf")).toBe(false);
    expect(await chunker.canProcess?.("data.json")).toBe(false);
  });

  it("canProcess respects ignore patterns", async () => {
    const chunker = createChunker({ ignore: ["**/node_modules/**"] });
    expect(await chunker.canProcess?.("node_modules/pkg/README.md")).toBe(false);
  });

  it("chunk calls parseMd and returns chunks with required ChunkMeta fields", async () => {
    mockParseMd.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });

    const chunks = await chunker.chunk("README.md", "abc123");

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const meta = chunk.metadata as Record<string, unknown>;
      expect(meta.sourceFile).toBe("README.md");
      expect(meta.sourceFormat).toBe("md");
      expect(meta.strategy).toBe("@vivantel/virage-chunker-ce-md");
      expect(typeof meta.chunkIndex).toBe("number");
      expect(typeof meta.totalChunks).toBe("number");
      expect(typeof meta.estimatedTokens).toBe("number");
      expect(Array.isArray(meta.breadcrumb)).toBe(true);
      expect(typeof meta.byteStart).toBe("number");
      expect(typeof meta.byteEnd).toBe("number");
    }
  });

  it("chunk sets sourceFormat to mdx for .mdx files", async () => {
    mockParseMd.mockReturnValue(makeDocNode());
    const chunker = createChunker();
    const chunks = await chunker.chunk("index.mdx", "abc123");
    expect(chunks[0]?.metadata.sourceFormat).toBe("mdx");
  });

  it("chunk sets breadcrumb from heading context", async () => {
    mockParseMd.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });
    const chunks = await chunker.chunk("README.md", "abc123");
    const metas = chunks.map((c) => c.metadata as Record<string, unknown>);
    expect(metas.some((m) => (m.breadcrumb as string[]).includes("Introduction"))).toBe(true);
  });

  it("chunk sets chunkIndex sequentially from 0", async () => {
    // Use multiple paragraphs so the windowing algorithm produces 2+ chunks.
    // maxTokens=10 (40 chars) → each 60-char paragraph fills more than one window.
    const para = (n: number, start: number) => ({
      type: "paragraph" as const,
      text: `Paragraph ${n} with some content here.`,
      attrs: { byteStart: start, byteEnd: start + 40 },
    });
    mockParseMd.mockReturnValue(
      makeDocNode({
        children: [
          para(1, 0),
          para(2, 41),
          para(3, 82),
          para(4, 123),
        ],
      }),
    );
    const chunker = createChunker({ maxTokens: 10 });
    const chunks = await chunker.chunk("big.md", "abc123");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c, i) => {
      expect((c.metadata as Record<string, unknown>).chunkIndex).toBe(i);
    });
  });
});
