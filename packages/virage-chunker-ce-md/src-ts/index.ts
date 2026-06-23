import type { FileChunker } from "@vivantel/virage-core";
import { minimatch } from "minimatch";
import { chunkMdFile } from "./strategy.js";
import type { MdChunkerOptions } from "./strategy.js";

export type { MdChunkerOptions };

const DEFAULT_PATTERNS = ["**/*.md", "**/*.mdx"];

export function createChunker(opts: MdChunkerOptions = {}): FileChunker {
  const patterns = DEFAULT_PATTERNS;
  const ignore = opts.ignore ?? [];

  return {
    name: "@vivantel/virage-chunker-ce-md",
    patterns,

    async chunk(filePath: string, commitHash: string) {
      return chunkMdFile(filePath, commitHash, opts);
    },

    async canProcess(filePath: string): Promise<boolean> {
      if (ignore.some((p) => minimatch(filePath, p, { matchBase: true }))) {
        return false;
      }
      return patterns.some((p) => minimatch(filePath, p, { matchBase: true }));
    },
  };
}
