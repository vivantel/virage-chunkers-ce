import { readFile, stat } from "fs/promises";
import { createHash } from "crypto";
import { walkToChunks } from "@vivantel/virage-chunker-ce-ast";
import type { ChunkResult } from "@vivantel/virage-chunker-ce-ast";
import { parseMd } from "./native.js";

const PKG_NAME = "@vivantel/virage-chunker-ce-md";

export interface MdChunkerOptions {
  maxTokens?: number;
  minTokens?: number;
  ignore?: string[];
}

export async function chunkMdFile(
  filePath: string,
  commitHash: string,
  opts: MdChunkerOptions,
): Promise<ChunkResult[]> {
  const [content, stats] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath),
  ]);

  const fileHash = createHash("sha256").update(content).digest("hex");
  const docNode = parseMd(content);

  const sourceFormat = filePath.endsWith(".mdx") ? "mdx" : "md";

  return walkToChunks(docNode, {
    sourceFile: filePath,
    sourceFormat,
    commitHash,
    strategy: PKG_NAME,
    maxTokens: opts.maxTokens,
    minTokens: opts.minTokens,
    fileHash,
    fileSizeBytes: stats.size,
    fileModifiedAt: stats.mtime.toISOString(),
  });
}
