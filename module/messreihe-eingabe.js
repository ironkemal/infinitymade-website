export const MESS_UNITS = { VAS: '/ 10', ROM: '°', kraft: 'kg', custom: '' };

// ROM folgt dem Befundformular. Kraft in kg und freie Werte behalten die Eingabegrenze.
export function messGrenze(typ) {
  return { VAS: 10, ROM: 360, kraft: 999, custom: 999 }[typ];
}

export function bindeMesstyp(select) {
  if (!select) return;
  select.onchange = () => {
    document.getElementById('messEinheitLabel').textContent = MESS_UNITS[select.value] || '';
    document.getElementById('messWert').max = String(messGrenze(select.value));
  };
  select.onchange();
}

export function messFehler(typ, koerper, eingabe, datum) {
  const max = messGrenze(typ);
  if (max == null || !koerper?.trim() || !String(eingabe ?? '').trim() || !Number.isFinite(Date.parse(datum))) {
    return 'Bitte Typ, Körperteil, Wert und Datum angeben.';
  }
  const wert = Number(eingabe);
  return Number.isFinite(wert) && wert >= 0 && wert <= max ? null : `Bitte einen Wert von 0 bis ${max} angeben.`;
}
