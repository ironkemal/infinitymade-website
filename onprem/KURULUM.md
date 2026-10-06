# Praxura Praxis-Box — Installationsanleitung

> Stand 06.10.2026 · Version 0.2.0 · gilt für **Linux-Server** und **Windows-PC**.
> Diese Anleitung ist so geschrieben, dass eine technisch interessierte Person
> die Box ohne uns einrichten kann. Wir haben **keinen Zugang** zu Ihrer Box —
> alle Schlüssel entstehen auf Ihrem Gerät und bleiben dort.

---

## 0. Überblick — was Sie brauchen

| | Linux-Server | Windows-PC |
|---|---|---|
| System | Ubuntu 24.04 LTS | Windows 11 ab 22H2 (Home reicht) |
| Prozessor / RAM | 2 Kerne · 4 GB | 4 Kerne · **8 GB** (die Box bekommt die Hälfte) |
| Freier Speicher | 40 GB | 50 GB auf C: |
| Netz | fest im Praxisnetz, Internet für Updates | dito; PC bleibt **eingeschaltet** |
| Zugang | `sudo`/root per SSH | ein Konto mit Administratorrechten |

Außerdem:
- ein **Einrichtungscode** von Praxura (16 Zeichen im Format `XXXX-XXXX-XXXX-XXXX`), den Sie vorab erhalten
- für Sicherungen: eine **externe Platte oder ein NAS** (siehe §6)
- ein Ort für den **Datenschlüssel** (Tresor/Ausdruck, siehe §2.4) — *nicht* auf der Box
- (nur bei Ausstiegsweg ohne Code: ein eigener **Name** für die Box, siehe §3 und §8)

Die Einrichtung dauert 20–40 Minuten, fast alles davon ist Herunterladen.

---

## 1. Weg A — Linux-Server

```bash
sudo apt update && sudo apt install -y git
sudo git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/ironkemal/infinitymade-website.git /opt/praxura
cd /opt/praxura && sudo git sparse-checkout set onprem
cd /opt/praxura/onprem
sudo bash install.sh
```

`install.sh` prüft die Hardware, bietet bei fehlendem Docker die Installation an
und stellt dann die Fragen aus **§2**. Danach weiter mit **§3**.

## 1. Weg B — Windows-PC

1. **Docker Desktop**, falls vorhanden, beenden und den Autostart ausschalten
   (besser: deinstallieren). Die Box bringt ihren eigenen Docker mit.
2. Datei `praxura-installieren.ps1` herunterladen:
   `https://raw.githubusercontent.com/ironkemal/infinitymade-website/main/onprem/windows/praxura-installieren.ps1`
3. Startmenü → „PowerShell" → Rechtsklick → **Als Administrator ausführen**:
   ```powershell
   cd $env:USERPROFILE\Downloads
   powershell -ExecutionPolicy Bypass -File .\praxura-installieren.ps1
   ```
4. Das Skript richtet eine eigene Linux-Umgebung namens **Praxura** ein
   (Ubuntu 24.04 in WSL2, getrennt von einem evtl. schon vorhandenen Ubuntu).
   Beim allerersten Mal verlangt Windows evtl. einen **Neustart** — danach läuft
   die Einrichtung nach der Anmeldung von selbst weiter.
5. Danach startet automatisch `install.sh` mit den Fragen aus **§2**.
6. Am Ende fragt das Skript noch:
   - nach Ihrem **Windows-Passwort** — damit die Box beim Einschalten des PCs
     startet, auch wenn sich niemand anmeldet. Windows speichert es
     verschlüsselt. ⚠️ **Ändern Sie später Ihr Windows-Passwort, startet die
     Box nicht mehr von selbst** — dann das Skript einfach erneut ausführen.
   - ob Standby/Ruhezustand am Netzteil abgeschaltet werden sollen — **ja**.
     Ein schlafender PC ist für Tablet und zweiten PC nicht erreichbar.

Das Skript ist wiederholbar: es überspringt, was schon erledigt ist.
Protokoll: `C:\ProgramData\Praxura\windows-einrichtung.log`.

