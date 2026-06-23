import { readFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { walkToChunks } from "@vivantel/virage-chunker-ce-ast";
import type { ChunkResult } from "@vivantel/virage-chunker-ce-ast";
import { parseDocx } from "./native.js";

const PKG_NAME = "@vivantel/virage-chunker-ce-docx";

export interface DocxChunkerOptions {
  maxTokens?: number;
  minTokens?: number;
  ignore?: string[];
}

export async function chunkDocxFile(
  filePath: string,
  commitHash: string,
  opts: DocxChunkerOptions,
): Promise<ChunkResult[]> {
  const [content, stats] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ]);

  const fileHash = createHash("sha256").update(content).digest("hex");
  const docNode = parseDocx(content);

  return walkToChunks(docNode, {
    sourceFile: filePath,
    sourceFormat: "docx",
    commitHash,
    strategy: PKG_NAME,
    maxTokens: opts.maxTokens,
    minTokens: opts.minTokens,
    fileHash,
    fileSizeBytes: stats.size,
    fileModifiedAt: stats.mtime.toISOString(),
  });
}
