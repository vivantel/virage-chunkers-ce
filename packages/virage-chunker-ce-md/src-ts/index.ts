import { createNativeChunker } from "@vivantel/virage-chunker-ce-ast";
import type { BaseOptions } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type MdChunkerOptions = BaseOptions;

export const createChunker = createNativeChunker<MdChunkerOptions>({
  name: "@vivantel/virage-chunker-ce-md",
  sourceFormat: "md",
  patterns: ["**/*.md", "**/*.mdx"],
  loadBinding: () => require("./virage_chunker_ce_md.node"),
  callNative: (b, buf) => b["parseMd"](buf),
  extraWalkOpts: (opts) => ({ overlap: opts.overlap ?? 0.15 }),
});
