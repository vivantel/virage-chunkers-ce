import { describe, it, expect, vi } from "vitest";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";

// Mock the native binary — not present in CI without a Rust build step.
vi.mock("../src-ts/native.js", () => ({
  parseLatex: vi.fn(),
}));

// Mock the filesystem so chunk() doesn't require a real file on disk.
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("\\section{Intro}\nSome content."),
  stat: vi.fn().mockResolvedValue({ size: 150, mtime: new Date("2026-01-01") }),
}));

import { parseLatex } from "../src-ts/native.js";
import { createChunker } from "../src-ts/index.js";

const mockParseLatex = vi.mocked(parseLatex);

function makeDocNode(overrides: Partial<DocNode> = {}): DocNode {
  return {
    type: "document",
    attrs: { byteStart: 0, byteEnd: 200 },
    children: [
      {
        type: "heading",
        text: "Introduction",
        attrs: { headingLevel: 2, byteStart: 0, byteEnd: 25 },
      },
      {
        type: "paragraph",
        text: "This is the body text of the LaTeX document with sufficient content.",
        attrs: { byteStart: 27, byteEnd: 96 },
      },
    ],
    ...overrides,
  };
}

describe("createChunker", () => {
  it("returns a FileChunker with the correct name", () => {
    const chunker = createChunker();
    expect(chunker.name).toBe("@vivantel/virage-chunker-ce-latex");
  });

  it("patterns include .tex and .latex", () => {
    const chunker = createChunker();
    expect(chunker.patterns).toContain("**/*.tex");
    expect(chunker.patterns).toContain("**/*.latex");
  });

  it("canProcess returns true for .tex files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("paper.tex")).toBe(true);
    expect(await chunker.canProcess?.("chapters/intro.tex")).toBe(true);
  });

  it("canProcess returns true for .latex files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("thesis.latex")).toBe(true);
  });

  it("canProcess returns false for non-LaTeX files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("main.ts")).toBe(false);
    expect(await chunker.canProcess?.("report.pdf")).toBe(false);
    expect(await chunker.canProcess?.("README.md")).toBe(false);
  });

  it("canProcess respects ignore patterns", async () => {
    const chunker = createChunker({ ignore: ["**/build/**"] });
    expect(await chunker.canProcess?.("build/output.tex")).toBe(false);
    expect(await chunker.canProcess?.("src/paper.tex")).toBe(true);
  });

  it("chunk calls parseLatex and returns chunks with required ChunkMeta fields", async () => {
    mockParseLatex.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });

    const chunks = await chunker.chunk("paper.tex", "abc123");

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const meta = chunk.metadata as Record<string, unknown>;
      expect(meta.sourceFile).toBe("paper.tex");
      expect(meta.sourceFormat).toBe("tex");
      expect(meta.strategy).toBe("@vivantel/virage-chunker-ce-latex");
      expect(typeof meta.chunkIndex).toBe("number");
      expect(typeof meta.totalChunks).toBe("number");
      expect(typeof meta.estimatedTokens).toBe("number");
      expect(Array.isArray(meta.breadcrumb)).toBe(true);
      expect(typeof meta.byteStart).toBe("number");
      expect(typeof meta.byteEnd).toBe("number");
    }
  });

  it("chunk sets sourceFormat to latex for .latex extension", async () => {
    mockParseLatex.mockReturnValue(makeDocNode());
    const chunker = createChunker();
    const chunks = await chunker.chunk("thesis.latex", "abc123");
    expect(chunks[0]?.metadata.sourceFormat).toBe("latex");
  });

  it("chunk sets breadcrumb from heading context", async () => {
    mockParseLatex.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });
    const chunks = await chunker.chunk("paper.tex", "abc123");
    const metas = chunks.map((c) => c.metadata as Record<string, unknown>);
    expect(metas.some((m) => (m.breadcrumb as string[]).includes("Introduction"))).toBe(true);
  });

  it("chunk sets chunkIndex sequentially from 0", async () => {
    const para = (n: number, start: number) => ({
      type: "paragraph" as const,
      text: `Section ${n} body text content for testing windowing.`,
      attrs: { byteStart: start, byteEnd: start + 50 },
    });
    mockParseLatex.mockReturnValue(
      makeDocNode({
        children: [para(1, 0), para(2, 51), para(3, 102), para(4, 153)],
      }),
    );
    const chunker = createChunker({ maxTokens: 10 });
    const chunks = await chunker.chunk("paper.tex", "abc123");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c, i) => {
      expect((c.metadata as Record<string, unknown>).chunkIndex).toBe(i);
    });
  });
});