**Laptop:** dauerhaft am Netzteil lassen. Mit Akku greifen Windows-Sparregeln.

**Eigenes Windows-Konto für die Box:** Wer an diesem PC mit dem einrichtenden
Konto angemeldet ist, kommt mit `wsl -d Praxura` ohne Passwort an alle
Schlüssel der Box. Den Box-PC deshalb mit einem **eigenen, nicht geteilten**
Windows-Konto betreiben; Mitarbeitende arbeiten im Browser, nicht an diesem
Konto.

---

## 2. Die Fragen von `install.sh`

### 2.1 Einrichtungscode und Name der Box
`install.sh` fragt zuerst nach Ihrem **Einrichtungscode** (16 Zeichen im
Format `XXXX-XXXX-XXXX-XXXX`, von Praxura erhalten). Die Eingabe bleibt
unsichtbar und wird nirgends im Protokoll oder auf der Box gespeichert.

Nach der Eingabe schlägt die Box automatisch einen Namen vor — zwei einfache
Wörter und eine Zahl (z. B. `sonne-tal-42`):
- **J** (oder Enter) übernimmt den vorgeschlagenen Namen.
- **N** fordert einen neuen Namensvorschlag an.

Der übernommene Name ist danach fest. Anschließend ist die Adresse
`https://<name>.<Domain>` (z. B. `https://sonne-tal-42.praxura.de`) auf jedem
Gerät im Praxisnetz ohne zusätzlichen Eintrag in Router oder Netzwerkdateien
erreichbar.

**Enter ohne Code:** Wenn Sie keinen Code eingeben und direkt Enter drücken,
wählen Sie die manuelle Konfiguration mit einer eigenen Adresse (Ausstiegsweg,
siehe §8).

### 2.2 Echtes Zertifikat? (nur Weg „eigene Adresse“)
Diese Frage erscheint nur, wenn Sie in §2.1 keinen Einrichtungscode eingegeben
haben:
- **n** — für ein rein internes Praxisnetz. Die Box stellt sich selbst ein
  internes Zertifikat aus; jedes Gerät muss deren Wurzelzertifikat einmal
  vertrauen (§4).
