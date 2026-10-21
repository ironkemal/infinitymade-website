# Praxura Termin-Anfrage-Widget

Einbettbares Formular, mit dem Patient:innen auf der Website einer Praxis einen Termin **anfragen**
(kein verbindlicher Termin). Läuft in einem iframe, ohne Login, ohne Passwort.

## Einbau

```html
<script src="https://praxura.de/widget/embed.js"
        data-owner="<Praxis-UUID>" async></script>
```

| Attribut | Pflicht | Bedeutung |
|---|---|---|
| `data-owner` | ja | UUID der Praxis (Owner-Profil). Ohne gültige UUID zeigt das Widget „noch nicht eingerichtet“. |
| `data-target` | nein | `id` eines Containers, in den der iframe gesetzt wird. Sonst direkt hinter dem Script. |
| `data-mock` | nein | Nur Entwicklung: `accepted` · `rejected` · `pending` · `error` · `limit`. Wirkt ausschließlich auf `localhost`. |

Alternativ ohne Script (kein automatischer Höhenabgleich):

```html
<iframe src="https://praxura.de/widget/booking-widget.html?owner=<Praxis-UUID>"
        title="Terminanfrage" loading="lazy" style="width:100%;max-width:600px;height:700px;border:0"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe>
```

**On-Prem:** Kundenbox-Praxen laden `embed.js` von **ihrer eigenen** Adresse
(`https://<kutu>/widget/embed.js`). Der Loader hat keinen festen Host; er leitet die iframe-Adresse
aus seinem eigenen `src` ab. Würde eine Box-Praxis das Skript von `praxura.de` laden, ginge der
Seitenaufruf ihrer Patient:innen an unseren Server (onprem O-211).

## Dateien

| Datei | Aufgabe |
|---|---|
| `embed.js` | Loader für die Host-Seite (klassisches Script). Erzeugt nur den iframe, nimmt nur die Höhe zurück. |
| `booking-widget.html` | Inhalt des iframes, auch direkt aufrufbar. |
| `booking-widget.css` | Stil, BEM-Block `bw`. Feste helle Palette (`#e0f7ff`, `#90c9e3`, `#006699`). |
| `booking-widget.js` | Ablauf (ES-Modul): vier Schritte, Formular, API-Client, Abfrage. |
| `booking-widget.logic.js` | Reine Logik (Listen, Regeln je Schritt, Zusammenfassung, Payload) — `node --test`. Anliegen kommen aus `module/anfrage-anliegen.js`. |
| `booking-widget.mock.js` | Mock-Backend, nur lokal. Nicht ausgeliefert (`.vercelignore`). |

## Datenschutz — was das Widget tut und bewusst nicht tut

- **Erhebt:** Vorname, Nachname, Geburtsdatum, Versicherungsart, Anliegen (feste Auswahl), Wochentage und
  Tageszeiten, E-Mail oder Telefon (mindestens eines), zwei freiwillige Kurztexte (140 und 80 Zeichen).
  Keine Diagnose, keine Versichertennummer, kein Wunschdatum.
- **Rechtsgrundlage:** Art. 6 Abs. 1 lit. b, Art. 9 Abs. 2 lit. h DSGVO i. V. m. § 22 BDSG
  (Entscheidung K2b.15, 09.10.2026). **Deshalb kein Einwilligungs-Checkbox**, sondern ein Hinweissatz
  über dem Absenden-Knopf. Nicht nachträglich „sicherheitshalber“ ergänzen — eine nie eingeholte
  Einwilligung würde als erteilt dokumentiert.
- **Browser-Speicher:** nach dem Absenden nur Anfrage-ID und Token in `sessionStorage`
  (bis Fenster/Tab schließt). Keine Cookies, kein `localStorage`, kein Tracking, keine Drittanbieter.
  Eingaben werden sofort nach dem Absenden aus dem Formular entfernt.
- **Nach außen (`postMessage`):** nur `{type:'bw:height', height}` und `{type:'bw:done'}` — ohne Inhalt.
- **Kein Auto-Annehmen:** Anfragen aus dem Widget werden nie automatisch zu Terminen (guvenlik S-54).
- **Kein Patienten-Lookup:** die Antwort ist immer „Anfrage eingegangen“; ob die Person bereits
  Patient:in ist, erfährt nur die Praxis.
- **Speicherdauer:** nicht angenommene Anfragen werden nach spätestens 6 Monaten gelöscht (O-182).

### Baustein für die Datenschutzerklärung der Praxis-Website

> **Online-Terminanfrage.** Auf dieser Website ist ein Formular zur Online-Terminanfrage eingebunden.
> Es wird von unserer Praxissoftware Praxura (Yavuz Kemal Demir, Siegburg) bereitgestellt, die in unserem
> Auftrag tätig ist (Art. 28 DSGVO). Beim Aufruf dieser Seite wird Ihre IP-Adresse an deren Server
> übermittelt, damit das Formular angezeigt werden kann. Ihre Eingaben werden verschlüsselt direkt an die
> Praxissoftware übertragen, nicht an den Anbieter dieser Website.

## Betrieb

- **Header:** `/widget/booking-widget.html` hat eigene Regeln in `vercel.json` und `onprem/Caddyfile`
  (enge CSP, `frame-ancestors https:` nur auf `praxura.de`). Alle anderen Seiten behalten
  `X-Frame-Options: SAMEORIGIN`. Diese Regeln nicht zusammenlegen.
- **Backend:** `POST /api/booking-request/create`, `GET /api/booking-request/status`,
  `GET /api/booking-request/praxis` in `api-backend/server.js`. Siehe `API.md`.
- **Limits:** 10 Anfragen / 15 min je IP, 100 Anfragen / 24 h je Praxis.
- **Listen an zwei Stellen:** `widget/booking-widget.logic.js` und `api-backend/booking/widget-guards.js`
  (getrennt ausgeliefert). `widget/widget-listen-parity.test.js` hält sie gleich — bei Änderung an einer Seite
  läuft er rot.
- **Kein neuer Vercel-Endpoint** (Limit 11/12, G8).

## Prüfen

```sh
node --test widget/                               # Logik + Listen-Parität
node --test api-backend/booking/                  # Backend
node tools/browser-probe/widget-probe.mjs         # Browser, Fremd-Ursprung, CSP (startet eigene Server)
```
