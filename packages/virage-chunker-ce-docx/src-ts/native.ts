import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let _parseDocxNative: ((buf: Buffer) => string) | undefined;

function loadNative(): (buf: Buffer) => string {
  if (_parseDocxNative) return _parseDocxNative;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binding = require("./virage_chunker_ce_docx.node") as any;
    _parseDocxNative = binding.parseDocx as (buf: Buffer) => string;
    return _parseDocxNative!;
  } catch {
    throw new Error(
      "[@vivantel/virage-chunker-ce-docx] Native binary not found.\n" +
        "Install one of the optional platform packages, e.g.:\n" +
        "  npm install @vivantel/virage-chunker-ce-docx-linux-x64-gnu\n" +
        "Or run `npx napi build --release` to compile from source.",
    );
  }
}

export function parseDocx(buf: Buffer): DocNode {
  const fn_ = loadNative();
  const json = fn_(buf);
  return JSON.parse(json) as DocNode;
}
