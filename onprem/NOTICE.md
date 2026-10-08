# Fremdbestandteile der Praxura-Kundenbox

Stand: **11.09.2026** · Basis: `onprem/docker-compose.yml`

Diese Liste ist die **Grundlinie für das Lizenztor** (Register O-42): kommt in
der Compose-Datei eine `image:`-Zeile hinzu, muss hier eine Zeile mitkommen.
Wächst die eine Zahl ohne die andere, ist das ein Fehler, kein Versehen.

Warum das zählt: mit dem On-Premise-Modell **liefern wir Software aus**, statt
sie nur zu betreiben. Damit greifen Weitergabepflichten, die im reinen SaaS
nicht griffen — und der Cyber Resilience Act verlangt ab 11.12.2027 ohnehin
eine Stückliste (SBOM) für jedes ausgelieferte Produkt.

## Enthaltene Images

| Image | Version | Lizenz | Quelle |
|---|---|---|---|
| `supabase/postgres` | 17.6.1.136 | PostgreSQL License (Kern) · Apache-2.0 (Supabase-Anteile) | https://github.com/supabase/postgres |
| `supabase/gotrue` | v2.189.0 | MIT | https://github.com/supabase/auth |
| `postgrest/postgrest` | v14.12 | MIT | https://github.com/PostgREST/postgrest |
| `supabase/realtime` | v2.102.3 | Apache-2.0 | https://github.com/supabase/realtime |
| `supabase/storage-api` | v1.60.4 | Apache-2.0 | https://github.com/supabase/storage |
| `kong/kong` | 3.9.1 | Apache-2.0 | https://github.com/Kong/kong |
| `caddy` | 2.11.6-alpine (eigener Build mit acmedns-Modul, K2b.4) | Apache-2.0 | https://github.com/caddyserver/caddy |
| `caddy-dns/acmedns` (Caddy-Modul, im frontend-Image) | v0.7.0 | MIT | https://github.com/caddy-dns/acmedns |
| `libdns/acmedns` (Abhängigkeit davon) | v0.5.0 | MIT | https://github.com/libdns/acmedns |
| `praxura/api` (unser Backend) | `:stable` | proprietär, nicht weitergebbar | dieses Repository |
| `praxura/frontend` (Oberfläche + Caddy) | `:stable` | proprietär (Oberfläche) + Apache-2.0 (Caddy-Anteil) | dieses Repository + Caddy-Projekt |

> ⚠️ Die Lizenzspalte ist nach dem jeweiligen Projekt-Repository ausgefüllt,
> **nicht gegen den Inhalt des Images geprüft.** Ein Image enthält Dutzende
> weiterer Pakete (Basis-Distribution, Systembibliotheken, Postgres-Erweiterungen).
> Die belastbare Aussage entsteht erst mit dem SBOM-Schritt (Playbook Phase 6.1a);
> bis dahin ist diese Tabelle eine Arbeitsgrundlage, keine Rechtsauskunft.

### Betriebssystem-Pakete der Basis-Images

Die Container-Images enthalten außerdem Betriebssystem-Pakete ihrer Basis-Images (z. B. Alpine Linux: busybox, musl; Debian/Ubuntu in den Supabase-Images). Diese stehen unter ihren eigenen Lizenzen, teils GPL-2.0. Praxura verändert sie nicht; der Quellcode ist beim jeweiligen Upstream-Projekt erhältlich (alpinelinux.org, debian.org, ubuntu.com) bzw. über die Quell-Links der Basis-Images.

Die npm-Pakete der Server-Komponente und die Bibliotheken/Schriften der Oberfläche stehen mit vollem Lizenztext in „Über diese Software" (`/api/ueber/lizenzen`, `vendor/LICENSES.txt`; O-178).

## Lokaler Barcode-Leser (M3, 07.10.2026)

| Bestandteil | Version | Mitgelieferter Lizenztext | Quelle / Artefakt |
|---|---|---|---|
| ZXing JavaScript | `@zxing/library` 0.21.3 | Apache-2.0 laut Paket-LICENSE; Paket-Metadaten nennen abweichend MIT | npm, `vendor/zxing.js`, `vendor/zxing.LICENSE` |
| ts-custom-error (im ZXing-Bundle) | 3.3.1 | MIT | npm, `vendor/zxing-ts-custom-error.LICENSE` |
| PDF.js + lokaler Worker | `pdfjs-dist` 4.10.38 | Apache-2.0 | npm, `vendor/pdfjs/`, `vendor/pdfjs/LICENSE` |
| PDF.js-Standardfonts (unverändert) | aus `pdfjs-dist` 4.10.38 | Foxit: BSD-Bedingungen; Liberation: SIL OFL 1.1 | `vendor/pdfjs/standard_fonts/LICENSE_FOXIT` und `LICENSE_LIBERATION` |

Erzeugung und SHA-256: `vendor/README.md`, `tools/vendor/build-barcode.mjs`.
Keine zusätzlichen Images, Cloud-Dienste oder Caddy-CSP-Ausnahmen.

## Bewusst nicht enthalten

| Bestandteil | Warum nicht |
|---|---|
| **n8n** | Sustainable Use License verbietet die Weitergabe an zahlende Kunden. Harte Grenze, Leitplanke **G3** — keine Ausnahme, auch nicht „nur intern". |
| `supabase/studio` · `supabase/postgres-meta` | Admin-Oberfläche. Der Kunde soll nicht an der Datenbank schrauben, und wir kommen laut K10 nicht in die Box. |
| `darthsim/imgproxy` | Bildtransformation wird nirgends aufgerufen (geprüft). |
| `supabase/supavisor` | Verbindungs-Pooler für Zugriffe von außen; in der Box verbindet sich niemand von außen. |
| `supabase/edge-runtime` | Deno-Laufzeit. Die drei Fahrtenbuch-Proxys ziehen nach Express um (O-11, Phase 1.5). |

## Regel

Beim Anheben einer Version in `onprem/.env.template`: hier die Versionsspalte
mitziehen **und** prüfen, ob sich die Lizenz geändert hat. Lizenzwechsel
kommen vor — n8n ist genau so von Apache-2.0 auf die Sustainable Use License
gewechselt, und genau deshalb steht es heute auf der Verbotsliste.
