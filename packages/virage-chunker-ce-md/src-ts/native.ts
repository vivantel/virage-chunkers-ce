import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

let _parseMdNative: ((src: string) => string) | undefined;

function loadNative(): (src: string) => string {
  if (_parseMdNative) return _parseMdNative;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binding = require("./virage_chunker_ce_md.node") as any;
    _parseMdNative = binding.parseMd as (src: string) => string;
    return _parseMdNative!;
  } catch {
    throw new Error(
      "[@vivantel/virage-chunker-ce-md] Native binary not found.\n" +
        "Install one of the optional platform packages, e.g.:\n" +
        "  npm install @vivantel/virage-chunker-ce-md-linux-x64-gnu\n" +
        "Or run `npx napi build --release` to compile from source.",
    );
  }
}

export function parseMd(src: string): DocNode {
  const fn_ = loadNative();
  const json = fn_(src);
  return JSON.parse(json) as DocNode;
}
