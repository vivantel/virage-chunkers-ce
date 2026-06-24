import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { minimatch } from "minimatch";
import type { ArtifactSet, ArtifactChunker, DocNode } from "./types.js";
import { walkToChunks } from "./chunker.js";
import type { WalkOptions } from "./chunker.js";

export interface BaseOptions {
  maxTokens?: number;
  minTokens?: number;
  overlap?: number;
  boundaryPadding?: { before?: number; after?: number };
  adaptiveSize?: boolean;
  recursive?: boolean;
  ignore?: string[];
}

export interface NativeChunkerDef<TOptions extends BaseOptions> {
  /** npm package name, used as the `strategy` field in ArtifactSet. */
  name: string;
  /** "pdf" | "md" | "docx" | "xlsx" etc. — becomes `sourceFormat`. */
  sourceFormat: string;
  /** Glob patterns this chunker accepts, e.g. ["**\/*.pdf"]. */
  patterns: string[];
  /**
   * Return the native napi binding object. Called at most once per chunker
   * instance (lazily, on the first `chunk()` call).
   */
  loadBinding: () => Record<string, (...args: unknown[]) => string>;
  /**
   * Invoke the correct function on the already-loaded binding.
   * Must return a JSON-encoded DocNode string.
   */
  callNative: (
    binding: ReturnType<NativeChunkerDef<TOptions>["loadBinding"]>,
    buf: Buffer,
    opts: TOptions,
  ) => string;
  /** Format-specific WalkOptions defaults. Spread before user opts so user opts win. */
  extraWalkOpts?: (opts: TOptions) => Partial<WalkOptions>;
  /** Optional post-walk hook for format-specific enrichment (XLSX cell refs, etc.). */
  enrich?: (sets: ArtifactSet[], docNode: DocNode, opts: TOptions) => ArtifactSet[];
}

/**
 * Factory that eliminates boilerplate common to every native-binary chunker:
 * file read, sha256 hash, lazy native binding load, walkToChunks call, and
 * optional enrich hook.
 *
 * Usage:
 *   export const createChunker = createNativeChunker<MyOptions>({ ... });
 */
export function createNativeChunker<TOptions extends BaseOptions>(
  def: NativeChunkerDef<TOptions>,
): (opts?: TOptions) => ArtifactChunker {
  return (opts?: TOptions): ArtifactChunker => {
    const resolvedOpts = (opts ?? {}) as TOptions;
    const ignore = resolvedOpts.ignore ?? [];
    let _binding: ReturnType<NativeChunkerDef<TOptions>["loadBinding"]> | null = null;

    function getBinding() {
      if (_binding == null) {
        _binding = def.loadBinding();
      }
      return _binding;
    }

    return {
      name: def.name,
      patterns: def.patterns,

      async chunk(filePath: string, commitHash: string): Promise<ArtifactSet[]> {
        const [buf, stats] = await Promise.all([readFile(filePath), stat(filePath)]);
        const fileHash = createHash("sha256").update(buf).digest("hex");
        const binding = getBinding();
        const raw = def.callNative(binding, buf, resolvedOpts);
        const docNode = JSON.parse(raw) as DocNode;

        // extraWalkOpts provides format-specific defaults; explicit user opts
        // override them; required fields are always set last.
        const extra = def.extraWalkOpts ? def.extraWalkOpts(resolvedOpts) : {};
        const sets = walkToChunks(docNode, {
          ...extra,
          ...(resolvedOpts.maxTokens != null
            ? { maxTokens: resolvedOpts.maxTokens }
            : {}),
          ...(resolvedOpts.minTokens != null
            ? { minTokens: resolvedOpts.minTokens }
            : {}),
          ...(resolvedOpts.overlap != null
            ? { overlap: resolvedOpts.overlap }
            : {}),
          ...(resolvedOpts.boundaryPadding != null
            ? { boundaryPadding: resolvedOpts.boundaryPadding }
            : {}),
          ...(resolvedOpts.adaptiveSize != null
            ? { adaptiveSize: resolvedOpts.adaptiveSize }
            : {}),
          ...(resolvedOpts.recursive != null
            ? { recursive: resolvedOpts.recursive }
            : {}),
          sourceFile: filePath,
          sourceFormat: def.sourceFormat,
          commitHash,
          strategy: def.name,
          fileHash,
          fileSizeBytes: stats.size,
          fileModifiedAt: stats.mtime.toISOString(),
        });

        return def.enrich ? def.enrich(sets, docNode, resolvedOpts) : sets;
      },

      async canProcess(filePath: string): Promise<boolean> {
        if (ignore.some((p) => minimatch(filePath, p, { matchBase: true }))) {
          return false;
        }
        return def.patterns.some((p) =>
          minimatch(filePath, p, { matchBase: true }),
        );
      },
    };
  };
}
