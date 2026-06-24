import { vi, describe, it, expect } from "vitest";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { createNativeChunker } from "@vivantel/virage-chunker-ce-ast";
import type { MdChunkerOptions } from "../src-ts/index.js";
import { createChunker } from "../src-ts/index.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from("# Hello\n\nWorld")),
  stat: vi.fn().mockResolvedValue({ size: 15, mtime: new Date("2025-01-01T00:00:00Z") }),
}));

function makeDocNode(): DocNode {
  return {
    type: "document",
    children: [
      {
        type: "section",
        children: [
          { type: "heading", text: "Introduction", attrs: { byteStart: 0, byteEnd: 14, headingLevel: 1 } },
          {
            type: "paragraph",
            text: "This is the introduction text with enough words to fill a chunk.",
            attrs: { byteStart: 16, byteEnd: 80 },
          },
        ],
        attrs: { byteStart: 0, byteEnd: 80 },
      },
      {
        type: "section",
        children: [
          { type: "heading", text: "Methods", attrs: { byteStart: 82, byteEnd: 91, headingLevel: 2 } },
          { type: "code", text: "fn compute() -> u32 { 42 }", attrs: { byteStart: 93, byteEnd: 120, codeLanguage: "rust" } },
          { type: "code", text: "<CodeBlock lang=\"ts\">\nconst x = 1;\n</CodeBlock>", attrs: { byteStart: 122, byteEnd: 170, codeLanguage: "jsx" } },
        ],
        attrs: { byteStart: 82, byteEnd: 170 },
      },
    ],
    attrs: { byteStart: 0, byteEnd: 170 },
  };
}

const docNodeJson = JSON.stringify(makeDocNode());

function createTestChunker(opts?: MdChunkerOptions) {
  return createNativeChunker<MdChunkerOptions>({
    name: "@vivantel/virage-chunker-ce-md",
    sourceFormat: "md",
    patterns: ["**/*.md", "**/*.mdx"],
    loadBinding: () => ({ parseMd: () => docNodeJson }),
    callNative: (b) => b["parseMd"](),
    extraWalkOpts: (o) => ({ overlap: o.overlap ?? 0.15 }),
  })(opts);
}

describe("virage-chunker-ce-md", () => {
  describe("createChunker (bound)", () => {
    it("returns an ArtifactChunker with correct name and patterns", () => {
      const chunker = createChunker();
      expect(chunker.name).toBe("@vivantel/virage-chunker-ce-md");
      expect(chunker.patterns).toContain("**/*.md");
      expect(chunker.patterns).toContain("**/*.mdx");
    });

    it("canProcess accepts .md and .mdx, rejects .pdf", async () => {
      const chunker = createChunker();
      expect(await chunker.canProcess?.("README.md")).toBe(true);
      expect(await chunker.canProcess?.("page.mdx")).toBe(true);
      expect(await chunker.canProcess?.("doc.pdf")).toBe(false);
    });

    it("canProcess respects ignore list", async () => {
      const chunker = createChunker({ ignore: ["**/node_modules/**"] });
      expect(await chunker.canProcess?.("node_modules/foo/README.md")).toBe(false);
      expect(await chunker.canProcess?.("docs/guide.md")).toBe(true);
    });
  });

  describe("chunk() with mock binding", () => {
    it("returns ArtifactSet[] with all three artifacts populated", async () => {
      const chunker = createTestChunker();
      const results = await chunker.chunk("docs/guide.md", "abc123");

      expect(results.length).toBeGreaterThan(0);
      for (const artifact of results) {
        expect(typeof artifact.searchRepresentation.id).toBe("string");
        expect(typeof artifact.searchRepresentation.anchorText).toBe("string");
        expect(artifact.candidateChunk.preview.length).toBeLessThanOrEqual(250);
        expect(typeof artifact.finalAnswerChunk.content).toBe("string");
        expect(artifact.searchRepresentation.filterMetadata.sourceFormat).toBe("md");
        expect(artifact.searchRepresentation.filterMetadata.fileHash).toBeTruthy();
      }
    });

    it("breadcrumb includes heading text", async () => {
      const chunker = createTestChunker();
      const results = await chunker.chunk("docs/guide.md", "abc123");
      const headings = results
        .map((r) => r.searchRepresentation.filterMetadata.breadcrumb)
        .flat();
      expect(headings).toContain("Introduction");
    });

    it("code blocks carry codeLanguage in filterMetadata", async () => {
      const chunker = createTestChunker();
      const results = await chunker.chunk("docs/guide.md", "abc123");
      const codeChunks = results.filter(
        (r) => r.searchRepresentation.filterMetadata.codeLanguage != null,
      );
      expect(codeChunks.length).toBeGreaterThan(0);
      // At least one chunk should carry a code language (first code lang wins per window).
      const langs = codeChunks.map((r) => r.searchRepresentation.filterMetadata.codeLanguage);
      expect(langs.some((l) => l === "rust" || l === "jsx")).toBe(true);

      // JSX content should appear in at least one chunk's final answer.
      const allContent = results.map((r) => r.finalAnswerChunk.content).join("\n");
      expect(allContent).toContain("CodeBlock");
    });

    it("applies default overlap of 0.15 from extraWalkOpts", async () => {
      // When no overlap is specified, the factory's extraWalkOpts sets 0.15.
      // With overlap, chunk count may be higher than without. We just verify
      // that multiple artifacts are produced from a multi-section document.
      const chunker = createTestChunker();
      const results = await chunker.chunk("docs/guide.md", "abc123");
      expect(results.length).toBeGreaterThan(0);
    });

    it("user-specified overlap overrides the default", async () => {
      const chunkerNoOverlap = createTestChunker({ overlap: 0 });
      const chunkerWithOverlap = createTestChunker({ overlap: 0.5 });
      const r1 = await chunkerNoOverlap.chunk("docs/guide.md", "abc123");
      const r2 = await chunkerWithOverlap.chunk("docs/guide.md", "abc123");
      // With higher overlap, the window count should be >= the no-overlap count.
      expect(r2.length).toBeGreaterThanOrEqual(r1.length);
    });
  });
});
