# Loop-Liste: Teknik borç ve site hijyeni

Quelle: Ops-Dashboard → Teknik → "Teknik borç ve site hijyeni" (Meeting 08.08.2026, wo
markiert). 9 Unteraufgaben insgesamt, davon 7 hier — die anderen 2 brauchen Melih direkt
(Cache-Busting ist eher eine Arbeitsgewohnheit als ein Task, Google-OAuth-Verifizierung
braucht Zugang zu seinem Google-Cloud-Konto) und stehen deshalb bewusst NICHT in dieser
Liste.

Regel für den builder-Agenten: Reihenfolge ist nicht zwingend, keine "Zuerst:"-Kette
zwischen diesen Punkten — trotzdem von oben nach unten abarbeiten der Einfachheit halber.

---

**Stand 2026-08-11:** 6 von 7 abgearbeitet. Offen bleibt nur **Punkt 3** — dort wurde
nach gründlicher Prüfung keine Verwechslung gefunden, es braucht einen Screenshot von
Melih statt einer Änderung auf Verdacht. Punkt 1 ist als *Falle gestellt* geschlossen,
die Ursache ist weiterhin unbekannt.
Bei jedem Punkt steht unter der Überschrift zuerst das **Ergebnis**, darunter der
ursprüngliche Auftragstext von der Pano.
Noch von Melih zu tun: `ops/schema-audit.sql` einmalig im ops-Supabase ausführen,
`git push`, danach die 404-Seite einmal live aufrufen.

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

- [ ] 3. Falsches "Google Kalender"-Label in den Einstellungen — **OFFEN, Rückfrage an Melih**
      → Keine Datei geändert. Nichts wird auf Verdacht umbenannt.
      **Zusätzlich geprüft (2026-08-11), alles korrekt — bitte nicht nochmal prüfen:**
      · `server.js:309–386` — `/calendar/google-auth`, `/gmail/connect` und der gemeinsame
        Callback sind über `flowType` im signierten State sauber getrennt. Gmail schreibt
        `profiles.b2b_from_email` + `set_gmail_token`, Kalender schreibt
        `calendar_integrations`. Keine gemeinsame Tabelle, kein Überschreiben.
      · Die drei Verbinden-Knöpfe zeigen auf die richtigen Routen: `dashboard.js:13253`
        und `kalender.js:628` → `/calendar/google-auth`, `dashboard.js:12758` → `/gmail/connect`.
      · Die Gmail-Oberflächen heißen auch Gmail: „E-Mail-Konto", „Gmail-Konto",
        „Mit Google verbinden" (`dashboard.html:942, 1042, 4779`). Nirgends steht dort „Kalender".
      · Statusanzeigen lesen jeweils aus der richtigen Quelle (`dashboard.js:12194`, `:13226`).
      **Nötig von Melih:** ein Screenshot oder der genaue Bildschirm aus dem Meeting
      08.08.2026 (welcher Bereich, welcher Text). Ohne das wäre jede Änderung geraten.
      **Nebenbefund, eigener Punkt fürs Ops-Dashboard (Teknik):** `kalender.js:628` ruft
      `/calendar/google-auth?userId=…` auf, die Route verlangt aber `?token=` bzw. einen
      Bearer-Header (`api-backend/ai/auth.js:19`). Der Verbinden-Knopf auf `kalender.html`
      läuft damit in ein 401 — der in `dashboard.js` funktioniert. Nicht hier gefixt,
      weil er nicht zu diesem Punkt gehört.
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

- [x] 4. UTF-8 geprüft — aktuell kein Fehler, dafür Schutz gegen den nächsten
      → Neu: `.editorconfig`, `.gitattributes`
      **Gemessen, nicht vermutet (2026-08-11):**
      · Datei-Kodierung: alle `*.html`/`*.js` im Root sind gültiges UTF-8
        (`iconv -f UTF-8 -t UTF-8` über alle Dateien, kein einziger Treffer).
      · Auslieferung live geprüft mit `curl -I`: `dashboard.js` kommt als
        `content-type: application/javascript; charset=utf-8`, `dashboard.html` und
        `praxura.de/` als `text/html; charset=utf-8`. Der `<meta charset>`-Tag ist
        also gar nicht die einzige Absicherung — der Header stimmt bereits.
      · Es gibt keinen Build-/Kopierschritt: Vercel liefert die Dateien statisch aus.
      · 40 Dateien haben ein BOM am Dateianfang (u. a. `login.html`, `kalender.html`,
        alle Blog-Seiten). Das ist erlaubt und im Browser unschädlich —
        **bewusst gelassen**, sonst wären 40 Dateien ohne Nutzen im Verlauf.
      **Was neu ist:** `.editorconfig` schreibt jedem Editor UTF-8 + LF vor,
      `.gitattributes` hält die Zeilenenden im Repo auf LF und schützt Binärdateien.
      Damit kann ein Editor die Umlaute künftig nicht mehr unbemerkt als Latin-1 speichern.
      (Heute ändert sich dadurch nichts: es gibt keine einzige CRLF-Datei im Repo.)
      `dashboard.html` hat `<meta charset="UTF-8" />` (Zeile 5) — das allein reicht nicht
      immer. Prüfen: Content-Type-Header beim Ausliefern von `dashboard.js` (Vercel-Default
      vs. explizit gesetzt), Datei-Encoding der Quelldateien selbst (`file -i dashboard.js`),
      und ob irgendein Build-/Kopier-Schritt die Datei anfasst und dabei die Kodierung
      verändern könnte.

