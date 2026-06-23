import type { DocNode, ChunkMeta } from "./types.js";
import { walkDocNode } from "./ast-walker.js";
import { extractOutline } from "./outline.js";

export interface WalkOptions {
  sourceFile: string;
  sourceFormat: string;
  commitHash: string;
  strategy: string;
  maxTokens?: number;
  minTokens?: number;
  fileHash?: string;
  fileSizeBytes?: number;
  fileModifiedAt?: string;
}

export interface ChunkResult {
  content: string;
  metadata: ChunkMeta;
  sourceFile: string;
  commitHash: string;
  contentHash?: string;
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Walk a ViDoc AST and produce Chunk[] with full ChunkMeta.
 *
 * Splits at paragraph boundaries when the buffer reaches maxTokens.
 * Merges trailing windows shorter than minTokens into the predecessor.
 */
export function walkToChunks(root: DocNode, opts: WalkOptions): ChunkResult[] {
  const maxTokens = opts.maxTokens ?? 512;
  const minTokens = opts.minTokens ?? Math.floor(maxTokens / 4);
  const documentOutline = extractOutline(root);
  const segments = walkDocNode(root);

  if (segments.length === 0) return [];

  // Build windows: accumulate segments until maxTokens is reached.
  type Window = {
    texts: string[];
    byteStart: number;
    byteEnd: number;
    lineStart?: number;
    lineEnd?: number;
    pageStart?: number;
    pageEnd?: number;
    breadcrumb: string[];
    lang?: string;
    codeLanguage?: string;
    truncated: boolean;
  };

  const windows: Window[] = [];
  let current: Window = {
    texts: [],
    byteStart: segments[0]!.attrs.byteStart,
    byteEnd: segments[0]!.attrs.byteEnd,
    breadcrumb: segments[0]!.breadcrumb,
    truncated: false,
  };
  let currentTokens = 0;

  for (const seg of segments) {
    const segTokens = estimateTokens(seg.text);

    // If adding this segment would overflow and we already have content, flush.
    if (currentTokens > 0 && currentTokens + segTokens > maxTokens) {
      windows.push(current);
      current = {
        texts: [],
        byteStart: seg.attrs.byteStart,
        byteEnd: seg.attrs.byteEnd,
        breadcrumb: seg.breadcrumb,
        truncated: false,
      };
      currentTokens = 0;
    }

    // If a single segment exceeds maxTokens, hard-cut it.
    if (segTokens > maxTokens) {
      const maxChars = maxTokens * CHARS_PER_TOKEN;
      current.texts.push(seg.text.slice(0, maxChars));
      current.byteEnd = seg.attrs.byteEnd;
      current.truncated = true;
      windows.push(current);
      current = {
        texts: [],
        byteStart: seg.attrs.byteEnd,
        byteEnd: seg.attrs.byteEnd,
        breadcrumb: seg.breadcrumb,
        truncated: false,
      };
      currentTokens = 0;
      continue;
    }

    current.texts.push(seg.text);
    current.byteEnd = seg.attrs.byteEnd;
    if (current.lineStart == null && seg.attrs.lineStart != null) current.lineStart = seg.attrs.lineStart;
    if (seg.attrs.lineEnd != null) current.lineEnd = seg.attrs.lineEnd;
    if (current.pageStart == null && seg.attrs.pageNumber != null) current.pageStart = seg.attrs.pageNumber;
    if (seg.attrs.pageNumber != null) current.pageEnd = seg.attrs.pageNumber;
    if (!current.lang && seg.attrs.lang) current.lang = seg.attrs.lang;
    if (!current.codeLanguage && seg.attrs.codeLanguage) current.codeLanguage = seg.attrs.codeLanguage;
    currentTokens += segTokens;
  }

  if (current.texts.length > 0) {
    windows.push(current);
  }

  // Merge trailing window into predecessor if it is below minTokens.
  if (windows.length > 1) {
    const last = windows[windows.length - 1]!;
    const lastTokens = estimateTokens(last.texts.join("\n\n"));
    if (lastTokens < minTokens) {
      const prev = windows[windows.length - 2]!;
      prev.texts.push(...last.texts);
      prev.byteEnd = last.byteEnd;
      prev.lineEnd = last.lineEnd;
      prev.pageEnd = last.pageEnd;
      windows.pop();
    }
  }

  const totalChunks = windows.length;

  return windows.map((win, i) => {
    const content = win.texts.join("\n\n");
    const meta: ChunkMeta = {
      sourceFile: opts.sourceFile,
      sourceFormat: opts.sourceFormat,
      byteStart: win.byteStart,
      byteEnd: win.byteEnd,
      lineStart: win.lineStart,
      lineEnd: win.lineEnd,
      pageStart: win.pageStart,
      pageEnd: win.pageEnd,
      breadcrumb: win.breadcrumb,
      sectionTitle: win.breadcrumb.at(-1),
      headingLevel: win.breadcrumb.length > 0 ? win.breadcrumb.length : undefined,
      documentOutline,
      lang: win.lang,
      codeLanguage: win.codeLanguage,
      strategy: opts.strategy,
      chunkIndex: i,
      totalChunks,
      estimatedTokens: estimateTokens(content),
      truncated: win.truncated,
      ...(opts.fileHash ? { fileHash: opts.fileHash } : {}),
      ...(opts.fileSizeBytes != null ? { fileSizeBytes: opts.fileSizeBytes } : {}),
      ...(opts.fileModifiedAt ? { fileModifiedAt: opts.fileModifiedAt } : {}),
    };

    return {
      content,
      metadata: meta,
      sourceFile: opts.sourceFile,
      commitHash: opts.commitHash,
    };
  });
}