- **j** — nur, wenn die Box unter einer echten Internet-Domain von außen
  erreichbar ist (Let's Encrypt).

*Hinweis:* Die Box mit Einrichtungscode bekommt ein echtes
Let's-Encrypt-Zertifikat über den Praxura-Namensdienst (DNS-01); auf keinem
Gerät muss etwas importiert werden.

### 2.3 Update-Kanal
- **beta** (Enter) — jede veröffentlichte Version. Für die Pilot-/Testphase.
- **stable** — nur Versionen, die vorher 72 Stunden auf einer Testbox liefen.

⚠️ Wechseln Sie später nur **von beta zu stable, wenn stable mindestens so neu
ist** wie Ihre beta-Version. Andernfalls würde die Box auf eine ältere Version
zurückwollen; sie hält dann bewusst an (Meldung „downgrade") und läuft auf dem
bisherigen Stand weiter. Kanal ändern: in `.env` die beiden Zeilen
`PRAXURA_API_IMAGE=…:beta` / `PRAXURA_FRONTEND_IMAGE=…:beta` anpassen.

### 2.4 Sicherungsziel
Siehe §6. Für den Anfang darf es leer bleiben (dann auf der Box selbst — mit
Warnung).

### 2.5 Am Ende: zwei Werte, die nur EINMAL angezeigt werden
- **`DATA_ENCRYPTION_KEY`** — verschlüsselt Patientenfelder. Ausdrucken oder in
  einen Passwort-Tresor, **nicht** in den Sicherungsordner. Ohne ihn sind die
  verschlüsselten Felder auch mit einer vollständigen Sicherung verloren.
  `install.sh` wartet, bis Sie `GESICHERT` tippen.
- **Einrichtungs-Link** — unter Windows öffnet sich die Einrichtungsseite am Ende
  der Installation automatisch im Browser. Unter Linux zeigt `install.sh` am Ende
  einen einmaligen Link (`https://<ihre-box-adresse>/setup.html#<jeton>`), den Sie
  im Browser eines Praxisgeräts öffnen. Den Link **nicht per Mail oder Chat weitergeben**
  (er ist bis zum Anlegen des Inhaber-Kontos gültig). Als Notlösung lässt sich der Jeton
  auch manuell aus der `.env` (`SETUP_TOKEN`) auslesen und auf `setup.html` eintragen.

---

## 3. Den Namen der Box im Praxisnetz bekannt machen

Beim Standardweg mit **Einrichtungscode** entfällt das Eintragen in Router oder
`hosts`-Dateien vollständig. Die Box wird unter ihrem Namen automatisch im
Praxisnetz gefunden.

### FRITZ!Box: DNS-Rebind-Schutz
Nutzen Sie eine FRITZ!Box, müssen Sie eine Ausnahme eintragen, da der Box-Name
auf eine interne IP-Adresse im Praxisnetz verweist:
1. FRITZ!Box-Benutzeroberfläche im Browser öffnen (`fritz.box`).
2. *Heimnetz → Netzwerk → Netzwerkeinstellungen*.
3. Nach unten scrollen zum Bereich **DNS-Rebind-Schutz**.
4. Unter *Ausnahmen* den vollständigen Namen der Box eintragen
   (z. B. `sonne-tal-42.praxura.de`).
5. Übernehmen / Speichern.

**Telekom Speedport:** Es ist kein Eintrag nötig (in Messungen geprüft, der
Speedport blockiert die interne Namensauflösung nicht).

### Verhalten bei Internetausfall
Die Geräte im Praxisnetz lösen den Namen über das Internet auf. Fällt die
Internetverbindung der Praxis aus, können Geräte den Namen nach einiger Zeit
nicht mehr finden (sobald der lokale Zwischenspeicher abgelaufen ist).

- **Auf dem Box-PC selbst:** `https://localhost` geht wegen des Zertifikats
  nicht. Deshalb trägt die Einrichtung den Namen fest in die lokale
  `hosts`-Datei des Box-Rechners ein (der Windows-Starter erledigt das
  automatisch). Auf dem Box-Rechner selbst lässt sich die Anwendung daher auch
  bei Internetausfall öffnen.
- **Für die anderen Geräte (Tablets, weitere PCs):** Hier hilft bei einem
  Internetausfall aktuell nur das Abwarten, bis die Verbindung wieder steht
  (eine Messung der genauen Ausfallzeit folgt).

---

### Nur für den Weg „eigene Adresse“ (ohne Einrichtungscode)

Die Box antwortet **nur auf ihren Namen**, nicht auf die IP allein.

- **Der Box-PC selbst (Windows):** erledigt das Skript (`hosts`-Eintrag).
- **Alle anderen Geräte** (Tablet, zweiter PC): am besten zentral im Router:
  - Dem Box-Rechner im Router eine **feste IP** geben (DHCP-Reservierung).
  - Einen DNS-Eintrag `praxis.home.arpa → <IP der Box>` anlegen.
  - **FRITZ!Box:** zusätzlich unter *Heimnetz → Netzwerk →
    Netzwerkeinstellungen → DNS-Rebind-Schutz* den Namen `praxis.home.arpa`
    eintragen — sonst verwirft die FRITZ!Box die Antwort. Alternative ohne
    eigenen Eintrag: die FRITZ!Box kennt jedes Gerät als `<gerätename>.fritz.box`;
    dann bei §2.1 genau diesen Namen verwenden.
- **Nur ein einzelner PC, kein Router-Zugriff:** in dessen `hosts`-Datei
  (`C:\Windows\System32\drivers\etc\hosts`, als Administrator bearbeiten):
  `192.168.x.y  praxis.home.arpa`
  — auf Tablets ist das nicht möglich, dort geht nur der Router-Weg.

**Windows-Netzwerkprofil (gilt immer):** Das Praxisnetz muss in Windows als
**„Privat"** eingestuft sein (Einstellungen → Netzwerk → Eigenschaften), sonst
blockt die Firewall die anderen Geräte. Das Skript warnt, wenn es „Öffentlich" ist.

---

## 4. Wurzelzertifikat auf jedem Gerät vertrauen

> **Gilt für:** Nur für den Weg „eigene Adresse“ mit internem Zertifikat.

Datei holen:
- **Windows-Box:** liegt schon unter `C:\ProgramData\Praxura\praxura-wurzelzertifikat.crt`
  und ist auf diesem PC bereits eingetragen.
- **Linux-Server:** `cd /opt/praxura/onprem && sudo docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./praxura-wurzelzertifikat.crt`

Dann je Gerät:

| Gerät | So geht's |
|---|---|
| Windows (Chrome, Edge) | Doppelklick auf die `.crt` → *Zertifikat installieren* → **Lokaler Computer** → *Alle Zertifikate in folgendem Speicher* → **Vertrauenswürdige Stammzertifizierungsstellen** |
| Firefox | *Einstellungen → Datenschutz & Sicherheit → Zertifikate anzeigen → Zertifizierungsstellen → Importieren* (Haken „Websites vertrauen") |
| iPad / iPhone | Datei per Mail/AirDrop öffnen → *Einstellungen → Profil geladen → Installieren*, danach **zusätzlich** *Einstellungen → Allgemein → Info → Zertifikatsvertrauenseinstellungen* → Schalter für „Caddy Local Authority" **einschalten** |
| Android | *Einstellungen → Sicherheit → Verschlüsselung & Anmeldedaten → Zertifikat installieren → CA-Zertifikat* |
| Mac | Doppelklick → Schlüsselbund *System* → Zertifikat öffnen → *Vertrauen: Immer vertrauen* |

Das Zertifikat wird mitgesichert (§6) — nach einer Wiederherstellung müssen
die Geräte es **nicht** neu importieren.

---

## 5. Erster Start im Browser

1. **Einrichtungsseite öffnen:** Unter Windows öffnet sich die Einrichtungsseite
   am Ende der Installation automatisch im Standardbrowser. Unter Linux den am
   Ende von `install.sh` angezeigten Link (`https://<ihre-box-adresse>/setup.html#<jeton>`)
   im Browser eines Praxisgeräts öffnen.
   ⚠️ **Diesen Link nicht per Mail oder Chat weitergeben** — er ist bis zum
   Anlegen des Inhaber-Kontos gültig.
   *(Notlösung: `https://<ihre-box-adresse>/setup.html` direkt öffnen und den
   Jeton aus der `.env` unter `SETUP_TOKEN` im Formular eintragen.)*
2. Die Box prüft den Jeton aus dem Fragment automatisch (der Jeton wird nach dem
   Laden sofort aus der Adresszeile entfernt und verlässt den Browser nicht).
3. **Inhaber-Konto** anlegen (E-Mail, Passwort ≥ 12 Zeichen, Praxisname,
   Fachbereich). Es braucht **keine Bestätigungsmail** — die Box verschickt für
   Konten grundsätzlich keine Mails.
4. Danach `https://<ihre-box-adresse>/login.html` — fertig.

**Mitarbeitende:** im Dashboard unter *Team* anlegen; die Box zeigt einen
**Einrichtungscode**. Damit setzt die Person ihr Passwort selbst. Passwort
vergessen? Der Inhaber vergibt einen neuen Code.

**Inhaber-Passwort vergessen** (am Server, als root):
```bash
cd /opt/praxura/onprem && sudo bash reset-owner-passwort.sh
```
Windows: `wsl -d Praxura -- bash /opt/praxura/onprem/reset-owner-passwort.sh`
Leer lassen = ein sicheres Passwort wird erzeugt und einmal angezeigt. Alle
offenen Sitzungen des Inhabers werden dabei beendet.

---

## 6. Sicherung

Die Box sichert **jede Nacht um 01:00** (Datenbank, Dateien, Box-Zertifikat)
und zusätzlich vor jedem Update, das die Datenbank ändert.

**Ziel einrichten** — die Sicherung muss auf einem **anderen Datenträger**
liegen als die Box, sonst ist bei einem Plattendefekt beides weg.

- **Linux:** NAS/Platte dauerhaft einbinden (`/etc/fstab`), z. B. nach
  `/mnt/sicherung`, dann bei §2.4 `/mnt/sicherung/praxura` angeben.
- **Windows, externe USB-Platte (z. B. Laufwerk E:):**
  ```powershell
  wsl -d Praxura -- bash -c "mkdir -p /mnt/praxura-sicherung && echo 'E: /mnt/praxura-sicherung drvfs defaults,nofail 0 0' >> /etc/fstab && mount -a && mkdir -p /mnt/praxura-sicherung/praxura"
  ```
  und `BACKUP_ZIEL=/mnt/praxura-sicherung/praxura` in `/opt/praxura/onprem/.env`.

**Wichtig — die Markierungsdatei:** `install.sh` legt im Ziel eine Datei
`.praxura-backup-ziel` an. Wird das Ziel nachträglich gesetzt, einmal von Hand:
```bash
sudo touch /mnt/…/praxura/.praxura-backup-ziel
```
Ist die Platte einmal **nicht angesteckt**, fehlt die Datei — die Sicherung
bricht dann **laut ab** (Meldung „Yedek hedefi bağlı değil"), statt still auf
die Box-Platte zu schreiben. Das Update in derselben Nacht wird dann ebenfalls
nicht ausgeführt (ohne Sicherung kein Update).

**Empfehlung:** Box-Platte und Sicherungsplatte verschlüsseln (Windows:
BitLocker; Linux: LUKS bei der Installation). Für den Betrieb der Box und die
Patientendaten auf ihr ist die Praxis verantwortlich, nicht Praxura.

⚠️ **Die Sicherungsplatte ist so schutzwürdig wie die Box selbst.** Sie enthält
neben den Patientendaten auch den **privaten Schlüssel der Box-Zertifizierungs-
stelle**. Weil jedes Praxisgerät dieser Stelle vertraut, könnte jemand mit der
Platte (und Zugang zum Praxisnetz) gefälschte Zertifikate für beliebige
Webseiten ausstellen. Platte verschlüsseln, verschlossen aufbewahren, nicht
verleihen. Geht sie verloren: Wurzelzertifikat auf allen Geräten entfernen und
die Box neu einrichten.

**Wiederherstellen:**
```bash
cd /opt/praxura/onprem && sudo bash restore.sh --von <ordnername>
```
Am Ende zeigt `restore.sh` die **§302-Referenzzähler** an. Wurden nach dem
Zeitpunkt der Sicherung noch Abrechnungsdateien verschickt, steht der Zähler zu
niedrig — die Annahmestelle würde eine schon benutzte Nummer ablehnen.
`restore.sh` druckt den Befehl zum Vorstellen gleich mit aus.

---

## 7. Betrieb

| Was | Wie |
|---|---|
| Updates | automatisch jede Nacht 02:00–04:00 (`praxura-update.timer`). Sofort: `sudo bash update.sh --jetzt` |
| Status | `cd /opt/praxura/onprem && sudo docker compose ps` — 8 Dienste, alle `healthy` |
| Protokolle | `install.log`, `update.log`, `backup.log`, `restore.log` im selben Ordner |
| Neustart des PCs/Servers | die Box kommt von selbst wieder (1–2 Minuten) |
| Mails an Patienten (Terminbestätigung) | **optional**: Mailserver der Praxis in `.env` (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` mit Ihrer eigenen Domain), dann `sudo docker compose up -d api` |
| KI-Funktionen (Rezept-Scan u. a.) | in dieser Version **aus** (`AI_MODE=aus`) — die Funktionen zeigen eine Meldung statt zu arbeiten |

Windows: jeden Befehl mit `wsl -d Praxura -- ` davor ausführen, z. B.
`wsl -d Praxura -- bash -c "cd /opt/praxura/onprem && docker compose ps"`.

---

## 8. Ausstiegsweg: ohne Praxura-Namensdienst

Dieser Abschnitt beschreibt, wie Sie die Praxis-Box unabhängig vom
Praxura-Namensdienst betreiben oder umstellen können.

- **Wann dieser Weg greift:**
  - Sie haben keinen Einrichtungscode oder möchten keinen externen Namensdienst nutzen.
  - Der Praxura-Dienst ist dauerhaft nicht erreichbar oder Praxura existiert nicht mehr.
  - Eine Erstinstallation auf **neuer Hardware** mit „Enter ohne Code“ (siehe §2.1)
    führt ebenfalls direkt auf diesen Weg. ⚠️ War die Box schon einmal mit Code
    eingerichtet, übernimmt auch `install.sh --neu` den alten Namen wieder
    (die Box-Identität bleibt erhalten) — dann nach der Installation die Werte
    aus Weg 1 bzw. 2 erneut in `.env` eintragen und die Box neu starten.
- **Was passiert, wenn der Namensdienst wegfällt:**
  Der bisherige Name bleibt nur so lange im DNS, wie die Domain dahinter
  besteht — darauf sollten Sie sich nicht verlassen. Ändert sich die IP-Adresse
  der Box, wird der Name nicht mehr nachgeführt; geben Sie der Box deshalb im
  Router eine **feste IP-Adresse** (DHCP-Reservierung). Sobald die Box ein echtes
  Zertifikat über den Namensdienst bezieht, läuft es
  ohne Dienst spätestens nach **90 Tagen** ab.
  ⚠️ **Ihre Daten in der Box sind davon NICHT betroffen** — alles läuft lokal
  in Ihrer Praxis.
  **Planen Sie den Umstieg bei einer Kündigung, nicht erst, wenn das Zertifikat
  abläuft.**

### Weg 1 — Eigene Domain der Praxis
Nutzen Sie einen Namen unter Ihrer eigenen Praxis-Domain (z. B. `box.praxis-beispiel.de`):
1. **DNS-Eintrag anlegen:** Beim eigenen DNS-Anbieter einen A-Eintrag für den
   Namen (z. B. `box.praxis-beispiel.de`) auf die lokale IP-Adresse der Box im
   Praxisnetz setzen.
2. **Konfiguration in `.env` anpassen:** In `/opt/praxura/onprem/.env` folgende
   Werte eintragen:
   ```env
   SITE_URL=https://box.praxis-beispiel.de
   API_EXTERNAL_URL=https://box.praxis-beispiel.de
   SUPABASE_PUBLIC_URL=https://box.praxis-beispiel.de
   CADDY_TLS_MODUS=klassisch
   CADDY_TLS_ARG=internal
   ```
   Wichtig: Ohne die Zeile `CADDY_TLS_MODUS=klassisch` bleibt die Box im
   Namensdienst-Modus. Mit `internal` muss jedes Gerät einmal das
   Wurzelzertifikat der Box vertrauen (§4). Nutzen Sie eine FRITZ!Box, tragen
   Sie auch diesen Namen als Ausnahme beim DNS-Rebind-Schutz ein (§3).
   *(Nur wenn die Box tatsächlich aus dem Internet erreichbar ist — etwa ein
   eigener Cloud-Server —, tragen Sie bei `CADDY_TLS_ARG` stattdessen eine
   E-Mail-Adresse für Let's Encrypt ein. Für eine Box im Praxisnetz: dafür
   **keine Ports im Router öffnen**; mit einer internen IP-Adresse schlägt
   dieser Weg ohnehin fehl.)*
3. **Box neu starten:**
   ```bash
   cd /opt/praxura/onprem && sudo docker compose up -d
   ```
   **Windows:** zuerst `wsl -d Praxura -- bash -c "cd /opt/praxura/onprem && docker compose up -d"`,
   danach `praxura-installieren.ps1` erneut als Administrator ausführen. Es liest
   die neue Adresse aus `.env` und ersetzt den Eintrag in der `hosts`-Datei des
   Box-PCs — ohne diesen Eintrag lässt sich die Box auf dem Box-PC selbst nicht
   öffnen.
4. **Hinweis:** Passwörter bleiben gültig, aber alle Mitarbeiter müssen sich
   unter der neuen Adresse **einmal neu anmelden**. Links in bereits früher
   verschickten Patienten-Mails zeigen weiterhin auf die alte Adresse.

### Weg 2 — Letzter Ausweg ohne Domain
Haben Sie keine eigene Internet-Domain, wählen Sie einen rein internen Namen:
- Interner Name (z. B. `https://praxis.home.arpa`) in `.env`.
- `CADDY_TLS_MODUS=klassisch` in `.env`.
- `CADDY_TLS_ARG=internal` in `.env`.
- Wurzelzertifikat auf jedem Praxisgerät importieren (siehe §4).
- Name im Router oder in den `hosts`-Dateien eintragen (siehe §3).

---

## 9. Wenn etwas nicht geht

| Symptom | Ursache / Lösung |
|---|---|
| Browser: „Website nicht erreichbar" auf dem Tablet | Name nicht im Router (§3), Box-PC schläft, Windows-Netz ist „Öffentlich" (§3), oder FRITZ!Box-Rebind-Schutz blockiert (§3) |
| Browser: Zertifikatswarnung | Wurzelzertifikat auf diesem Gerät nicht vertraut (§4); iPad: Schritt „Zertifikatsvertrauen" vergessen |
| Seite bleibt weiß | Adresse in der Leiste ≠ `SITE_URL` aus §2.1 — immer genau den Namen benutzen |
| Windows: Box nach Neustart weg | Windows-Passwort geändert → `praxura-installieren.ps1` erneut ausführen |
| Windows: „Port 80 oder 443 ist belegt" | ein anderes Programm (IIS, Skype, anderer Webserver) beenden |
| `install.sh`: „Images konnten nicht geholt werden" | Internet des Servers prüfen; Kanal `stable` evtl. noch nicht veröffentlicht → `beta` |
| Sicherung bricht ab | Sicherungsplatte nicht angesteckt / Markierungsdatei fehlt (§6) |
| Box-Oberfläche lädt gar nicht, `docker compose logs caddy` zeigt `Failed to read config file` | Zertifikatszugang der Box (`acmedns.json`) fehlt → `install.sh` erneut ausführen (legt Zugang über den Code-Weg neu an oder fällt auf internes Zertifikat zurück); als Notlösung in `.env` `CADDY_TLS_MODUS=klassisch` + `CADDY_TLS_ARG=internal` setzen und `docker compose up -d` (dann §4) |

Alle Meldungen nennen **Gefunden · Erwartet · Was tun**. Bei Rückfragen an
den Support bitte die passende Protokolldatei (ohne `.env`!) mitschicken —
sie enthält keine Geheimnisse.

### Box neu verbinden (Wiederverbindungs-Code)

#### Fall A — Neue Hardware oder Rücksicherung (Identität fehlt)
Führen Sie die normale Installation aus (`install.sh` bzw.
`praxura-installieren.ps1`). Geben Sie den vom Support erhaltenen
Wiederverbindungs-Code ein — der bisherige Name wird automatisch übernommen.

#### Fall B — Identität vorhanden, Schlüssel soll ersetzt werden
Dieser Schritt erfolgt **nur auf ausdrückliche Anweisung des Supports**
(z. B. wenn ein Schlüssel ausgetauscht werden soll).

Führen Sie genau diesen Befehl aus (nicht abwandeln, und den Code nicht als Teil
der Kommandozeile tippen):

```bash
cd /opt/praxura/onprem
read -rs KAYIT_CODE; export KAYIT_CODE
docker compose --profile kurulum run --rm --no-deps -e KAYIT_CODE kayit --neuer-schluessel
unset KAYIT_CODE
```

Windows:
```powershell
wsl -d Praxura -- bash -c "cd /opt/praxura/onprem && read -rs KAYIT_CODE; export KAYIT_CODE; docker compose --profile kurulum run --rm --no-deps -e KAYIT_CODE kayit --neuer-schluessel; unset KAYIT_CODE"
```

⚠️ **Hinweis:** Die Box-Identität (Volumes `kimlik`, `acmedns`) gehört nicht in
die Sicherung und wird bei `install.sh --neu` nicht gelöscht — nicht von Hand
löschen.
