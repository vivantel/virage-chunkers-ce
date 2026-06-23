import type { FileChunker } from "@vivantel/virage-core";
import { minimatch } from "minimatch";
import { chunkLatexFile } from "./strategy.js";
import type { LatexChunkerOptions } from "./strategy.js";

export type { LatexChunkerOptions };

const DEFAULT_PATTERNS = ["**/*.tex", "**/*.latex"];

export function createChunker(opts: LatexChunkerOptions = {}): FileChunker {
  const patterns = DEFAULT_PATTERNS;
  const ignore = opts.ignore ?? [];

  return {
    name: "@vivantel/virage-chunker-ce-latex",
    patterns,

    async chunk(filePath: string, commitHash: string) {
      return chunkLatexFile(filePath, commitHash, opts);
    },

    async canProcess(filePath: string): Promise<boolean> {
      if (ignore.some((p) => minimatch(filePath, p, { matchBase: true }))) {
        return false;
      }
      return patterns.some((p) => minimatch(filePath, p, { matchBase: true }));
    },
  };
}