- [x] 5. demo-booking.html: Google Fonts selbst gehostet
      → Geändert: `demo-booking.html`
      Kein Download nötig: Fraunces, Plus Jakarta Sans **und** JetBrains Mono liegen
      bereits selbst gehostet in `fonts/system-fonts.css` (Gewichte 300–700) und werden
      von `index.html` und rund zehn weiteren Seiten so eingebunden. `demo-booking.html`
      war die einzige Produktseite, die noch das CDN benutzte. Die drei Zeilen
      (2× preconnect + CSS-Link) sind durch `<link href="fonts/system-fonts.css">` ersetzt;
      die `--serif/--sans/--mono`-Variablen der Seite bleiben unverändert.
      Anmerkung: echte Kursivschnitte sind lokal nicht vorhanden, die eine Kursivstelle
      wird vom Browser synthetisiert — genau wie auf allen anderen Praxura-Seiten.
      Nicht angefasst: `ai chatbot proje/index.html` lädt weiter von Google (altes
      Nebenprojekt). Deshalb bleiben `fonts.googleapis.com`/`fonts.gstatic.com` vorerst
      in der CSP in `vercel.json` — erst wenn dieser Ordner weg ist, kann man sie streichen.
      Bestätigt: `demo-booking.html` Zeile 10-12 lädt `fonts.googleapis.com` /
      `fonts.gstatic.com` (Fraunces, Plus Jakarta Sans, JetBrains Mono). Fonts
      herunterladen, lokal einbinden (`@font-face`), Preconnect-Links entfernen. Grund
      vermutlich DSGVO (keine Drittanbieter-Verbindung vom Browser des Besuchers).

- [x] 6. 404-Seite angelegt
      → Neu: `404.html`
      Bindet `fonts/system-fonts.css` und `assets/system.css` ein und benutzt
      ausschließlich die Design-Tokens (`--bg`, `--ink`, `--bronze`, `--serif` …) —
      **kein einziger Farbwert im Stylesheet der Seite**, damit sie bei einer
      Farbänderung automatisch mitzieht. Knöpfe sind `.btn-primary-arrow` und
      `.btn-secondary` aus dem Designsystem, Inhalt deutsch, mit `noindex, nofollow`.
      Links geprüft: `/`, `/kontakt.html`, `app.praxura.de/login.html`, `/blog/`,
      `/support.html`, `/impressum.html` existieren alle.
      `vercel.json` schreibt nichts Abweichendes vor — eine `404.html` im Root greift
      bei Vercel automatisch für unbekannte Pfade. **Ungeprüft:** noch nicht live
      aufgerufen, das geht erst nach dem Deploy.
      Bestätigt: es gibt aktuell **keine** `404.html` im Repo-Root. Anlegen, im
      Praxura-Look (gleiche Fonts/Farben wie `index.html`), mit Link zurück zur Startseite.
      Bei Vercel greift eine `404.html` im Root automatisch für unbekannte Pfade — keine
      zusätzliche Routing-Konfiguration nötig, kurz gegenprüfen ob `vercel.json` etwas
      Abweichendes vorschreibt.

- [x] 7. noindex-Kontrolle: Login/Onboarding/Mitarbeiter-Anmeldung — bestätigt
      → Keine Datei geändert, kein Code nötig.
      Am 2026-08-11 nachgeprüft: `login.html`, `onboarding.html` und
      `employee-signup.html` haben jeweils in Zeile 6 und 7
      `<meta name="robots" content="noindex, nofollow" />` und
      `<meta name="googlebot" content="noindex, nofollow" />`. Die neue `404.html`
      hat beides ebenfalls bekommen.
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
