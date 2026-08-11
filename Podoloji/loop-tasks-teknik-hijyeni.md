# Loop-Liste: Teknik borç ve site hijyeni

Quelle: Ops-Dashboard → Teknik → "Teknik borç ve site hijyeni" (Meeting 08.08.2026, wo
markiert). 9 Unteraufgaben insgesamt, davon 7 hier — die anderen 2 brauchen Melih direkt
(Cache-Busting ist eher eine Arbeitsgewohnheit als ein Task, Google-OAuth-Verifizierung
braucht Zugang zu seinem Google-Cloud-Konto) und stehen deshalb bewusst NICHT in dieser
Liste.

Regel für den builder-Agenten: Reihenfolge ist nicht zwingend, keine "Zuerst:"-Kette
zwischen diesen Punkten — trotzdem von oben nach unten abarbeiten der Einfachheit halber.

- [x] 1. Pano-Zuweisungen verschwinden von selbst — **Falle gestellt, Ursache weiter unbekannt** [Priorität: Hoch]
      → Geändert: `ops/schema-audit.sql` (neu), `ops/board.js`, `ops/SETUP.md`,
        Cache-Version in `ops/*.js` + `ops/index.html` auf `?v=20260811a`.
      **Kein Fix — eine Falle.** Neue Tabelle `ops_todos_audit` + Trigger protokollieren
      jede Änderung an assignee/parent_id/done und jedes Löschen, mit Verursacher und
      Zeit. Ansehen über ⋮ → **Verlauf** auf der Karte.
      ⚠️ `ops/schema-audit.sql` muss Melih **einmalig manuell** im SQL-Editor des
      ops-Projekts (`praxura-ops`) ausführen — das Supabase-MCP hängt am Produkt-Projekt
      und darf die ops-Seite nicht anfassen. Bis dahin zeigt "Verlauf" nur einen Hinweis.
      Nebenbefund (kein Beweis, aber plausibel): Drag & Drop unter ein Thema überschrieb
      die Zuweisung mit der des Themas, das ⋮-Menü tat es nicht — zwei Wege, zwei
      Ergebnisse. Beide Wege verhalten sich jetzt gleich und melden den Wechsel per Toast.
      Betrifft das Ops-Dashboard selbst (`ops/`-Ordner in diesem Repo, separates
      Supabase-Projekt `praxura-ops`), NICHT das Praxura-Produkt.
      ⚠️ Kann nicht "gelöst" werden ohne einen echten Vorfall zum Untersuchen — stattdessen:
      Logging/Audit-Trail einbauen (wer/was hat eine Zuweisung wann entfernt), damit beim
      nächsten Auftreten die Ursache sichtbar ist. Nicht als "erledigt" abhaken, sondern als
      "Falle gestellt, wartet auf nächsten Vorfall" — das ist ein akzeptables Ergebnis für
      diesen Punkt.

- [x] 2. Tote WhatsApp/Twilio-Integrationskarte aus den Dashboard-Einstellungen entfernt
      → Geändert: `demo-dashboard.html`
      Gefunden **nicht** in `dashboard.html`, sondern in `demo-dashboard.html` — der
      öffentlichen Marketing-Demo, verlinkt von `index.html:1154`. Entfernt: der Schalter
      „WhatsApp Erinnerungen an Patienten" (Einstellungen → Benachrichtigungen) und der
      Tarif-Text „Rechnungen, Kassenbuch, WhatsApp & Termine" → „… Kassenbuch & Termine".
      Damit wirbt die Demo nicht länger mit einer Funktion, die es seit 2026-05-20 nicht gibt.
      Bewusst **nicht** angefasst: `dashboard.html:4969` („Via WhatsApp teilen" = Teilen-Knopf,
      kein Feature), Backend-Reste (`server.js`, `ai/router.js`, `api/admin/data.js`) sowie
      `script.js`/`index-old.html` — Letztere gehören zur alten InfinityMade-Seite und
      sind ein eigenes Thema.
      Kontext: WhatsApp/Twilio wurde laut CLAUDE.md am 2026-05-20 endgültig eingestellt,
      Tabellen sind gedroppt. Der Suchbegriff "WhatsApp" taucht in `dashboard.html` nur an
      einer harmlosen Stelle auf (Zeile ~4969, "Via WhatsApp teilen" — das ist ein
      Share-Button, KEIN Integrations-Feature, nicht anfassen). Die eigentliche tote
      Integrationskarte wurde bei der Recherche nicht gefunden — vermutlich schon entfernt,
      oder sie liegt in `dashboard.js` (Settings-Render-Funktionen) statt im HTML. Erst
      gründlich suchen (`grep -ri "whatsapp\|twilio"` über `dashboard.js`,
      `api-backend/server.js`, `api-backend/ai/router.js` — dort gibt es noch Treffer),
      dann entscheiden was UI ist und wirklich weg muss vs. was Backend-Altlast ohne
      sichtbare Karte ist (letzteres ist ein anderes Thema, nicht dieser Punkt).

