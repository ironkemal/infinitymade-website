# Konsey Kararı — KI-Stufe 2: eigener KI-Anbieter/Schlüssel (BYOK)
Tarih: 2026-11-24 · Oturan üyeler: muhalif, deger-mi, fonksiyon-ustasi, guvenlik (Gutachten 23.11.), legal-de (Gutachten 23.11. + Blindfleck), onprem (Gutachten 23.11. + Blindfleck)

ON-PREM ETKİSİ: hayır — Box → Anbieter direkt, Praxura ohne Rolle (LEGAL_DECISIONS „BYO-Key Box → Anbieter direkt“); kein Relay (K6), kein Datenzugriff bei Fernwartung (K10).

## KARAR
Gebaut wird **Option D**, nicht B und nicht A: BYOK nur auf der **Box** als **Admin-Konfiguration in der `.env`** — kein Eingabefeld in der Oberfläche, keine Schlüsselablage in der Datenbank, keine Migration. Freigabe nur, wenn der Betreiber `AI_BYOK_ALLOWED=1` **und** `AI_MODE=direkt` setzt; dann akzeptiert `ki-config.js` zusätzlich zur festen Praxura-Liste genau `<RE_SAFE_SEGMENT>.(openai|cognitiveservices).azure.com` mit einer Region aus `EU_DATA_BOUNDARY_REGIONS` — **nie** auf dem Jeton-Weg. Nur Datenklasse A (pii-mask bleibt Pflicht), Schlüssel gehört der Praxis (kein Praxura-Schlüssel, kein Image-Default). Die Einstellungen zeigen nur an (Modus, „Eigener Azure-Zugang (Admin-Konfiguration)“, Region) und bieten „Verbindung testen“ (Backend, fester synthetischer Ping, nur ja/nein, Rate-Limit, kein Inhalt). Admin-Doku in KURULUM mit den Pflichthinweisen von legal-de. **Vorrang hat der Jeton-Produktweg (O-169)**; D ist Nebengleis. **Nicht gebaut:** UI/DB-Schlüsselablage (B), lokales Modell (A), BYOK im SaaS, Freitext-Endpunkt, Nicht-EU-Anbieter, Mistral (kein C5-Nachweis).

## Gerekçe
Die Fakten vom 12.09.2026 (Referenzbox ohne GPU, lokale Modelle laufen nicht) sind geschlossen — legal-de hat „lokales Modell zuerst“ in der Blindfleck-Runde zurückgenommen. B würde den am 05.10.2026 (K-20) gescheiterten Weg „Schlüssel pro Praxis“ ohne neue Tatsache wieder öffnen und den Schlüssel in Backups/Diagnosepakete bringen (K10-Spannung, muhalif). D deckt Melihs Wunsch „KI in den Einstellungen konfigurieren“ zu ~80 % für ~10 % des Aufwands (deger-mi: 0,5–1 Tag statt 5–8) und ist voll zurücknehmbar.

## Ödün verilenler
Kein Anbieterwechsel per Klick durch den Inhaber; eigener Anbieter braucht einen Admin/Installateur. Nur Azure EU. Kein lokales Modell, bis Hardware da ist.

## Uzlaşma
Nur Box · nur Datenklasse A · feste Anbieterliste · kein Freitext-Endpunkt · Env vor DB · Jeton-Weg zuerst · Verbindungstest ohne Inhalt.

## Anlaşmazlık
Ursprünglich legal-de (lokales Modell zuerst) vs. onprem (Azure-EU zuerst) — aufgelöst durch die geschlossene Faktenlage vom 12.09.; heute keine.

## Kör noktalar
- onprem: eigene Ressourcen nutzen auch `cognitiveservices.azure.com` (ki-config.js:21) — Regel muss beide Endungen abdecken.
- onprem: „Verbindung testen“ ist ein neuer Auslöser eines Außenrufs → Register-Eintrag, KURULUM, Liste der Außenverbindungen in „Über diese Software“ (O-178).
- legal-de: Region verrät der Hostname nicht → Praxis bestätigt die EU-Region selbst (`AI_REGION` Pflicht bei BYOK).
- muhalif: O-134/O-169 — Rollen-/§393-Einwand hängt am Einschalten des Jeton-Wegs; D gibt O-169 nicht frei.

## Uygulama — builder'a
- [ ] ki-config.js: BYOK-Host-Regel nur bei `AI_BYOK_ALLOWED=1` + `AI_MODE=direkt`, `AI_REGION` Pflicht und in EU-Liste, nie Jeton; Tests (fremder Host, Nicht-EU, ohne Schalter, Jeton unberührt) — K3
- [ ] Router: `POST /api/ai/_verbindungstest` (nur Inhaber, Rate-Limit, fester synthetischer Ping, Antwort ok/Fehlercode) — K2
- [ ] Einstellungen → KI: Anzeige „Eigener Azure-Zugang (Admin-Konfiguration)“ + Knopf „Verbindung testen“ — K1
- [ ] KURULUM: Abschnitt „Eigener Azure-Zugang (nur Box)“ mit Pflichthinweisen (Vertrag+DPA mit Microsoft, EU-Region selbst bestätigen, Schlüssel nur `.env`, nie an Praxura/Diagnosepaket, nur Datenklasse A, C5/§393 + §203 Abs. 3 + VVT/DSFA durch die Praxis, Art. 50 AI Act Kennzeichnung bleibt); `.env.template`-Kommentar — K1
- [ ] onprem/REGISTER.md: neuer Eintrag (Außenruf „Verbindung testen“, BYOK-Schalter), O-178-Liste — K1

## Backlog (karara dahil DEĞİL)
- B (UI/DB-BYOK) — Auslöser: Praxis lehnt Praxura-Azure schriftlich ab und will eigenen Vertrag, oder Installateur meldet zweimal, `.env` sei nicht zumutbar.
- A (lokales Modell) — Auslöser: Box mit GPU verkauft oder CPU-taugliches Modell mit deutschen Praxistexten nachgewiesen.
- `ki-einwilligung.js` auf `lib/gehaerteter-json-store.js` umstellen.

## Sert veto varsa
Keins gegen D. Bestehende Vetos bleiben: SaaS-BYOK (legal-de), Freitext-Endpunkt (guvenlik), Schlüssel in Image/DB (onprem G2 / guvenlik).
