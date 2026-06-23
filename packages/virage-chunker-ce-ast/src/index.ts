export type { DocNode, DocNodeType, DocNodeAttrs, ChunkMeta } from "./types.js";
export { walkDocNode } from "./ast-walker.js";
export type { TextSegment } from "./ast-walker.js";
export { extractOutline } from "./outline.js";
export { walkToChunks } from "./chunker.js";
export type { WalkOptions, ChunkResult } from "./chunker.js";
