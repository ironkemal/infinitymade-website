#!/usr/bin/env python3
"""
Deterministic block-parser for the KBV Diagnoseliste (Anlage 2 HeilM-RL,
§ 32 Abs. 1a / § 106b Abs. 2 S. 4 / § 125a SGB V).

Reads:  wissensbank/gemeinsam/heilmittel-richtlinie/heilmittel-diagnoseliste.txt
        (fallback: api-backend/ai/validators/data/diagnoseliste-raw.txt)
Writes: api-backend/ai/validators/heilmittel-catalog.json

Runtime JS only loads heilmittel-catalog.json (never wissensbank/).
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import re

VALIDATORS_DIR = Path(__file__).resolve().parent
REPO_ROOT = VALIDATORS_DIR.parents[2]
WISSENSBANK_SOURCE = (
    REPO_ROOT
    / 'wissensbank'
    / 'gemeinsam'
    / 'heilmittel-richtlinie'
    / 'heilmittel-diagnoseliste.txt'
)
FALLBACK_SOURCE = VALIDATORS_DIR / 'data' / 'diagnoseliste-raw.txt'
OUTPUT = VALIDATORS_DIR / 'heilmittel-catalog.json'

DG_PHYSIO = {
    'WS', 'EX', 'ZN', 'PN', 'AT', 'LY', 'CS', 'GE',
    'SO1', 'SO2', 'SO3', 'SO4',
}
DG_ERGO = {'EN1', 'EN2', 'EN3', 'SB1', 'SB2', 'SB3', 'PS1', 'PS2', 'PS3', 'PS4'}
DG_STIMM = {
    'SC', 'ST1', 'ST2', 'SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'SP6',
    'RE1', 'RE2', 'SF',
}
ALL_DG = DG_PHYSIO | DG_ERGO | DG_STIMM

_DG_ALT = '|'.join(sorted(ALL_DG, key=len, reverse=True))
DG_TOKEN_RE = re.compile(
    rf'(?<![A-Za-zÄÖÜäöüß0-9/])(?:{_DG_ALT})(?:/(?:{_DG_ALT}))*/?(?![A-Za-zÄÖÜäöüß0-9])'
)
ICD_CODE_RE = r'[A-Z]\d{2}(?:\.(?:\d+|-))?(?:\s*-|\*)?'
ICD_LINE_RE = re.compile(rf'^({ICD_CODE_RE})(?:\s+({ICD_CODE_RE}))?(?:\s+(.*))?$')
PURE_ICD_RE = re.compile(rf'^{ICD_CODE_RE}$')
GLUED_ICD_RE = re.compile(rf'^(.+?[^\s])({ICD_CODE_RE}(?:\s+.*|$))$')

# Column headers and page furniture repeated at PDF page breaks
SECTION1_SKIP_EXACT = {
    'DIAGNOSEGRUPPE',
    '1.',
    '2.',
    'ICD-10',
    'DIAGNOSE PHYSIO-',
    'THERAPIE',
    'ERGO-',
    'STIMM-,',
    'SPRECH-, SPRACH-,',
    'SCHLUCKTHERAPIE',
    'HINWEIS/',
    'SPEZIFIKATION',
    'ERNÄHRUNGS-',
}
SECTION1_SKIP_PREFIXES = (
    '========== PAGE ',
    'Langfristiger Heilmittelbedarf',
    '1. ICD-10',
    '*redaktionelle Anpassung',
)

# Group headings without trailing ':' in Section 1 source text
UNCOLONED_GROUP_HEADERS = (
    'Verlust von oberen und unteren Extremi',
    'Systemkrankheiten des Bindegewebes',
)

HINWEIS_START_PREFIXES = (
    'längstens ',
    'ab vollendetem',
    'bis zum vollende',
    'nur im Zusammen',
    'nur bei ',
    'nur chronisch',
    'Voraussetzung für',
    'Skoliose ',
    'fixierte Kyphose',
    'ab 50°',
    'ab Gesamtkypho',
    'Wachkoma',
    'Folgen einer Ver',
    'bösartige Neubil',
    'Unter Einbindung',
    'Hinweis:',
)

BURN_DIAG_PREFIXES = ('Verbrennung ', 'Verbrennungen ', 'Verätzung ', 'Verätzungen ')


def resolve_source() -> Path:
    """Return official wissensbank source when present, else bundled fallback."""
    if WISSENSBANK_SOURCE.exists():
        return WISSENSBANK_SOURCE
    if FALLBACK_SOURCE.exists():
        return FALLBACK_SOURCE
    raise FileNotFoundError(
        f'Neither {WISSENSBANK_SOURCE} nor {FALLBACK_SOURCE} exists'
    )


def normalize_spaces(text: str) -> str:
    """Normalize NBSP and collapse repeated whitespace inside one line."""
    return ' '.join(text.replace('\xa0', ' ').split())


def normalize_icd(code: str) -> str:
    """Normalize PDF spacing like 'G35.1 -' -> 'G35.1-' and 'C00 -' -> 'C00-'."""
    return re.sub(r'\s+-', '-', code.strip())


def join_german_lines(parts: list[str]) -> str:
    """Join wrapped German PDF lines while cleanly healing hyphenated word breaks."""
    cleaned = [normalize_spaces(p) for p in parts if normalize_spaces(p)]
    if not cleaned:
        return ''
    out = cleaned[0]
    for nxt in cleaned[1:]:
        # Keep genuine hyphens in wildcards/expressions or 'Foix-Alajouanine', comma compounds
        if out.endswith(' -') and re.match(r'^[a-zäöüß]', nxt):
            # e.g. 'ICD-10-Diagno -' + 'seschlüssel'
            out = out[:-2] + nxt
        elif (
            out.endswith('-')
            and not out.endswith((' -', '.-'))
            and not nxt.startswith(('und ', 'oder ', 'bzw.'))
        ):
            if nxt[0].islower():
                out = out[:-1] + nxt
            elif re.search(r'[A-Za-zÄÖÜäöüß]+-$', out) and out.endswith('Foix-'):
                out = out + nxt
            else:
                out = out + ' ' + nxt
        else:
            out = out + ' ' + nxt
    return normalize_spaces(out)


def clean_hinweis_text(parts: list[str] | str | None) -> str | None:
    """Join and normalize PDF hyphenation artifacts in Hinweis strings."""
    if not parts:
        return None
    if isinstance(parts, list):
        cleaned = join_german_lines(parts)
    else:
        cleaned = normalize_spaces(parts)
    # PDF soft-syllable artifacts in C00-C97 / E88.20
    for src, dst in (
        ('männli-che', 'männliche'),
        ('Kompressions-the-rapie', 'Kompressionstherapie'),
        ('Kompressions-therapie', 'Kompressionstherapie'),
        ('Übungs-be-handlung/Be-we-gungstherapie', 'Übungsbehandlung/Bewegungstherapie'),
        ('Übungs-behandlung/Be-wegungstherapie', 'Übungsbehandlung/Bewegungstherapie'),
        ('Übungs-be-handlung/Bewegungstherapie', 'Übungsbehandlung/Bewegungstherapie'),
        ('Übungsbehandlung/Be-wegungstherapie', 'Übungsbehandlung/Bewegungstherapie'),
    ):
        cleaned = cleaned.replace(src, dst)
    return cleaned or None


def split_columns(line: str) -> tuple[str, list[str], bool, str]:
    """Split a line into (left_text, dg_tokens, ends_with_slash, hinweis_part)."""
    matches = list(DG_TOKEN_RE.finditer(line))
    if not matches:
        return line, [], False, ''

    left_text = line[: matches[0].start()].strip()
    right_text = line[matches[-1].end() :].strip()
    dgs: list[str] = []
    ends_with_slash = False
    for m in matches:
        tok = m.group(0)
        ends_with_slash = tok.endswith('/')
        for part in tok.strip('/').split('/'):
            if part and part in ALL_DG:
                dgs.append(part)
    return left_text, dgs, ends_with_slash, right_text


def merge_dgs(base: list[str], extra: list[str]) -> list[str]:
    """Deduplicate Diagnosegruppen while preserving order."""
    return list(dict.fromkeys([*base, *extra]))


def build_lhb_entry(
    icd: str,
    diagnose: str,
    dgs: list[str],
    hinweis_parts: list[str] | None,
    second_icd: str | None = None,
) -> dict:
    """Create canonical LHB/BVB catalog entry dict."""
    return {
        'icd': icd,
        'diagnosegruppen': dgs,
        'physio': any(d in DG_PHYSIO for d in dgs),
        'ergo': any(d in DG_ERGO for d in dgs),
        'stimm': any(d in DG_STIMM for d in dgs),
        'hinweis': clean_hinweis_text(hinweis_parts),
        'diagnose': diagnose,
        'second_icd': second_icd,
    }


def preprocess_section1(raw_lines: list[str]) -> list[str]:
    """Extract, normalize, and de-glue Section 1 lines."""
    start_idx = next(
        i for i, l in enumerate(raw_lines) if 'KRANKHEITEN UND VERLETZUNGEN DES NERVENSYSTEMS' in l
    )
    end_idx = next(
        i for i in range(start_idx, len(raw_lines)) if normalize_spaces(raw_lines[i]) == 'TIPP'
    )

    filtered: list[str] = []
    skip_sas_block = False
    for raw in raw_lines[start_idx:end_idx]:
        s = normalize_spaces(raw)
        if not s:
            continue
        if s in SECTION1_SKIP_EXACT or s.startswith(SECTION1_SKIP_PREFIXES):
            continue
        if s.startswith('Seltene angeborene Stoffwechselerkran'):
            skip_sas_block = True
            continue
        if skip_sas_block:
            if s.startswith('E84.-'):
                skip_sas_block = False
            else:
                continue
        if s.startswith('E84.-'):
            s = re.sub(r'\s+CF\b', '', s)
        filtered.append(s)

    # Combine 'C00 -' + 'C97' -> 'C00-C97' before ICD splitting
    merged: list[str] = []
    i = 0
    while i < len(filtered):
        if (
            filtered[i] == 'C00 -'
            and i + 1 < len(filtered)
            and filtered[i + 1] == 'C97'
        ):
            merged.append('C00-C97')
            i += 2
            continue
        merged.append(filtered[i])
        i += 1

    # Split PDF-glued ICDs, skipping literal S06.* references inside T90.5 Hinweis
    out: list[str] = []
    in_t90_hinweis = False
    for line in merged:
        if line.startswith('T90.5 '):
            in_t90_hinweis = True
        elif in_t90_hinweis and line.isupper() and len(line) > 8:
            in_t90_hinweis = False

        if not in_t90_hinweis:
            m = GLUED_ICD_RE.match(line)
            if m and not line.startswith(('C00-',)):
                # Avoid splitting range/text strings; glued lines all end before ICD start
                out.append(m.group(1).strip())
                out.append(m.group(2).strip())
                continue
        out.append(line)

    return out


def is_chapter_heading(line: str, dgs: list[str]) -> bool:
    """Uppercase section separator like 'GERIATRISCHE SYNDROME'."""
    if dgs:
        return False
    letters = [ch for ch in line if ch.isalpha()]
    return len(letters) > 5 and line == line.upper() and not ICD_LINE_RE.match(line)


def looks_like_hinweis_line(text: str) -> bool:
    return text.startswith(HINWEIS_START_PREFIXES)


def is_icd_row_start(line: str, in_t90_s06_ref: bool) -> bool:
    """True when line starts with a primary ICD code belonging to the table."""
    if in_t90_s06_ref and line.startswith(('S06.0', 'S06.9', 'S06.-')):
        return False
    return bool(ICD_LINE_RE.match(line) or line == 'C00-C97')


def looks_like_group_header_start(lines: list[str], idx: int, in_t90_s06: bool) -> bool:
    """Detect whether non-ICD line idx opens a Group Heading (e.g. 'Hereditäre Ataxie:')."""
    line = lines[idx]
    left, _, _, _ = split_columns(line)
    if not left or is_icd_row_start(left, in_t90_s06) or looks_like_hinweis_line(left):
        return False
    if left.startswith(UNCOLONED_GROUP_HEADERS):
        return True
    if left.endswith(':'):
        # Ignore internal 'Hinweis:' inside T90.5
        return not left.startswith('Hinweis:')
    # Multi-line group headings always start with an uppercase multi-word medical phrase
    if not left[0].isupper() or len(left.split()) < 2:
        return False
    # Look ahead up to 2 lines for wrapped heading ending in ':' before any ICD/chapter/hinweis
    for offset in range(1, 3):
        if idx + offset >= len(lines):
            break
        nxt = lines[idx + offset]
        nxt_left, nxt_dgs, _, _ = split_columns(nxt)
        if not nxt_left:
            break
        if is_chapter_heading(nxt, nxt_dgs) or is_icd_row_start(nxt, False):
            return False
        if looks_like_hinweis_line(nxt_left):
            return False
        if nxt_left.endswith(':'):
            return not nxt_left.startswith('Hinweis:')
    return False


def parse_section1(raw_lines: list[str]) -> tuple[dict, int]:
    """Parse Section 1 into a map of primary ICD -> entry and total ICD rows parsed."""
    lines = preprocess_section1(raw_lines)
    rows: list[dict] = []

    group_dgs: list[str] | None = None
    group_hinweis: list[str] = []
    # For groups whose heading DGs spill onto first child rows (e.g. C70.0..C70.9)
    group_dg_open = False
    group_has_own_dgs = False
    group_rows: list[dict] = []

    def sync_group_rows() -> None:
        if not group_dgs:
            return
        for gr in group_rows:
            gr['dgs'] = list(group_dgs)
            if group_hinweis and not gr['hinweis_parts']:
                gr['hinweis_parts'] = list(group_hinweis)

    # Current row or stacked block being built
    active: dict | None = None
    sibling_dgs: list[str] | None = None
    sibling_hinweis: list[str] = []
    sibling_overrides_group = False
    unassigned_rows: list[dict] = []
    diag_phase_open = False
    hinweis_phase_open = False
    dg_open = False
    in_t90_s06 = False

    def finalize_entry(row: dict, dgs: list[str], hinweis_parts: list[str]) -> None:
        row['dgs'] = merge_dgs(row['dgs'], dgs)
        if hinweis_parts and not row['hinweis_parts']:
            row['hinweis_parts'] = list(hinweis_parts)

    def commit_active() -> None:
        nonlocal active, sibling_dgs, sibling_hinweis, sibling_overrides_group
        nonlocal diag_phase_open, hinweis_phase_open, dg_open
        if not active:
            return
        if active['dgs']:
            # Assign active's DGs+Hinweis backward to unassigned sibling rows if any
            if unassigned_rows and not (group_dgs and group_has_own_dgs):
                for u in unassigned_rows:
                    finalize_entry(u, active['dgs'], active['hinweis_parts'])
                unassigned_rows.clear()
            sibling_dgs = list(active['dgs'])
            sibling_hinweis = list(active['hinweis_parts'])
            if group_dgs and group_has_own_dgs:
                sibling_overrides_group = True
            rows.append(active)
        elif active.get('is_s14_3_tail_partner'):
            # S14.4 sits on S14.3's trailing EN3 line and shares S14.3's cell
            finalize_entry(active, rows[-1]['dgs'], rows[-1]['hinweis_parts'])
            sibling_dgs = list(rows[-1]['dgs'])
            sibling_hinweis = list(rows[-1]['hinweis_parts'])
            sibling_overrides_group = True
            rows.append(active)
        elif sibling_overrides_group and sibling_dgs:
            if active['hinweis_parts'] and sibling_hinweis:
                active['hinweis_parts'] = [
                    join_german_lines(sibling_hinweis)
                    + '; '
                    + join_german_lines(active['hinweis_parts'])
                ]
            elif sibling_hinweis and not active['hinweis_parts']:
                active['hinweis_parts'] = list(sibling_hinweis)
            active['dgs'] = list(sibling_dgs)
            rows.append(active)
        elif group_dgs and group_has_own_dgs:
            # Inherits active group header DGs; keep any extra row-level hinweis (e.g. M80.3-)
            if active['hinweis_parts'] and group_hinweis:
                merged_h = [
                    join_german_lines(group_hinweis)
                    + '; '
                    + join_german_lines(active['hinweis_parts'])
                ]
                active['hinweis_parts'] = merged_h
            elif group_hinweis and not active['hinweis_parts']:
                active['hinweis_parts'] = list(group_hinweis)
            active['dgs'] = list(group_dgs)
            group_rows.append(active)
            rows.append(active)
        elif sibling_dgs and not unassigned_rows:
            if active['hinweis_parts'] and sibling_hinweis:
                active['hinweis_parts'] = [
                    join_german_lines(sibling_hinweis)
                    + '; '
                    + join_german_lines(active['hinweis_parts'])
                ]
            elif sibling_hinweis and not active['hinweis_parts']:
                active['hinweis_parts'] = list(sibling_hinweis)
            active['dgs'] = list(sibling_dgs)
            rows.append(active)
        else:
            unassigned_rows.append(active)
            rows.append(active)

        active = None
        diag_phase_open = False
        hinweis_phase_open = False
        dg_open = False

    def reset_block_state(clear_group: bool = True) -> None:
        nonlocal group_dgs, group_hinweis, group_dg_open, group_has_own_dgs
        nonlocal sibling_dgs, sibling_hinweis, sibling_overrides_group
        commit_active()
        unassigned_rows.clear()
        sibling_dgs = None
        sibling_hinweis = []
        sibling_overrides_group = False
        if clear_group:
            group_dgs = None
            group_hinweis = []
            group_dg_open = False
            group_has_own_dgs = False
            group_rows.clear()

    i = 0
    while i < len(lines):
        line = lines[i]
        left, dgs, ends_slash, right = split_columns(line)

        if active and active['icd'] == 'T90.5':
            in_t90_s06 = True
        elif in_t90_s06 and is_chapter_heading(line, dgs):
            in_t90_s06 = False

        # 0) Handle C00-C97 special range header line + next line 'Bösartige Neubildungen LY ...'
        if line == 'C00-C97':
            reset_block_state()
            i += 1
            nxt_left, nxt_dgs, nxt_slash, nxt_right = split_columns(lines[i])
            active = {
                'icd': 'C00-C97',
                'second_icd': None,
                'diag_parts': [nxt_left],
                'dgs': nxt_dgs,
                'hinweis_parts': [nxt_right] if nxt_right else [],
            }
            dg_open = nxt_slash
            hinweis_phase_open = bool(nxt_right)
            in_t90_s06 = False
            i += 1
            continue

        # 1) Detect stacked pure-ICD block (T20.3/T20.7, T21.3-..T29.7)
        if (
            PURE_ICD_RE.match(line)
            and i + 1 < len(lines)
            and (PURE_ICD_RE.match(lines[i + 1]) or lines[i + 1].startswith(BURN_DIAG_PREFIXES))
        ):
            reset_block_state()
            stacked_icds: list[str] = []
            while i < len(lines) and PURE_ICD_RE.match(lines[i]):
                stacked_icds.append(normalize_icd(lines[i]))
                i += 1
            stacked_diags: list[list[str]] = []
            while i < len(lines):
                _, l_dgs, _, _ = split_columns(lines[i])
                if l_dgs:
                    break
                if lines[i].startswith(BURN_DIAG_PREFIXES):
                    stacked_diags.append([lines[i]])
                elif stacked_diags:
                    stacked_diags[-1].append(lines[i])
                i += 1
            assert len(stacked_icds) == len(stacked_diags), (
                f'Stacked ICD/diagnosis count mismatch: {stacked_icds} vs {len(stacked_diags)}'
            )
            block_dgs: list[str] = []
            while i < len(lines):
                l_left, l_dgs, _, _ = split_columns(lines[i])
                if l_dgs and not l_left:
                    block_dgs = merge_dgs(block_dgs, l_dgs)
                    i += 1
                else:
                    break
            for icd_val, diag_p in zip(stacked_icds, stacked_diags):
                rows.append({
                    'icd': icd_val,
                    'second_icd': None,
                    'diag_parts': diag_p,
                    'dgs': list(block_dgs),
                    'hinweis_parts': [],
                })
            continue

        # 2) Chapter heading
        if is_chapter_heading(line, dgs):
            in_t90_s06 = False
            reset_block_state()
            i += 1
            continue

        # 3) Group heading
        if not in_t90_s06 and looks_like_group_header_start(lines, i, in_t90_s06):
            commit_active()
            unassigned_rows.clear()
            sibling_dgs = None
            sibling_hinweis = []
            sibling_overrides_group = False

            # Consume multi-line heading until it terminates (or uncoloned stops before DGs)
            head_dgs = list(dgs)
            head_hinweis = [right] if right else []
            head_slash = ends_slash
            left_acc = left
            while not left_acc.endswith(':') and not left_acc.startswith(UNCOLONED_GROUP_HEADERS):
                i += 1
                if i >= len(lines):
                    break
                nl, nd, ns, nr = split_columns(lines[i])
                left_acc = (left_acc + ' ' + nl).strip()
                if nd:
                    head_dgs = merge_dgs(head_dgs, nd)
                    head_slash = ns
                if nr:
                    head_hinweis.append(nr)
            # Consume wrapped continuation lines of un-coloned headers before DGs
            if left_acc.startswith(UNCOLONED_GROUP_HEADERS):
                while i + 1 < len(lines):
                    nl, nd, _, _ = split_columns(lines[i + 1])
                    if (nd and not nl) or is_icd_row_start(lines[i + 1], False):
                        break
                    i += 1
                    nl, nd, ns, nr = split_columns(lines[i])
                    if nd:
                        head_dgs = merge_dgs(head_dgs, nd)
                        head_slash = ns
                    if nr:
                        head_hinweis.append(nr)

            # Consume standalone DG / Hinweis lines immediately following the group heading
            i += 1
            while i < len(lines):
                nl, nd, ns, nr = split_columns(lines[i])
                if not nl and nd:
                    head_dgs = merge_dgs(head_dgs, nd)
                    head_slash = ns
                    if nr:
                        head_hinweis.append(nr)
                    i += 1
                elif not nd and not is_icd_row_start(lines[i], False) and looks_like_hinweis_line(lines[i]):
                    head_hinweis.append(lines[i])
                    i += 1
                elif head_hinweis and not nd and not is_icd_row_start(lines[i], False) and not looks_like_group_header_start(lines, i, False) and not is_chapter_heading(lines[i], []):
                    head_hinweis.append(lines[i])
                    i += 1
                else:
                    break

            if head_dgs:
                group_dgs = head_dgs
                group_hinweis = head_hinweis
                group_dg_open = head_slash
                group_has_own_dgs = True
                group_rows.clear()
            else:
                # Sub-headers like 'Sonstige akute disseminierte Demyelinisation:' keep enclosing
                # group DGs ONLY when their group already exists and no sibling block intervened;
                # headings like 'Polyneuropathien...:' or 'Reduktionsdefekte nicht näher...:' have no prior group DGs.
                if group_dgs and group_has_own_dgs and left_acc.startswith((
                    'Bösartige Neubildung ',
                    'Sonstige akute disseminierte',
                )):
                    pass
                else:
                    group_dgs = None
                    group_hinweis = []
                    group_dg_open = False
                    group_has_own_dgs = False
                    group_rows.clear()
            continue

        # 4) ICD row start
        if is_icd_row_start(line, in_t90_s06):
            prev_had_open_dg = dg_open
            commit_active()
            in_t90_s06 = line.startswith('T90.5 ')

            row_left, row_dgs, row_slash, row_right = split_columns(line)
            m = ICD_LINE_RE.match(row_left)
            assert m, f'Failed to match ICD row: {line!r}'
            icd1 = normalize_icd(m.group(1))
            icd2 = normalize_icd(m.group(2)) if m.group(2) else None
            diag_init = (m.group(3) or '').strip()

            # Group-header open DGs spilling across first child ICD lines (C70.0..C70.9)
            if group_dg_open and row_dgs:
                group_dgs = merge_dgs(group_dgs or [], row_dgs)
                group_dg_open = row_slash
                if row_right:
                    group_hinweis.append(row_right)
                sync_group_rows()
                row_dgs = []
                row_slash = False
                row_right = ''

            # Special S14.3 -> S14.4 case: S14.3's EN1/EN2/ wraps EN3 onto S14.4 line
            s14_partner = False
            if prev_had_open_dg and row_dgs and rows and rows[-1]['icd'] == 'S14.3':
                rows[-1]['dgs'] = merge_dgs(rows[-1]['dgs'], row_dgs)
                row_dgs = []
                row_slash = False
                s14_partner = True

            active = {
                'icd': icd1,
                'second_icd': icd2,
                'diag_parts': [diag_init] if diag_init else [],
                'dgs': row_dgs,
                'hinweis_parts': [row_right] if row_right else [],
                'is_s14_3_tail_partner': s14_partner,
            }
            diag_phase_open = not bool(row_dgs) and not bool(row_right)
            hinweis_phase_open = bool(row_right)
            dg_open = row_slash
            i += 1
            continue

        # 5) Standalone DG/Hinweis continuation or child diagnosis continuation
        if active is not None:
            if not left and dgs:
                # Standalone DG (+ optional hinweis) lines for active row or unassigned sibling block
                is_page_repeat = (
                    group_dgs is not None
                    and group_has_own_dgs
                    and not active['dgs']
                    and set(dgs) <= set(group_dgs)
                    and (not right or bool(group_hinweis))
                    and active['icd'] in {'G37.4', 'I63.6', 'Q05.6', 'S34.2', 'M05.8-', 'I97.83'}
                )
                if group_dg_open:
                    group_dgs = merge_dgs(group_dgs or [], dgs)
                    group_dg_open = ends_slash
                    if right:
                        group_hinweis.append(right)
                    sync_group_rows()
                elif is_page_repeat:
                    # Page break simply repeated active group's columns; consume repeat block cleanly
                    while i + 1 < len(lines):
                        nl, nd, _, _ = split_columns(lines[i + 1])
                        if (not nl and nd) or (not nd and looks_like_hinweis_line(lines[i + 1])):
                            i += 1
                        elif not nd and not is_icd_row_start(lines[i + 1], False) and not looks_like_group_header_start(lines, i + 1, False) and not is_chapter_heading(lines[i + 1], []) and group_hinweis:
                            i += 1
                        else:
                            break
                else:
                    # If active row sits inside a group header (Z89.3) whose group_hinweis differs,
                    # detach it from group inheritance so unassigned_rows picks up the new trailing DGs!
                    active['dgs'] = merge_dgs(active['dgs'], dgs)
                    dg_open = ends_slash
                    diag_phase_open = False
                    if right:
                        active['hinweis_parts'].append(right)
                        hinweis_phase_open = True
                i += 1
                continue

            if not dgs:
                if hinweis_phase_open or looks_like_hinweis_line(line):
                    active['hinweis_parts'].append(line)
                    hinweis_phase_open = True
                    diag_phase_open = False
                elif active['dgs']:
                    # DGs already arrived on this row -> extra non-DG line belongs to Hinweis
                    active['hinweis_parts'].append(line)
                    hinweis_phase_open = True
                else:
                    active['diag_parts'].append(line)
                i += 1
                continue

        # Fallback: trailing standalone DGs immediately after commit (unassigned sibling block)
        if not left and dgs and unassigned_rows:
            block_dgs = list(dgs)
            block_h = [right] if right else []
            i += 1
            while i < len(lines):
                nl, nd, _, nr = split_columns(lines[i])
                if not nl and nd:
                    block_dgs = merge_dgs(block_dgs, nd)
                    if nr:
                        block_h.append(nr)
                    i += 1
                else:
                    break
            for u in unassigned_rows:
                u['dgs'] = list(block_dgs)
                if block_h:
                    u['hinweis_parts'] = list(block_h)
            sibling_dgs = block_dgs
            sibling_hinweis = block_h
            unassigned_rows.clear()
            continue

        i += 1

    commit_active()

    # Wait: check if a sibling row right BEFORE an explicit-DG change (like Z89.3 -> EX/WS/CS/LY SB2 no hinweis!)
    # Notice! When Z89.3 arrived while group_dgs was active, Z89.3 read the standalone DGs right after Z89.3,
    # so active['dgs'] WAS populated directly and commit_active() already handled Z89.3 + Z89.7 + Z89.8!
    # Wait: what about group_dgs still active during Z89.7 / Z89.8?
    # Look at commit_active(): when Z89.3 committed with active['dgs'], sibling_dgs became ['EX','WS','CS','LY','SB2'],
    # sibling_hinweis became [], while group_hinweis STILL had 'längstens 12 Monate nach Akutereignis'!
    # So we must update group_dgs/group_hinweis OR prefer sibling_dgs over group_dgs when a sibling within
    # the same group explicitly overrode DGs/Hinweis (as happened on Z89.3 and F83 and G20.2- and S14.5)!

    lhb_bvb: dict[str, dict] = {}
    for row in rows:
        icd = row['icd']
        diagnose = join_german_lines(row['diag_parts'])
        entry = build_lhb_entry(
            icd=icd,
            diagnose=diagnose,
            dgs=row['dgs'],
            hinweis_parts=row['hinweis_parts'],
            second_icd=row['second_icd'],
        )
        if icd in lhb_bvb:
            existing = lhb_bvb[icd]
            sec_list = existing.get('second_icds') or (
                [existing['second_icd']] if existing['second_icd'] else []
            )
            if entry['second_icd'] and entry['second_icd'] not in sec_list:
                sec_list.append(entry['second_icd'])
            existing['second_icds'] = sec_list
            if entry['diagnose'] and entry['diagnose'] not in existing['diagnose']:
                existing['diagnose'] = f"{existing['diagnose']} / {entry['diagnose']}"
        else:
            lhb_bvb[icd] = entry

    return lhb_bvb, len(rows)


def parse_section2(raw_lines: list[str]) -> tuple[dict, int]:
    """Parse Section 2 (Blankoverordnung Physiotherapie ab 1.11.2024)."""
    start_idx = next(
        i for i, l in enumerate(raw_lines) if 'PHYSIOTHERAPIE AB 1.  NOVEMBER 2024' in l or 'PHYSIOTHERAPIE AB 1. NOVEMBER 2024' in normalize_spaces(l)
    ) + 1

    blanko: dict[str, dict] = {}
    row_count = 0
    row_pat = re.compile(
        rf'^({ICD_CODE_RE})\s+(?:({ICD_CODE_RE})\s+)?(EX)\s+(.+)$'
    )

    current_icd: str | None = None
    current_second: str | None = None
    diag_parts: list[str] = []

    def flush_blanko() -> None:
        nonlocal row_count
        if not current_icd:
            return
        row_count += 1
        diag = join_german_lines(diag_parts)
        if current_icd in blanko:
            existing = blanko[current_icd]
            sec_list = existing.get('second_icds', [existing.get('second_icd')])
            if current_second not in sec_list:
                sec_list.append(current_second)
            existing['second_icds'] = sec_list
        else:
            blanko[current_icd] = {
                'diagnosegruppe': 'EX',
                'diagnose': diag,
                'second_icd': current_second,
            }

    for raw in raw_lines[start_idx:]:
        s = normalize_spaces(raw)
        if not s:
            continue
        if s.startswith('Rechtlicher Hinweis'):
            break
        if (
            s.startswith('========== PAGE ')
            or re.fullmatch(r'\d+', s)
            or s in {'1.', '2.', 'ICD-10', 'DIAGNOSE-', 'GRUPPE', 'DIAGNOSE'}
        ):
            continue

        m = row_pat.match(s)
        if m:
            flush_blanko()
            current_icd = normalize_icd(m.group(1))
            current_second = normalize_icd(m.group(2)) if m.group(2) else None
            diag_parts = [m.group(4)]
        elif current_icd and (
            s.startswith(('[', '+', 'region ', 'Schulter-', 'lavikular-', 'noklavikular', 'lar-', 'Sternoklavikular'))
            or diag_parts[-1].endswith('-')
            or s[0].islower()
        ):
            diag_parts.append(s)
        else:
            # Sub-heading like 'Arthrose', 'Frakturen, traumatische Verletzungen und Verbrennungen'
            flush_blanko()
            current_icd = None
            current_second = None
            diag_parts = []

    flush_blanko()
    return blanko, row_count


def verify_catalog(lhb_bvb: dict, lhb_rows: int, blanko: dict, blanko_rows: int) -> None:
    """Built-in self-checks verifying completeness and ruling out neighbor leakage."""
    assert lhb_rows == 417, f'Expected 417 Section-1 ICD rows, got {lhb_rows}'
    assert len(lhb_bvb) == 416, f'Expected 416 unique Section-1 ICDs, got {len(lhb_bvb)}'
    assert blanko_rows == 66, f'Expected 66 Section-2 ICD rows, got {blanko_rows}'
    assert len(blanko) == 65, f'Expected 65 unique Section-2 ICDs, got {len(blanko)}'

    # Critical spot checks against KBV Diagnoseliste (PRUEFSTAND & parser bug checks)
    assert lhb_bvb['B94.1']['hinweis'] == 'längstens 1 Jahr nach Akutereignis'
    assert lhb_bvb['G24.3']['hinweis'] == (
        'nur bei gleichzeitiger leitliniengerechter medikamentöser Therapie'
    )
    assert lhb_bvb['C70.0']['diagnosegruppen'] == lhb_bvb['C72.9']['diagnosegruppen']
    assert 'Seltene angeborene' not in lhb_bvb['E88.22']['diagnose']
    assert lhb_bvb['G60.0']['diagnosegruppen'] == ['WS', 'EX', 'PN', 'SB2', 'EN3', 'SP3']
    assert lhb_bvb['Q66.0']['diagnosegruppen'] == ['EX', 'SB2']
    assert lhb_bvb['G61.0']['hinweis'] is None
    assert 'CIDP' in (lhb_bvb['G61.8']['hinweis'] or '')
    assert lhb_bvb['R15']['hinweis'] == 'ab vollendetem 70. Lebensjahr'
    assert 'G35.1-' in lhb_bvb and lhb_bvb['G35.1-']['diagnosegruppen'] == [
        'ZN', 'EN1', 'EN2', 'SC', 'ST1', 'SP5', 'SP6'
    ]
    assert lhb_bvb['M47.9-']['second_icds'] == ['G99.2', 'G55.2']
    assert 'S42.0-' in blanko and 'S42.1-' in blanko and 'S42.2-' in blanko
    assert blanko['M24.41']['second_icds'] == [None, 'Z98.88']

    # No entry may have leaked empty diagnosegruppen or PDF-glued ICD artifacts in diagnose/hinweis
    glued_check = re.compile(r'[a-zäöüß][A-Z]\d{2}')
    for k, entry in lhb_bvb.items():
        assert entry['diagnosegruppen'], f'{k} missing diagnosegruppen'
        assert not glued_check.search(entry['diagnose']), f'Glued ICD in diagnose of {k}: {entry["diagnose"]}'
        if entry['hinweis']:
            assert not glued_check.search(entry['hinweis']), f'Glued ICD in hinweis of {k}: {entry["hinweis"]}'


def main() -> None:
    source = resolve_source()
    raw_lines = source.read_text(encoding='utf-8').splitlines()

    lhb_bvb, lhb_rows = parse_section1(raw_lines)
    blanko, blanko_rows = parse_section2(raw_lines)
    verify_catalog(lhb_bvb, lhb_rows, blanko, blanko_rows)

    catalog = {
        '_meta': {
            'source': 'KBV Diagnoseliste — Langfristiger Heilmittelbedarf / Besonderer Verordnungsbedarf / Blankoverordnung',
            'edition': 'Stand 1. Januar 2026',
            'source_file': str(source.relative_to(REPO_ROOT)),
            'generated_at_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'lhb_bvb_count': len(lhb_bvb),
            'lhb_bvb_rows': lhb_rows,
            'blanko_physio_shoulder_count': len(blanko),
            'blanko_physio_shoulder_rows': blanko_rows,
        },
        'lhb_bvb': lhb_bvb,
        'blanko_physio_shoulder': blanko,
    }
    OUTPUT.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(
        f'Wrote {OUTPUT} ({len(lhb_bvb)} LHB/BVB from {lhb_rows} rows, '
        f'{len(blanko)} Blanko from {blanko_rows} rows)'
    )


if __name__ == '__main__':
    main()
