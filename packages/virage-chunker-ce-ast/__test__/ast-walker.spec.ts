import { describe, it, expect } from "vitest";
import type { DocNode, ArtifactSet } from "../src/types.js";
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

function code(text: string, byteStart = 0, lang = "python"): DocNode {
  return {
    type: "code",
    text,
    attrs: { byteStart, byteEnd: byteStart + text.length, codeLanguage: lang },
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

  it("sets nodeType on each segment", () => {
    const segs = walkDocNode(doc(para("p"), code("c")));
    expect(segs[0]!.nodeType).toBe("paragraph");
    expect(segs[1]!.nodeType).toBe("code");
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

  function checkArtifact(a: ArtifactSet) {
    // Search Representation
    expect(typeof a.searchRepresentation.id).toBe("string");
    expect(typeof a.searchRepresentation.anchorText).toBe("string");
    expect(a.searchRepresentation.anchorText.length).toBeGreaterThan(0);
    // Candidate Chunk
    expect(a.candidateChunk.id).toBe(a.searchRepresentation.id);
    expect(typeof a.candidateChunk.preview).toBe("string");
    // FilterMeta required fields
    const fm = a.searchRepresentation.filterMetadata;
    expect(typeof fm.sourceFile).toBe("string");
    expect(typeof fm.byteStart).toBe("number");
    expect(typeof fm.byteEnd).toBe("number");
    expect(Array.isArray(fm.breadcrumb)).toBe(true);
    expect(typeof fm.strategy).toBe("string");
    expect(typeof fm.chunkIndex).toBe("number");
    expect(typeof fm.totalChunks).toBe("number");
    expect(typeof fm.estimatedTokens).toBe("number");
    // Final Answer
    expect(typeof a.finalAnswerChunk.content).toBe("string");
    expect(a.finalAnswerChunk.content.length).toBeGreaterThan(0);
  }

  it("returns empty array for empty document", () => {
    expect(walkToChunks(doc(), opts)).toEqual([]);
  });

  it("produces at least one ArtifactSet for non-empty content", () => {
    const artifacts = walkToChunks(doc(para("a".repeat(80))), opts);
    expect(artifacts.length).toBeGreaterThanOrEqual(1);
  });

  it("populates all required fields on every ArtifactSet", () => {
    const artifacts = walkToChunks(doc(para("hello world")), opts);
    expect(artifacts.length).toBeGreaterThan(0);
    for (const a of artifacts) checkArtifact(a);
  });

  it("sets chunkIndex sequentially from 0", () => {
    const bigDoc = doc(
      ...Array.from({ length: 10 }, (_, i) => para("word ".repeat(6), i * 30)),
    );
    const artifacts = walkToChunks(bigDoc, { ...opts, maxTokens: 5 });
    artifacts.forEach((a, i) => {
      expect(a.searchRepresentation.filterMetadata.chunkIndex).toBe(i);
      expect(a.searchRepresentation.filterMetadata.totalChunks).toBe(
        artifacts.length,
      );
    });
  });

  it("sets candidateChunk.fullMeta.chunkIndex equal to filterMetadata.chunkIndex", () => {
    const artifacts = walkToChunks(doc(para("x".repeat(200))), opts);
    for (const a of artifacts) {
      expect(a.candidateChunk.fullMeta.chunkIndex).toBe(
        a.searchRepresentation.filterMetadata.chunkIndex,
      );
    }
  });

  it("breadcrumb tracks heading context", () => {
    const tree = doc(heading("Chapter", 1, 0), para("content", 10));
    const artifacts = walkToChunks(tree, opts);
    expect(artifacts[0]!.searchRepresentation.filterMetadata.breadcrumb).toEqual(
      ["Chapter"],
    );
    expect(artifacts[0]!.candidateChunk.fullMeta.sectionTitle).toBe("Chapter");
  });

  it("anchorText includes breadcrumb prefix", () => {
    const tree = doc(heading("Intro", 1, 0), para("This is the intro text.", 10));
    const artifacts = walkToChunks(tree, opts);
    expect(artifacts[0]!.searchRepresentation.anchorText).toContain("Intro");
  });

  it("preview is at most 250 chars", () => {
    const artifacts = walkToChunks(doc(para("x".repeat(1000))), {
      ...opts,
      maxTokens: 1024,
    });
    for (const a of artifacts) {
      expect(a.candidateChunk.preview.length).toBeLessThanOrEqual(250);
    }
  });

  it("assigns siblingPrev and siblingNext across windows", () => {
    const bigDoc = doc(
      ...Array.from({ length: 10 }, (_, i) => para("word ".repeat(6), i * 30)),
    );
    const artifacts = walkToChunks(bigDoc, { ...opts, maxTokens: 5 });
    expect(artifacts.length).toBeGreaterThan(1);
    expect(artifacts[0]!.candidateChunk.fullMeta.siblingPrev).toBeUndefined();
    expect(artifacts[0]!.candidateChunk.fullMeta.siblingNext).toBeDefined();
    expect(artifacts[artifacts.length - 1]!.candidateChunk.fullMeta.siblingPrev).toBeDefined();
    expect(artifacts[artifacts.length - 1]!.candidateChunk.fullMeta.siblingNext).toBeUndefined();
  });

  it("prepends full breadcrumb path as markdown headings to finalAnswerChunk.content", () => {
    const tree = doc(
      heading("Intro", 1, 0),
      heading("Config", 2, 10),
      para("configure it here", 20),
    );
    const artifacts = walkToChunks(tree, opts);
    expect(artifacts[0]!.finalAnswerChunk.content).toMatch(/^# Intro\n## Config\n\n/);
    expect(artifacts[0]!.finalAnswerChunk.content).toContain("configure it here");
  });

  it("flushes a new window when entering a different section", () => {
    const tree = doc(
      heading("Section A", 1, 0),
      para("aaa bbb ccc", 10),
      heading("Section B", 1, 25),
      para("ddd eee fff", 35),
    );
    const artifacts = walkToChunks(tree, opts);
    expect(artifacts.length).toBe(2);
    expect(artifacts[0]!.searchRepresentation.filterMetadata.breadcrumb).toEqual(["Section A"]);
    expect(artifacts[1]!.searchRepresentation.filterMetadata.breadcrumb).toEqual(["Section B"]);
  });

  it("does not merge trailing small window across section boundaries", () => {
    const tree = doc(
      heading("Section A", 1, 0),
      para("word ".repeat(6), 10),
      heading("Section B", 1, 50),
      para("x", 60),
    );
    const artifacts = walkToChunks(tree, opts);
    const sectionBChunk = artifacts.find(
      (a) => a.searchRepresentation.filterMetadata.breadcrumb[0] === "Section B",
    );
    expect(sectionBChunk).toBeDefined();
    expect(sectionBChunk!.finalAnswerChunk.content).not.toContain("word");
  });

  describe("overlap", () => {
    it("produces more windows with overlap > 0 than without", () => {
      // Each paragraph ≈ 5 tokens (20 chars / 4). maxTokens=15 → 3 paras/window.
      // With 12 paragraphs: 4 windows without overlap.
      // With overlap=0.5 each new window reuses ~1-2 paras, producing more windows.
      const bigDoc = doc(
        ...Array.from({ length: 12 }, (_, i) => para("word ".repeat(4), i * 20)),
      );
      const noOverlap = walkToChunks(bigDoc, { ...opts, maxTokens: 15, overlap: 0 });
      const withOverlap = walkToChunks(bigDoc, { ...opts, maxTokens: 15, overlap: 0.5 });
      expect(withOverlap.length).toBeGreaterThan(noOverlap.length);
    });

    it("overlap=0 is the same as no overlap option", () => {
      const d = doc(
        ...Array.from({ length: 6 }, (_, i) => para("word ".repeat(5), i * 25)),
      );
      const a = walkToChunks(d, { ...opts, maxTokens: 10 });
      const b = walkToChunks(d, { ...opts, maxTokens: 10, overlap: 0 });
      expect(a.length).toBe(b.length);
    });
  });

  describe("boundaryPadding", () => {
    it("sets paddedContent on interior windows when padding configured", () => {
      const bigDoc = doc(
        ...Array.from({ length: 6 }, (_, i) => para("word ".repeat(6), i * 30)),
      );
      const artifacts = walkToChunks(bigDoc, {
        ...opts,
        maxTokens: 5,
        boundaryPadding: { before: 1, after: 1 },
      });
      expect(artifacts.length).toBeGreaterThan(1);
      // Interior windows (not first or last) should have paddedContent
      const interior = artifacts.slice(1, -1);
      for (const a of interior) {
        expect(a.finalAnswerChunk.paddedContent).toBeDefined();
        expect(a.finalAnswerChunk.paddedContent!.length).toBeGreaterThan(
          a.finalAnswerChunk.content.length,
        );
      }
    });

    it("content is unchanged — paddedContent is the extended version", () => {
      const bigDoc = doc(
        ...Array.from({ length: 4 }, (_, i) => para("word ".repeat(6), i * 30)),
      );
      const artifacts = walkToChunks(bigDoc, {
        ...opts,
        maxTokens: 5,
        boundaryPadding: { before: 1, after: 0 },
      });
      for (const a of artifacts) {
        if (a.finalAnswerChunk.paddedContent != null) {
          expect(a.finalAnswerChunk.paddedContent).toContain(
            a.finalAnswerChunk.content,
          );
        }
      }
    });
  });

  describe("adaptiveSize", () => {
    it("code segments produce smaller windows than prose segments at same maxTokens", () => {
      const prosePara = para("prose word ".repeat(10), 0);
      const codePara = code("code word ".repeat(10), 200);
      const proseArtifacts = walkToChunks(doc(prosePara), {
        ...opts,
        maxTokens: 50,
        adaptiveSize: true,
      });
      const codeArtifacts = walkToChunks(doc(codePara), {
        ...opts,
        maxTokens: 50,
        adaptiveSize: true,
      });
      // Code chunks should be more tightly bounded (lower estimatedTokens on average)
      const proseAvg =
        proseArtifacts.reduce(
          (s, a) => s + a.searchRepresentation.filterMetadata.estimatedTokens,
          0,
        ) / proseArtifacts.length;
      const codeAvg =
        codeArtifacts.reduce(
          (s, a) => s + a.searchRepresentation.filterMetadata.estimatedTokens,
          0,
        ) / codeArtifacts.length;
      expect(codeAvg).toBeLessThanOrEqual(proseAvg);
    });
  });

  describe("recursive", () => {
    it("preserves all content of an oversized segment when recursive=true", () => {
      // A single paragraph with 10× maxTokens worth of content
      const longText = "word ".repeat(200); // ~200 tokens at CHARS_PER_TOKEN=4
      const artifacts = walkToChunks(doc(para(longText, 0)), {
        ...opts,
        maxTokens: 20,
        recursive: true,
      });
      const reconstructed = artifacts
        .map((a) => a.finalAnswerChunk.content)
        .join("");
      // All content should be present (possibly concatenated without separator)
      expect(reconstructed.replace(/\s+/g, " ").trim().length).toBeGreaterThan(
        longText.length * 0.9,
      );
    });

    it("non-recursive hard-cut loses content beyond maxTokens", () => {
      const longText = "x".repeat(500);
      const artifacts = walkToChunks(doc(para(longText, 0)), {
        ...opts,
        maxTokens: 20,
        recursive: false,
      });
      // Only one artifact with truncated content
      expect(artifacts.length).toBe(1);
      expect(artifacts[0]!.finalAnswerChunk.content.length).toBeLessThan(
        longText.length,
      );
      expect(artifacts[0]!.candidateChunk.fullMeta.truncated).toBe(true);
    });
  });
});
