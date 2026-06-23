import { readFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { walkToChunks } from "@vivantel/virage-chunker-ce-ast";
import type { ChunkResult } from "@vivantel/virage-chunker-ce-ast";
import { parseLatex } from "./native.js";

const PKG_NAME = "@vivantel/virage-chunker-ce-latex";

export interface LatexChunkerOptions {
  maxTokens?: number;
  minTokens?: number;
  ignore?: string[];
}

export async function chunkLatexFile(
  filePath: string,
  commitHash: string,
  opts: LatexChunkerOptions,
): Promise<ChunkResult[]> {
  const [content, stats] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath),
  ]);

  const fileHash = createHash("sha256").update(content).digest("hex");
  const docNode = parseLatex(content);

  const ext = filePath.endsWith(".latex") ? "latex" : "tex";

  return walkToChunks(docNode, {
    sourceFile: filePath,
    sourceFormat: ext,
    commitHash,
    strategy: PKG_NAME,
    maxTokens: opts.maxTokens,
    minTokens: opts.minTokens,
    fileHash,
    fileSizeBytes: stats.size,
    fileModifiedAt: stats.mtime.toISOString(),
  });
}
