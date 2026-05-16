"""
Build heilmittel-catalog.json from the KBV Diagnoseliste raw text.

One-shot build script. Re-run when the KBV publishes a new edition:
  python build-catalog.py

Output: heilmittel-catalog.json with two top-level keys:
  - "lhb_bvb": ICD-10 → { diagnosegruppen: [..], physio: bool, ergo: bool,
                          stimm: bool, hinweis: str|null, raw: str }
  - "blanko_physio_shoulder": ICD-10 → { diagnosegruppe: "EX",
                          diagnose: str, second_icd: str|null }

Design notes:
- Source text is not perfectly structured (PDF→text conversion artifacts).
- Parser uses pattern matching, not strict columns — easier to maintain.
- "längstens X nach Akutereignis" specs propagate to the ICDs they govern.
"""

import json
import re
import os
from pathlib import Path

ROOT = Path(__file__).parent
SOURCE = ROOT / 'data' / 'diagnoseliste-raw.txt'
OUTPUT = ROOT / 'heilmittel-catalog.json'

# ICD-10-GM code pattern: letter + 2 digits + optional .digits
ICD_RE = re.compile(r'^([A-Z]\d{2}(?:\.\d{1,3})?(?:[*-])?)\s+(.+)$')

# Diagnosegruppe abbreviations from G-BA Heilmittelkatalog (physio).
# Multiple groups separated by "/", e.g. "WS/EX/AT".
DG_PHYSIO = {'WS', 'EX', 'ZN', 'PN', 'AT', 'LY', 'CS', 'GE', 'SO1', 'SO2', 'SO3', 'SO4'}
# Ergo:
DG_ERGO = {'EN1', 'EN2', 'EN3', 'SB1', 'SB2', 'SB3', 'PS1', 'PS2', 'PS3', 'PS4'}
# Stimm/Sprech/Sprach/Schluck:
DG_STIMM = {'SC', 'ST1', 'ST2', 'SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'SP6', 'RE1', 'RE2', 'SF'}

ALL_DG = DG_PHYSIO | DG_ERGO | DG_STIMM


def split_groups(token):
    """Split 'WS/EX/AT' → ['WS', 'EX', 'AT'], keeping only known DGs."""
    parts = [p.strip() for p in token.split('/') if p.strip()]
    return [p for p in parts if p in ALL_DG]


def classify(groups):
    """Return (has_physio, has_ergo, has_stimm)."""
    s = set(groups)
    return (
        bool(s & DG_PHYSIO),
        bool(s & DG_ERGO),
        bool(s & DG_STIMM)
    )


def parse_lhb_bvb_section(lines):
    """
    Parse pages 5-21 (LHB + BVB indication list).
    Strategy: scan line-by-line, accumulate a 'context' of the most recently
    seen Diagnosegruppen + Hinweis. When we hit an ICD line, snapshot context.
    """
    out = {}
    current_dg = None
    current_hinweis_parts = []
    # We need to look in a sliding window of nearby lines because PDF→text
    # often breaks Diagnosegruppe tokens onto separate lines from their ICDs.

    # Build a compact view: each ICD with the 8 lines around it.
    for i, raw in enumerate(lines):
        line = raw.strip()
        if not line:
            continue

        # Find Diagnosegruppe tokens anywhere in this or the next 5 lines.
        # Token = letters+optional digit, separated by /
        window = ' '.join(l.strip() for l in lines[max(0, i-2):i+6])

        # Find candidate group tokens — patterns like "WS/EX" or "EN1/SB3" or "ZN"
        dg_tokens = []
        for m in re.finditer(r'\b([A-Z]{2,3}\d?(?:/[A-Z]{2,3}\d?)*)\b', window):
            cand = m.group(1)
            groups = split_groups(cand)
            if groups:
                dg_tokens.extend(groups)
        dg_tokens = list(dict.fromkeys(dg_tokens))  # de-dup, preserve order

        # Find Hinweis if present in window
        hinweis = None
        m = re.search(r'(längstens\s+\d+\s*\w+\s+nach\s+\w+|nur\s+chronisch[^.]*|nur\s+bei[^.]*)',
                      window, re.IGNORECASE)
        if m:
            hinweis = re.sub(r'\s+', ' ', m.group(1)).strip()

        # ICD match (line must START with code)
        icd_match = re.match(r'^([A-Z]\d{2}(?:\.\d{1,3})?)\s+(.+?)$', line)
        if not icd_match:
            continue
        code = icd_match.group(1)
        diagnose = icd_match.group(2).strip()

        # Filter trivial / table-header lines
        if len(diagnose) < 3 or diagnose.startswith('ICD-10'):
            continue

        # If we already saw this code, don't overwrite (first occurrence wins)
        if code in out:
            continue

        if not dg_tokens:
            continue  # skip ICDs we can't map to any group

        physio, ergo, stimm = classify(dg_tokens)
        out[code] = {
            'diagnosegruppen': dg_tokens,
            'physio': physio,
            'ergo': ergo,
            'stimm': stimm,
            'hinweis': hinweis,
            'diagnose': diagnose[:200]
        }
    return out


def parse_blanko_section(text):
    """
    Parse the Blanko Physiotherapy shoulder section.
    Lines look like: 'M13.11 EX Monarthritis, anderenorts...'
    Or with secondary ICD: 'M24.41 Z98.88 EX Habituelle Luxation...'
    """
    out = {}
    # The section starts after "PHYSIOTHERAPIE AB 1. NOVEMBER 2024" marker.
    start = text.find('PHYSIOTHERAPIE AB 1.  NOVEMBER 2024')
    if start < 0:
        start = text.find('PHYSIOTHERAPIE AB 1. NOVEMBER 2024')
    if start < 0:
        return out
    section = text[start:]

    # Pattern: ICD [secondary ICD] EX diagnose-text
    line_re = re.compile(
        r'^([A-Z]\d{2}(?:\.[\d\-]+)?)\s+(?:([A-Z]\d{2}(?:\.\d+)?)\s+)?EX\s+(.+?)$',
        re.MULTILINE
    )
    for m in line_re.finditer(section):
        code = m.group(1)
        second = m.group(2)
        diagnose = re.sub(r'\s+', ' ', m.group(3)).strip()[:200]
        if code in out:
            continue
        out[code] = {
            'diagnosegruppe': 'EX',
            'diagnose': diagnose,
            'second_icd': second
        }
    return out


def main():
    text = SOURCE.read_text(encoding='utf-8')
    lines = text.split('\n')

    # Find the start/end boundaries of each major section
    # Section header has DOUBLE space ("2.  BLANKOVERORDNUNG"); TOC has SINGLE.
    blanko_start_line = next(
        (i for i, l in enumerate(lines) if '2.  BLANKOVERORDNUNG' in l),
        len(lines)
    )

    lhb_bvb = parse_lhb_bvb_section(lines[:blanko_start_line])
    blanko = parse_blanko_section('\n'.join(lines[blanko_start_line:]))

    catalog = {
        '_meta': {
            'source': 'KBV Diagnoseliste — Langfristiger Heilmittelbedarf / Besonderer Verordnungsbedarf / Blankoverordnung',
            'edition': 'Stand 1. Januar 2026',
            'generated_at_utc': None,  # filled by build process
            'lhb_bvb_count': len(lhb_bvb),
            'blanko_physio_shoulder_count': len(blanko)
        },
        'lhb_bvb': lhb_bvb,
        'blanko_physio_shoulder': blanko
    }

    import datetime
    catalog['_meta']['generated_at_utc'] = datetime.datetime.utcnow().isoformat() + 'Z'

    OUTPUT.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False),
        encoding='utf-8'
    )
    print(f'Wrote {OUTPUT}')
    print(f'  LHB/BVB entries: {len(lhb_bvb)}')
    print(f'  Blanko physio shoulder entries: {len(blanko)}')


if __name__ == '__main__':
    main()
