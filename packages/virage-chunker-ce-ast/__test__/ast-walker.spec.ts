import { describe, it, expect } from "vitest";
import type { DocNode } from "../src/types.js";
import { walkDocNode } from "../src/ast-walker.js";
import { walkToChunks } from "../src/chunker.js";
import { extractOutline } from "../src/outline.js";

function para(text: string, byteStart = 0): DocNode {
  return {
    type: "paragraph",
    text,
    attrs: { byteStart, byteEnd: byteStart + text.length },
  };
}

function heading(text: string, level: 1 | 2 | 3 = 1, byteStart = 0): DocNode {
  return {
    type: "heading",
    text,
    attrs: { byteStart, byteEnd: byteStart + text.length, headingLevel: level },
  };
}

function doc(...children: DocNode[]): DocNode {
  return {
    type: "document",
    children,
    attrs: {
      byteStart: 0,
      byteEnd: children.reduce((s, n) => Math.max(s, n.attrs.byteEnd), 0),
    },
  };
}

describe("walkDocNode", () => {
  it("returns empty array for document with no text", () => {
    expect(walkDocNode(doc())).toEqual([]);
  });

  it("collects leaf paragraph text", () => {
    const segs = walkDocNode(doc(para("hello")));
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text).toBe("hello");
  });

  it("does not emit headings as text segments", () => {
    const segs = walkDocNode(doc(heading("Title"), para("body")));
    expect(segs).toHaveLength(1);
    expect(segs[0]!.text).toBe("body");
  });

  it("sets breadcrumb from ancestor heading", () => {
    const segs = walkDocNode(doc(heading("Intro"), para("first paragraph")));
    expect(segs[0]!.breadcrumb).toEqual(["Intro"]);
  });

  it("updates breadcrumb at heading level boundaries", () => {
    const tree = doc(
      heading("Chapter 1", 1),
      heading("Section 1.1", 2),
      para("paragraph in 1.1"),
      heading("Section 1.2", 2),
      para("paragraph in 1.2"),
    );
    const segs = walkDocNode(tree);
    expect(segs[0]!.breadcrumb).toEqual(["Chapter 1", "Section 1.1"]);
    expect(segs[1]!.breadcrumb).toEqual(["Chapter 1", "Section 1.2"]);
  });
});

describe("extractOutline", () => {
  it("returns h1 titles from direct children", () => {
    const root = doc(heading("Alpha", 1), heading("Beta", 1), para("text"));
    expect(extractOutline(root)).toEqual(["Alpha", "Beta"]);
  });

  it("ignores non-h1 headings at top level", () => {
    expect(extractOutline(doc(heading("Sub", 2)))).toEqual([]);
  });
});

describe("walkToChunks", () => {
  const opts = {
    sourceFile: "test.pdf",
    sourceFormat: "pdf",
    commitHash: "abc123",
    strategy: "@vivantel/virage-chunker-ce-ast@0.1.0",
    maxTokens: 20,
    minTokens: 5,
  };

  it("produces one chunk per maxTokens window", () => {
    // Each word ≈ 1 token (4 chars). Para of 80 chars → ~20 tokens → 1 chunk.
    const shortPara = para("a".repeat(80));
    const chunks = walkToChunks(doc(shortPara), opts);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("populates required ChunkMeta fields on every chunk", () => {
    const chunks = walkToChunks(doc(para("hello world")), opts);
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(typeof c.metadata.sourceFile).toBe("string");
      expect(typeof c.metadata.byteStart).toBe("number");
      expect(typeof c.metadata.byteEnd).toBe("number");
      expect(Array.isArray(c.metadata.breadcrumb)).toBe(true);
      expect(typeof c.metadata.strategy).toBe("string");
      expect(typeof c.metadata.chunkIndex).toBe("number");
      expect(typeof c.metadata.totalChunks).toBe("number");
      expect(typeof c.metadata.estimatedTokens).toBe("number");
    }
  });

  it("sets chunkIndex sequentially from 0", () => {
    // Force multiple chunks by using very small maxTokens.
    const bigDoc = doc(
      ...Array.from({ length: 10 }, (_, i) => para("word ".repeat(6), i * 30)),
    );
    const chunks = walkToChunks(bigDoc, { ...opts, maxTokens: 5 });
    chunks.forEach((c, i) => {
      expect(c.metadata.chunkIndex).toBe(i);
      expect(c.metadata.totalChunks).toBe(chunks.length);
    });
  });

  it("breadcrumb tracks heading context", () => {
    const tree = doc(heading("Chapter", 1, 0), para("content", 10));
    const chunks = walkToChunks(tree, opts);
    expect(chunks[0]!.metadata.breadcrumb).toEqual(["Chapter"]);
    expect(chunks[0]!.metadata.sectionTitle).toBe("Chapter");
  });

  it("returns empty array for empty document", () => {
    expect(walkToChunks(doc(), opts)).toEqual([]);
  });
});
