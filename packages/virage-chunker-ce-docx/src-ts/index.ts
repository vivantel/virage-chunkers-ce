import { createNativeChunker } from "@vivantel/virage-chunker-ce-ast";
import type { BaseOptions } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type DocxChunkerOptions = BaseOptions;

export const createChunker = createNativeChunker<DocxChunkerOptions>({
  name: "@vivantel/virage-chunker-ce-docx",
  sourceFormat: "docx",
  patterns: ["**/*.docx"],
  loadBinding: () => require("./virage_chunker_ce_docx.node"),
  callNative: (b, buf) => b["parseDocx"](buf),
  extraWalkOpts: () => ({
    overlap: 0.1,
    boundaryPadding: { before: 1, after: 1 },
  }),
});
