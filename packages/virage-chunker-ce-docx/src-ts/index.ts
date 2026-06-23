import type { FileChunker } from "@vivantel/virage-core";
import { minimatch } from "minimatch";
import { chunkDocxFile } from "./strategy.js";
import type { DocxChunkerOptions } from "./strategy.js";

export type { DocxChunkerOptions };

const DEFAULT_PATTERNS = ["**/*.docx"];

export function createChunker(opts: DocxChunkerOptions = {}): FileChunker {
  const patterns = DEFAULT_PATTERNS;
  const ignore = opts.ignore ?? [];

  return {
    name: "@vivantel/virage-chunker-ce-docx",
    patterns,

    async chunk(filePath: string, commitHash: string) {
      return chunkDocxFile(filePath, commitHash, opts);
    },

    async canProcess(filePath: string): Promise<boolean> {
      if (ignore.some((p) => minimatch(filePath, p, { matchBase: true }))) {
        return false;
      }
      return patterns.some((p) => minimatch(filePath, p, { matchBase: true }));
    },
  };
}
