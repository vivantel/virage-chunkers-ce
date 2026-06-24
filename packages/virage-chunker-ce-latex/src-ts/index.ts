import { createNativeChunker } from "@vivantel/virage-chunker-ce-ast";
import type { BaseOptions } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type LatexChunkerOptions = BaseOptions;

export const createChunker = createNativeChunker<LatexChunkerOptions>({
  name: "@vivantel/virage-chunker-ce-latex",
  sourceFormat: "latex",
  patterns: ["**/*.tex", "**/*.latex"],
  loadBinding: () => require("./virage_chunker_ce_latex.node"),
  callNative: (b, buf) => b["parseLatex"](buf),
  extraWalkOpts: () => ({ overlap: 0.1 }),
});
