import { describe, it, expect, vi } from "vitest";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";

// Mock the native binary — not present in CI without a Rust build step.
vi.mock("../src-ts/native.js", () => ({
  parseDocx: vi.fn(),
}));

// Mock the filesystem so chunk() doesn't require a real file on disk.
vi.mock("fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("mock docx bytes")),
  stat: vi.fn().mockResolvedValue({ size: 200, mtime: new Date("2026-01-01") }),
}));

import { parseDocx } from "../src-ts/native.js";
import { createChunker } from "../src-ts/index.js";

const mockParseDocx = vi.mocked(parseDocx);

function makeDocNode(overrides: Partial<DocNode> = {}): DocNode {
  return {
    type: "document",
    attrs: { byteStart: 0, byteEnd: 200 },
    children: [
      {
        type: "heading",
        text: "Executive Summary",
        attrs: { headingLevel: 1, byteStart: 0, byteEnd: 19 },
      },
      {
        type: "paragraph",
        text: "This is the introductory paragraph of the Word document with enough content to form a chunk.",
        attrs: { byteStart: 21, byteEnd: 110 },
      },
    ],
    ...overrides,
  };
}

describe("createChunker", () => {
  it("returns a FileChunker with the correct name", () => {
    const chunker = createChunker();
    expect(chunker.name).toBe("@vivantel/virage-chunker-ce-docx");
  });

  it("patterns include .docx", () => {
    const chunker = createChunker();
    expect(chunker.patterns).toContain("**/*.docx");
  });

  it("canProcess returns true for .docx files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("report.docx")).toBe(true);
    expect(await chunker.canProcess?.("docs/contract.docx")).toBe(true);
  });

  it("canProcess returns false for non-docx files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("main.ts")).toBe(false);
    expect(await chunker.canProcess?.("report.pdf")).toBe(false);
    expect(await chunker.canProcess?.("README.md")).toBe(false);
  });

  it("canProcess respects ignore patterns", async () => {
    const chunker = createChunker({ ignore: ["**/archive/**"] });
    expect(await chunker.canProcess?.("archive/old.docx")).toBe(false);
    expect(await chunker.canProcess?.("docs/current.docx")).toBe(true);
  });

  it("chunk calls parseDocx and returns chunks with required ChunkMeta fields", async () => {
    mockParseDocx.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });

    const chunks = await chunker.chunk("report.docx", "abc123");

    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const meta = chunk.metadata as Record<string, unknown>;
      expect(meta.sourceFile).toBe("report.docx");
      expect(meta.sourceFormat).toBe("docx");
      expect(meta.strategy).toBe("@vivantel/virage-chunker-ce-docx");
      expect(typeof meta.chunkIndex).toBe("number");
      expect(typeof meta.totalChunks).toBe("number");
      expect(typeof meta.estimatedTokens).toBe("number");
      expect(Array.isArray(meta.breadcrumb)).toBe(true);
      expect(typeof meta.byteStart).toBe("number");
      expect(typeof meta.byteEnd).toBe("number");
    }
  });

  it("chunk always sets sourceFormat to docx", async () => {
    mockParseDocx.mockReturnValue(makeDocNode());
    const chunker = createChunker();
    const chunks = await chunker.chunk("contract.docx", "abc123");
    expect(chunks[0]?.metadata.sourceFormat).toBe("docx");
  });

  it("chunk sets breadcrumb from heading context", async () => {
    mockParseDocx.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });
    const chunks = await chunker.chunk("report.docx", "abc123");
    const metas = chunks.map((c) => c.metadata as Record<string, unknown>);
    expect(metas.some((m) => (m.breadcrumb as string[]).includes("Executive Summary"))).toBe(true);
  });

  it("chunk sets chunkIndex sequentially from 0", async () => {
    // Multiple small paragraphs with tiny maxTokens forces multiple windows.
    const para = (n: number, start: number) => ({
      type: "paragraph" as const,
      text: `Section ${n} with sufficient text content here.`,
      attrs: { byteStart: start, byteEnd: start + 40 },
    });
    mockParseDocx.mockReturnValue(
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
    const chunks = await chunker.chunk("big.docx", "abc123");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((c, i) => {
      expect((c.metadata as Record<string, unknown>).chunkIndex).toBe(i);
    });
  });

  it("chunk passes commitHash through to chunk result", async () => {
    mockParseDocx.mockReturnValue(makeDocNode());
    const chunker = createChunker({ maxTokens: 512 });
    const chunks = await chunker.chunk("report.docx", "deadbeef");
    for (const chunk of chunks) {
      expect(chunk.commitHash).toBe("deadbeef");
    }
  });
});
