#!/usr/bin/env python3
"""Generate the indicator and strategy scripts from the shared core.

The core holds all logic once. Blocks fenced by
    // ==== BEGIN IND  …  // ==== END IND
    // ==== BEGIN STRAT …  // ==== END STRAT
are kept only in the matching output, so both files stay in sync.

Usage: python3 gold-sniper/build.py
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
CORE = ROOT / "src" / "GoldSniper_core.pine"
OUTPUTS = {
    "IND": ROOT / "GoldSniper_Indicator.pine",
    "STRAT": ROOT / "GoldSniper_Strategy.pine",
}
MARKER = re.compile(r"^\s*// ==== (BEGIN|END) (IND|STRAT)\s*$")


def render(lines, keep):
    out, skipping = [], None
    for line in lines:
        m = MARKER.match(line)
        if m:
            edge, block = m.groups()
            if edge == "BEGIN":
                if skipping is not None:
                    raise SystemExit(f"nested marker: {line!r}")
                skipping = block != keep
            else:
                skipping = None
            continue
        if not skipping:
            out.append(line)
    if skipping is not None:
        raise SystemExit("unterminated marker block")
    return "".join(out)


def main():
    lines = CORE.read_text(encoding="utf-8").splitlines(keepends=True)
    for keep, path in OUTPUTS.items():
        path.write_text(render(lines, keep), encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
