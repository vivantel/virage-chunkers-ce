import type { FileChunker } from "@vivantel/virage-core";
import { minimatch } from "minimatch";
import { chunkPdfFile } from "./strategy.js";
import type { PdfChunkerOptions } from "./strategy.js";

export type { PdfChunkerOptions };

const DEFAULT_PATTERNS = ["**/*.pdf"];

export function createChunker(opts: PdfChunkerOptions = {}): FileChunker {
  const patterns = DEFAULT_PATTERNS;
  const ignore = opts.ignore ?? [];

  return {
    name: "@vivantel/virage-chunker-ce-pdf",
    patterns,

    async chunk(filePath: string, commitHash: string) {
      return chunkPdfFile(filePath, commitHash, opts);
    },

    async canProcess(filePath: string): Promise<boolean> {
      if (ignore.some((p) => minimatch(filePath, p, { matchBase: true }))) {
        return false;
      }
      return patterns.some((p) => minimatch(filePath, p, { matchBase: true }));
    },
  };
}