- [ ] 3. Falsches "Google Kalender"-Label in den Einstellungen — eigentlich Gmail/Mail-Verbindung
      ⚠️ Bereits geprüft, NICHT die Ursache: `dashboard.html:801` (`lbl_google_cal`,
      Mitarbeiter-Detail-Tab) und `dashboard.html:2689` (`googleCalStatus`, Owner-Settings)
      sowie `kalender.html:275` ("Google Calendar & Meet") — alle drei sind korrekt an
      `calendar_integrations`/`calendar/google-auth` verdrahtet, keine Gmail-Verwechslung
      im Text gefunden. Der gemeldete Fehler sitzt vermutlich tiefer: Google-Kalender und
      Gmail laufen über denselben Google-OAuth-Consent-Screen — möglich, dass beim
      Verbinden eines der beiden auch der Status des anderen als "verbunden" markiert wird.
      Nächster Schritt: `api-backend/server.js` — Routen `/calendar/google-auth`,
      `/calendar/google-callback`, `/gmail/connect` auf gemeinsam genutzte
      Tokens/Scopes/Tabellen prüfen. Falls nach der Prüfung immer noch unklar wo genau das
      Label falsch war: bei Melih nachfragen statt zu raten (Meeting-Kontext 08.08.2026
      könnte helfen, den genauen Bildschirm zu identifizieren).

- [ ] 4. UTF-8-Encoding-Problem — ü/ä/ß können in dashboard.html/dashboard.js kaputtgehen
      `dashboard.html` hat `<meta charset="UTF-8" />` (Zeile 5) — das allein reicht nicht
      immer. Prüfen: Content-Type-Header beim Ausliefern von `dashboard.js` (Vercel-Default
      vs. explizit gesetzt), Datei-Encoding der Quelldateien selbst (`file -i dashboard.js`),
      und ob irgendein Build-/Kopier-Schritt die Datei anfasst und dabei die Kodierung
      verändern könnte.

- [ ] 5. demo-booking.html: Google Fonts selbst hosten statt von CDN laden
      Bestätigt: `demo-booking.html` Zeile 10-12 lädt `fonts.googleapis.com` /
      `fonts.gstatic.com` (Fraunces, Plus Jakarta Sans, JetBrains Mono). Fonts
      herunterladen, lokal einbinden (`@font-face`), Preconnect-Links entfernen. Grund
      vermutlich DSGVO (keine Drittanbieter-Verbindung vom Browser des Besuchers).

- [ ] 6. 404-Seite prüfen/anlegen
      Bestätigt: es gibt aktuell **keine** `404.html` im Repo-Root. Anlegen, im
      Praxura-Look (gleiche Fonts/Farben wie `index.html`), mit Link zurück zur Startseite.
      Bei Vercel greift eine `404.html` im Root automatisch für unbekannte Pfade — keine
      zusätzliche Routing-Konfiguration nötig, kurz gegenprüfen ob `vercel.json` etwas
      Abweichendes vorschreibt.

- [ ] 7. noindex-Kontrolle: Login/Onboarding/Mitarbeiter-Anmeldung
      ✅ Bereits geprüft — **schon korrekt vorhanden** in allen drei Dateien
      (`login.html`, `onboarding.html`, `employee-signup.html`, jeweils
      `<meta name="robots" content="noindex, nofollow" />` +
      `<meta name="googlebot" content="noindex, nofollow" />`). Dieser Punkt kann direkt
      als erledigt abgehakt werden — kurz nochmal bestätigen, dann `[x]` setzen, kein Code
      nötig.

---

## Für den builder-Agenten

- Diese Datei ist die einzige Quelle für "was ist als nächstes dran".
- Nach jeder erledigten (oder als "Falle gestellt" abgeschlossenen) Aufgabe: Checkbox auf
  `[x]` setzen + eine kurze Zeile darunter, welche Dateien geändert wurden.
- Punkt 1 und 3 sind Investigationsaufgaben, kein garantierter Fix — ehrlich dokumentieren
  was gefunden bzw. nicht gefunden wurde, nicht so tun als wäre es vollständig gelöst.
