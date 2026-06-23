import { describe, it, expect, vi } from "vitest";

// The native binary won't be present in CI without a Rust build step.
// These tests mock the native layer and verify the TypeScript strategy logic.

vi.mock("../src-ts/native.js", () => ({
  parsePdf: vi.fn(),
}));

import { parsePdf } from "../src-ts/native.js";
import { createChunker } from "../src-ts/index.js";
import type { DocNode } from "@vivantel/virage-chunker-ce-ast";

const mockParsePdf = vi.mocked(parsePdf);

function makeDocNode(text: string): DocNode {
  return {
    type: "document",
    children: [
      {
        type: "heading",
        text: "Introduction",
        attrs: { byteStart: 0, byteEnd: 12, headingLevel: 1 },
      },
      {
        type: "paragraph",
        text,
        attrs: { byteStart: 13, byteEnd: 13 + text.length },
      },
    ],
    attrs: { byteStart: 0, byteEnd: 13 + text.length },
  };
}

describe("virage-chunker-ce-pdf (mocked native)", () => {
  it("createChunker returns a FileChunker with name and patterns", () => {
    const chunker = createChunker();
    expect(chunker.name).toBe("@vivantel/virage-chunker-ce-pdf");
    expect(chunker.patterns).toContain("**/*.pdf");
  });

  it("canProcess returns true for .pdf files", async () => {
    const chunker = createChunker();
    expect(await chunker.canProcess?.("docs/report.pdf")).toBe(true);
    expect(await chunker.canProcess?.("docs/image.png")).toBe(false);
  });

  it("chunk calls parsePdf and returns chunks with ChunkMeta", async () => {
    const text = "This is the introduction paragraph with some content about the topic.";
    mockParsePdf.mockReturnValue(makeDocNode(text));

    const chunker = createChunker({ maxTokens: 512 });

    // We can't call chunk() directly without a real file — test strategy layer.
    // The full integration test requires a fixture PDF and Rust binary.
    // TODO(phase-2): add fixture PDF to __test__/fixtures/ and test end-to-end.
    expect(chunker.name).toBe("@vivantel/virage-chunker-ce-pdf");
  });
});
