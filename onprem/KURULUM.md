# Praxura Praxis-Box — Installationsanleitung

> Stand 02.10.2026 · Version 0.2.0 · gilt für **Linux-Server** und **Windows-PC**.
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
- ein **Name** für die Box im Praxisnetz, z. B. `praxis.home.arpa` (siehe §3)
- für Sicherungen: eine **externe Platte oder ein NAS** (siehe §6)
- ein Ort für den **Datenschlüssel** (Tresor/Ausdruck, siehe §2.4) — *nicht* auf der Box

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

### 2.1 Adresse (`SITE_URL`)
`https://praxis.home.arpa` — ohne Port, ohne Pfad. `.home.arpa` ist der für
Heimnetze reservierte Namensraum. Bei einer FRITZ!Box geht auch
`https://<pc-name>.fritz.box` (siehe §3).

### 2.2 Echtes Zertifikat?
**n** — die Box ist nur im Praxisnetz erreichbar. Sie stellt sich dann selbst
ein Zertifikat aus; jedes Gerät muss deren Wurzelzertifikat einmal
vertrauen (§4). (`j` nur, wenn die Box unter einer echten Internet-Domain
erreichbar ist.)

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
- **Einrichtungs-Jeton** (`SETUP_TOKEN`) — für den ersten Schritt im Browser.

---

## 3. Den Namen der Box im Praxisnetz bekannt machen

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

**Windows-Netzwerkprofil:** Das Praxisnetz muss in Windows als **„Privat"**
eingestuft sein (Einstellungen → Netzwerk → Eigenschaften), sonst blockt die
Firewall die anderen Geräte. Das Skript warnt, wenn es „Öffentlich" ist.

---

## 4. Wurzelzertifikat auf jedem Gerät vertrauen

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

1. `https://praxis.home.arpa/setup.html` öffnen.
2. Einrichtungs-Jeton aus §2.5 eingeben.
3. **Inhaber-Konto** anlegen (E-Mail, Passwort ≥ 8 Zeichen, Praxisname,
   Fachbereich). Es braucht **keine Bestätigungsmail** — die Box verschickt für
   Konten grundsätzlich keine Mails.
4. Danach `https://praxis.home.arpa/login.html` — fertig.

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

## 8. Wenn etwas nicht geht

| Symptom | Ursache / Lösung |
|---|---|
| Browser: „Website nicht erreichbar" auf dem Tablet | Name nicht im Router (§3), Box-PC schläft, oder Windows-Netz ist „Öffentlich" (§3) |
| Browser: Zertifikatswarnung | Wurzelzertifikat auf diesem Gerät nicht vertraut (§4); iPad: Schritt „Zertifikatsvertrauen" vergessen |
| Seite bleibt weiß | Adresse in der Leiste ≠ `SITE_URL` aus §2.1 — immer genau den Namen benutzen |
| Windows: Box nach Neustart weg | Windows-Passwort geändert → `praxura-installieren.ps1` erneut ausführen |
| Windows: „Port 80 oder 443 ist belegt" | ein anderes Programm (IIS, Skype, anderer Webserver) beenden |
| `install.sh`: „Images konnten nicht geholt werden" | Internet des Servers prüfen; Kanal `stable` evtl. noch nicht veröffentlicht → `beta` |
| Sicherung bricht ab | Sicherungsplatte nicht angesteckt / Markierungsdatei fehlt (§6) |

Alle Meldungen nennen **Gefunden · Erwartet · Was tun**. Bei Rückfragen an
den Support bitte die passende Protokolldatei (ohne `.env`!) mitschicken —
sie enthält keine Geheimnisse.
