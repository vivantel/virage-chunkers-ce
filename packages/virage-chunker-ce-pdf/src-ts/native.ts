import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let _parsePdfNative: ((buf: Buffer) => string) | undefined;

function loadNative(): (buf: Buffer) => string {
  if (_parsePdfNative) return _parsePdfNative;

  // napi-rs places the compiled .node binary next to this file.
  // In CI it arrives via optionalDependencies platform stubs.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binding = require("./virage_chunker_ce_pdf.node") as any;
    _parsePdfNative = binding.parsePdf as (buf: Buffer) => string;
    return _parsePdfNative!;
  } catch {
    throw new Error(
      "[@vivantel/virage-chunker-ce-pdf] Native binary not found.\n" +
        "Install one of the optional platform packages, e.g.:\n" +
        "  npm install @vivantel/virage-chunker-ce-pdf-linux-x64-gnu\n" +
        "Or run `npx napi build --release` to compile from source.",
    );
  }
}

/** Parse a PDF buffer and return the ViDoc AST root node. */
export function parsePdf(buf: Buffer): DocNode {
  const fn_ = loadNative();
  const json = fn_(buf);
  return JSON.parse(json) as DocNode;
}
