import { readFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { walkToChunks } from "@vivantel/virage-chunker-ce-ast";
import type { ChunkResult } from "@vivantel/virage-chunker-ce-ast";
import { parsePdf } from "./native.js";

const PKG_NAME = "@vivantel/virage-chunker-ce-pdf";

export interface PdfChunkerOptions {
  maxTokens?: number;
  minTokens?: number;
  ignore?: string[];
}

export async function chunkPdfFile(
  filePath: string,
  commitHash: string,
  opts: PdfChunkerOptions,
): Promise<ChunkResult[]> {
  const [buf, stats] = await Promise.all([
    readFile(filePath),
    stat(filePath),
  ]);

  const fileHash = createHash("sha256").update(buf).digest("hex");
  const docNode = parsePdf(buf);

  return walkToChunks(docNode, {
    sourceFile: filePath,
    sourceFormat: "pdf",
    commitHash,
    strategy: PKG_NAME,
    maxTokens: opts.maxTokens,
    minTokens: opts.minTokens,
    fileHash,
    fileSizeBytes: stats.size,
    fileModifiedAt: stats.mtime.toISOString(),
  });
}
