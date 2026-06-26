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

/** Returned by every native chunker binding. Rust reads the file, computes
 *  the SHA-256 hash, and returns all four fields so JS never holds the file
 *  bytes. */
export interface ParseResult {
  tree: string;
  hash: string;
  size: number;
  modifiedMs: number;
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
  loadBinding: () => Record<string, (...args: unknown[]) => unknown>;
  /**
   * Invoke the correct function on the already-loaded binding, passing the
   * file path. Rust reads the file and returns a ParseResult — no file data
   * crosses the JS/Rust boundary.
   */
  callNative: (
    binding: ReturnType<NativeChunkerDef<TOptions>["loadBinding"]>,
    filePath: string,
    opts: TOptions,
  ) => ParseResult;
  /** Format-specific WalkOptions defaults. Spread before user opts so user opts win. */
  extraWalkOpts?: (opts: TOptions) => Partial<WalkOptions>;
  /** Optional post-walk hook for format-specific enrichment (XLSX cell refs, etc.). */
  enrich?: (sets: ArtifactSet[], docNode: DocNode, opts: TOptions) => ArtifactSet[];
}

/**
 * Factory that eliminates boilerplate common to every native-binary chunker:
 * lazy binding load, walkToChunks, and optional enrich hook.
 * File I/O and hashing happen inside Rust via callNative.
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
        const binding = getBinding();
        const result = def.callNative(binding, filePath, resolvedOpts);
        const docNode = JSON.parse(result.tree) as DocNode;

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
          fileHash: result.hash,
          fileSizeBytes: result.size,
          fileModifiedAt: new Date(result.modifiedMs).toISOString(),
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
