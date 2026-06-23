import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let _parseLatexNative: ((src: string) => string) | undefined;

function loadNative(): (src: string) => string {
  if (_parseLatexNative) return _parseLatexNative;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binding = require("./virage_chunker_ce_latex.node") as any;
    _parseLatexNative = binding.parseLatex as (src: string) => string;
    return _parseLatexNative!;
  } catch {
    throw new Error(
      "[@vivantel/virage-chunker-ce-latex] Native binary not found.\n" +
        "Install one of the optional platform packages, e.g.:\n" +
        "  npm install @vivantel/virage-chunker-ce-latex-linux-x64-gnu\n" +
        "Or run `npx napi build --release` to compile from source.",
    );
  }
}

export function parseLatex(src: string): DocNode {
  const fn_ = loadNative();
  const json = fn_(src);
  return JSON.parse(json) as DocNode;
}
