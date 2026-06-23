import type { DocNode } from "@vivantel/virage-chunker-ce-ast";
import { createRequire } from "module";
import { platform, arch } from "process";

const require = createRequire(import.meta.url);

const PLATFORM_PACKAGES: Record<string, string> = {
  "linux-x64":   "@vivantel/virage-chunker-ce-md-linux-x64-gnu",
  "linux-arm64": "@vivantel/virage-chunker-ce-md-linux-arm64-gnu",
  "darwin-x64":  "@vivantel/virage-chunker-ce-md-darwin-x64",
  "darwin-arm64":"@vivantel/virage-chunker-ce-md-darwin-arm64",
  "win32-x64":   "@vivantel/virage-chunker-ce-md-win32-x64-msvc",
};

let _parseMdNative: ((src: string) => string) | undefined;

function loadNative(): (src: string) => string {
  if (_parseMdNative) return _parseMdNative;

  // Local dev build (npx napi build --release places binary next to dist/)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const binding = require("./virage_chunker_ce_md.node") as any;
    _parseMdNative = binding.parseMd as (src: string) => string;
    return _parseMdNative!;
  } catch { /* not present — fall through to platform stub */ }

  // Installed platform stub (optionalDependency resolved by npm/pnpm/yarn)
  const stubPkg = PLATFORM_PACKAGES[`${platform}-${arch}`];
  if (stubPkg) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const binding = require(stubPkg) as any;
      _parseMdNative = binding.parseMd as (src: string) => string;
      return _parseMdNative!;
    } catch { /* stub not installed */ }
  }

  const hint = stubPkg ? `  npm install ${stubPkg}\n` : "";
  throw new Error(
    `[@vivantel/virage-chunker-ce-md] Native binary not found for ${platform}-${arch}.\n` +
    hint +
    "Or compile from source: npx napi build --release",
  );
}

export function parseMd(src: string): DocNode {
  const fn_ = loadNative();
  const json = fn_(src);
  return JSON.parse(json) as DocNode;
}
