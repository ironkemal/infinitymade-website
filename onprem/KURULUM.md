# Praxura Praxis-Box — Installationsanleitung

> Stand 07.10.2026 · Version 0.4.0 · gilt für **Linux-Server**, **Windows-PC** und **Server bei Hetzner Cloud**.
> Diese Anleitung ist so geschrieben, dass eine technisch interessierte Person
> die Box ohne uns einrichten kann. Wir haben **keinen Zugang** zu Ihrer Box —
> alle Schlüssel entstehen auf Ihrem Server bzw. PC und bleiben dort.

---

## 0. Überblick — was Sie brauchen

| | Linux-Server (Praxis) | Windows-PC (Praxis) | Hetzner Cloud Server |
|---|---|---|---|
| System | Ubuntu 24.04 LTS | Windows 11 ab 22H2 (Home reicht) | Ubuntu 24.04 LTS (x86) |
| Typ / RAM | 2 Kerne · 4 GB | 4 Kerne · **8 GB** (die Box bekommt die Hälfte) | CX33 (4 vCPU · 8 GB RAM) |
| Freier Speicher | 40 GB | 50 GB auf C: | 80 GB (CX33) |
| Netz | fest im Praxisnetz, Internet für Updates | dito; PC bleibt **eingeschaltet** | Hetzner Cloud Firewall (80, 443; 22 eingeschränkt) |
| Zugang | `sudo`/root per SSH | ein Konto mit Administratorrechten | SSH-Schlüssel (root) |

Außerdem:
- ein **Einrichtungscode** von Praxura (16 Zeichen im Format `XXXX-XXXX-XXXX-XXXX`), den Sie vorab erhalten
- für Sicherungen: eine **externe Platte oder ein NAS** bei lokalem Betrieb bzw. ein **Hetzner Volume oder Storage Box** bei Cloud-Betrieb (siehe §5)
- ein Ort für den **Datenschlüssel** (Tresor/Ausdruck, siehe §2.5) — *nicht* auf der Box
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

### Grenzen eines einzelnen Windows-PCs

- **PC ausgeschaltet:** Ist der PC aus, läuft die Praxis-Box nicht.
- **Schlaf- und Ruhezustand:** Wechselt der PC in den Energiesparmodus, können
  weder Tablets noch weitere Praxis-PCs auf die Anwendung zugreifen. Ein Laptop
  muss dauerhaft am Netzteil betrieben werden.
- **Windows-Passwort zwingend:** Ohne ein hinterlegtes Windows-Passwort startet
  die Box erst, wenn sich ein Benutzer am PC anmeldet. In diesem Fall laufen
  auch die nächtliche Sicherung (01:00 Uhr) und das nächtliche Update (02:00 Uhr)
  nicht automatisch durch.
- **Benutzerkonto nicht teilen:** Nutzen Sie ein eigenes Windows-Konto für die
  Box, wie oben beschrieben.
- **Hinweis zu Fehlversuchen (nicht gemessen):** Unter Windows sieht die Box
  andere Praxisgeräte netzwerkbedingt eventuell alle unter derselben internen
  Adresse. In diesem Fall zählen fehlgeschlagene Anmeldeversuche für alle Geräte
  gemeinsam: Mehrere falsche Passworteingaben hintereinander können die Anmeldung
  für alle Praxisgeräte für einige Minuten sperren. (Dieser Punkt wird derzeit
  in Messungen genauer untersucht.)
- **Sicherungsziel extern anbinden:** Unter Windows sollte das Sicherungsziel
  unmittelbar nach der Installation auf eine externe USB-Festplatte gelegt
  werden (siehe §2.4 und §5), da die interne virtuelle Festplatte sonst stetig
  anwächst.

## 1. Weg C — Server bei Hetzner Cloud

Sie können die Box auf einem eigenen Cloud-Server bei Hetzner Cloud betreiben.
Dieser Weg steht gleichwertig neben Weg A und B.

- **Servertyp:** Wählen Sie den Typ **CX33** (x86-Architektur, 4 vCPU, 8 GB RAM,
  80 GB Festplatte). Wählen Sie *nicht* den kleineren Typ CX23: Dessen 40-GB-Platte
  bietet nach Abzug des Betriebssystems nur ca. 36 GB freien Speicherplatz —
  `install.sh` bricht unter 40 GB freiem Speicherplatz bewusst ab.
- **Architektur nur x86:** Wählen Sie keine Server mit ARM-Prozessor (keine CAX-Typen).
  Die Software-Pakete liegen derzeit nur für `amd64` (x86) vor; auf ARM bricht
  die Installation mit einem Fehler („no matching manifest") ab.
- **Standort:** Wir empfehlen ein Rechenzentrum in Deutschland (Falkenstein oder Nürnberg).
  Ein europäischer Standort wie Helsinki (EU) ist rechtlich ebenfalls möglich
  (Details zu § 393 SGB V in **§9**).
- **Betriebssystem & Zugang:** Wählen Sie **Ubuntu 24.04**. Hinterlegen Sie beim
  Erstellen des Servers Ihren **SSH-Schlüssel** (Hetzner vergibt dann kein unsicheres
  Root-Passwort).
- **Firewall:** Nutzen Sie die **Hetzner Cloud Firewall** in der Hetzner-Konsole,
  **nicht** `ufw` auf dem Server. *(Hintergrund: Von Docker veröffentlichte Ports
  umgehen die lokale Linux-Firewall `ufw` standardmäßig.)*
  Richten Sie in der Hetzner Cloud Firewall folgende Regeln ein:
  - **Eingehend:**
    - `80/tcp` — Quelle: Any IPv4 + Any IPv6
    - `443/tcp` — Quelle: Any IPv4 + Any IPv6
    - `443/udp` — Quelle: Any IPv4 + Any IPv6 (für HTTP/3)
    - `22/tcp` (SSH) — Quelle: nur Ihre eigene feste Admin-IP-Adresse oder gar nicht
      freigeben (für Notfälle steht die browserbasierte Web-Konsole von Hetzner bereit)
  - **Ausgehend:** Keine Regeln einschränken (die Box benötigt ausgehenden Zugang
    für System-Updates, Zertifikatsabrufe und den Namensdienst).
- **Installation durchführen:** Verbinden Sie sich per SSH mit Ihrem Server und
  führen Sie dieselben Befehle wie bei Weg A aus:
  ```bash
  sudo apt update && sudo apt install -y git
  sudo git clone --depth 1 --filter=blob:none --sparse \
    https://github.com/ironkemal/infinitymade-website.git /opt/praxura
  cd /opt/praxura && sudo git sparse-checkout set onprem
  cd /opt/praxura/onprem
  sudo bash install.sh
  ```
  Ihr Einrichtungscode funktioniert auch auf dem Cloud-Server unverändert. Die Box
  erkennt die öffentliche IP-Adresse automatisch. Der FRITZ!Box-Rebind-Schritt
  aus §3 entfällt hier vollständig.
- **Schlüssel bleiben bei der Praxis:** Praxura erhält keinen SSH-Schlüssel zu
  Ihrem Server. Auch wenn Sie bei technischen Fragen eine gemeinsame
  Bildschirmfreigabe nutzen, verwenden Sie ausschließlich Ihren eigenen Schlüssel.
- **Sicherung bei Hetzner:** Als Sicherungsziel dient eine Hetzner Storage Box
  (im Praxis-Konto buchbar, ca. 4 €/Monat; Einbindung siehe §5) oder ein separates
  Hetzner Volume (nach Größe abgerechnet). Wir benennen die Grenze offen und ehrlich:
  Die Box verschlüsselt jede Sicherung, bevor sie auf das Ziel geschrieben wird;
  öffnen kann sie nur, wer den **Sicherungsschlüssel** hat (§2.5 — liegt nur bei
  Ihnen). Zusätzliche Hetzner-Snapshots oder Server-Backups können
  Sie als Ergänzung nutzen; beachten Sie aber, dass diese stets das gesamte
  Plattenabbild einschließlich der Konfigurationsdatei `.env` und damit des
  Datenschlüssels (`DATA_ENCRYPTION_KEY`) enthalten.

### Linux-Server absichern (gilt für Weg A und Weg C)

Führen Sie diese Schritte auf jedem Linux-Server (Praxis-Server oder Hetzner Cloud)
aus, um das System abzusichern:

1. **SSH absichern:**
   Legen Sie die Datei `/etc/ssh/sshd_config.d/00-praxura.conf` mit folgendem
   Inhalt an:
   ```text
   PasswordAuthentication no
   PermitRootLogin prohibit-password
   ```
   *(Der Name beginnt bewusst mit `00-`, da der SSH-Dienst die erste gefundene
   Einstellung nutzt und spätere Konfigurationsdateien wie `50-cloud-init.conf`
   sonst Vorrang hätten.)*
   Konfiguration neu laden:
   ```bash
   sudo systemctl reload ssh
   ```
   Prüfen, ob die Werte aktiv sind:
   ```bash
   sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
   ```
2. **Automatische Sicherheitsupdates prüfen:**
   Ubuntu 24.04 spielt über `unattended-upgrades` standardmäßig Sicherheitsupdates
   ein. Prüfen Sie die Einstellung mit:
   ```bash
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```
3. **Docker von automatischen Updates ausschließen:**
   Damit Docker nicht unkontrolliert im Praxisbetrieb neu startet, schließen Sie
   die Docker-Pakete von unbeaufsichtigten Updates aus. Erstellen Sie die Datei
   `/etc/apt/apt.conf.d/51praxura-unattended`:
   ```text
   Unattended-Upgrade::Package-Blacklist {
     "docker-ce";
     "docker-ce-cli";
     "containerd.io";
     "docker-compose-plugin";
     "docker-buildx-plugin";
     "docker-ce-rootless-extras";
   };
   Unattended-Upgrade::Automatic-Reboot "true";
   Unattended-Upgrade::Automatic-Reboot-Time "05:30";
   ```
   Docker selbst aktualisieren Sie bei Bedarf manuell in einer ruhigen Stunde
   (etwa einmal im Monat).
4. **Zeitpunkt für Systemneustarts anpassen:**
   Passen Sie den täglichen Aktualisierungs-Timer an:
   ```bash
   sudo systemctl edit apt-daily-upgrade.timer
   ```
   Fügen Sie folgenden Inhalt ein:
   ```ini
   [Timer]
   OnCalendar=
   OnCalendar=*-*-* 04:30
   RandomizedDelaySec=0
   ```
   *Begründung des Zeitplans:* Die Praxura-Sicherung startet um 01:00 Uhr (Dauer
   bis zu 15 Minuten). Das automatische Praxura-Update startet um 02:00 Uhr
   (mit einer zufälligen Verzögerung von bis zu 2 Stunden, also Start bis
   spätestens 04:00 Uhr). Ein eventueller Systemneustart erfolgt um 05:30 Uhr.
   Beide Praxura-Dienste holen verpasste Läufe beim Hochfahren automatisch nach.

*(Hinweis für Windows-PCs: Das Gegenstück zu diesen Einstellungen ist Windows
Update. Unter Windows 11 Home lässt sich die genaue Neustartzeit nicht frei
wählen; die Nutzungszeit kann maximal 18 Stunden umfassen. Ein nächtlicher
Windows-Neustart kann Sicherung und Update verschieben; beide laufen nach dem
Start von selbst nach, sofern das Windows-Passwort für den automatischen Start
hinterlegt ist.)*

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
`https://<name>.<Domain>` (z. B. `https://sonne-tal-42.box.praxura.de`) auf jedem
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
  vertrauen (siehe §8.3).
- **j** — nur, wenn die Box unter einer echten Internet-Domain von außen
  erreichbar ist (Let's Encrypt).

*Hinweis:* Die Box mit Einrichtungscode bekommt ein anerkanntes
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
Siehe §5.
- **Linux-Server (Praxis):** Für den Anfang darf die Eingabe leer bleiben (dann
  sichert die Box auf die eigene Festplatte — mit Warnung). Bei einem **Hetzner
  Cloud Server** tragen Sie hier den Pfad zum eingebundenen Sicherungsvolume /
  zur Storage Box ein (z. B. `/mnt/sicherung/praxura`, siehe Weg C in §1 und §5).
- **Windows:** Für den Anfang darf die Eingabe leer bleiben. Richten Sie die
  Sicherung unmittelbar nach der Installation gemäß §5 auf einer externen
  USB-Festplatte ein (z. B. `/mnt/praxura-sicherung/praxura`). Die virtuelle
  Festplatte unter Windows wächst dynamisch und gibt freien Speicherplatz auf
  Laufwerk C: nicht automatisch wieder frei.

### 2.5 Am Ende: Werte, die nur EINMAL angezeigt werden
- **`DATA_ENCRYPTION_KEY`** — verschlüsselt Patientenfelder. Ausdrucken oder in
  einen Passwort-Tresor, **nicht** in den Sicherungsordner. Ohne ihn sind die
  verschlüsselten Felder auch mit einer vollständigen Sicherung verloren.
- **Sicherungsschlüssel** (`AGE-SECRET-KEY-1…`) — öffnet Ihre Sicherungen. Die Box
  behält nur den öffentlichen Teil und kann damit verschlüsseln, aber nichts
  öffnen. Zusammen mit dem `DATA_ENCRYPTION_KEY` auf denselben Notfallzettel bzw.
  in denselben Tresor, **nicht** in den Sicherungsordner. **Ohne ihn sind alle
  Sicherungen unlesbar** — auch für Praxura.
- `install.sh` wartet, bis Sie `GESICHERT` tippen (eine Bestätigung für beide Schlüssel).
- **Einrichtungs-Link** — unter Windows öffnet sich die Einrichtungsseite am Ende
  der Installation automatisch im Browser. Unter Linux zeigt `install.sh` am Ende
  einen Link (`https://<ihre-box-adresse>/setup.html#<jeton>`), den Sie im Browser
  eines Praxisgeräts öffnen.
  - Der Link ist **14 Tage lang gültig**.
  - Den Link **nicht per Mail oder Chat weitergeben**.
  - Der Link bleibt gültig, bis Sie den **letzten Schritt der Einrichtung**
    („Einrichtung abschließen") durchführen (nicht nur bis zum Anlegen des
    Inhaber-Kontos).
  - Ist der Link abgelaufen oder verloren gegangen, erzeugen Sie vor Abschluss
    der Einrichtung einen neuen:
    - Linux: `sudo bash install.sh --neuer-jeton`
    - Windows: `powershell -ExecutionPolicy Bypass -File .\praxura-installieren.ps1 -NeuerJeton`
    Ein neuer Link macht den bisherigen Link sofort ungültig.
  - Als Notlösung lässt sich der Jeton auch manuell aus der `.env` (`SETUP_TOKEN`)
    auslesen und im Formular auf `setup.html` eintragen.

---

## 3. Den Namen der Box im Praxisnetz bekannt machen

Beim Standardweg mit **Einrichtungscode** entfällt das Eintragen in Router oder
`hosts`-Dateien vollständig. Die Box wird unter ihrem Namen automatisch im
Praxisnetz gefunden.

### FRITZ!Box: DNS-Rebind-Schutz
Nutzen Sie eine FRITZ!Box im Praxisnetz, müssen Sie eine Ausnahme eintragen, da der
Box-Name auf eine interne IP-Adresse im Praxisnetz verweist (bei Cloud-Servern
nach Weg C ist dieser Schritt nicht nötig):
1. FRITZ!Box-Benutzeroberfläche im Browser öffnen (`fritz.box`).
2. *Heimnetz → Netzwerk → Netzwerkeinstellungen*.
3. Nach unten scrollen zum Bereich **DNS-Rebind-Schutz**.
4. Unter *Ausnahmen* den vollständigen Namen der Box eintragen
   (z. B. `sonne-tal-42.box.praxura.de`).
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
- **Zertifikat:** Bei diesem Weg muss jedes Gerät einmal das interne
  Wurzelzertifikat der Box importieren (siehe §8.3).

**Windows-Netzwerkprofil (gilt immer):** Das Praxisnetz muss in Windows als
**„Privat"** eingestuft sein (Einstellungen → Netzwerk → Eigenschaften), sonst
blockt die Firewall die anderen Geräte. Das Skript warnt, wenn es „Öffentlich" ist.

---

## 4. Erster Start im Browser

1. **Einrichtungsseite öffnen:** Unter Windows öffnet sich die Einrichtungsseite
   am Ende der Installation automatisch im Standardbrowser. Unter Linux den am
   Ende von `install.sh` angezeigten Link (`https://<ihre-box-adresse>/setup.html#<jeton>`)
   im Browser eines Praxisgeräts öffnen.
   - Der Link ist **14 Tage gültig**.
   - ⚠️ **Diesen Link nicht per Mail oder Chat weitergeben.**
   - Ist der Link verloren oder abgelaufen, fordern Sie vor Abschluss der Einrichtung
     einen neuen Link an:
     - Linux: `sudo bash install.sh --neuer-jeton`
     - Windows: `powershell -ExecutionPolicy Bypass -File .\praxura-installieren.ps1 -NeuerJeton`
     Der neue Link macht den vorherigen ungültig.
   *(Notlösung: `https://<ihre-box-adresse>/setup.html` direkt öffnen und den
   Jeton aus der `.env` unter `SETUP_TOKEN` im Formular eintragen.)*
2. Die Box prüft den Jeton aus dem Fragment automatisch (der Jeton wird nach dem
   Laden sofort aus der Adresszeile entfernt und verlässt den Browser nicht).
3. **Inhaber-Konto** anlegen (E-Mail, Passwort ≥ 12 Zeichen, Praxisname,
   Fachbereich). Es braucht **keine Bestätigungsmail** — die Box verschickt für
   Konten grundsätzlich keine Mails.
4. **Einrichtung abschließen:** Nach dem letzten Schritt der Ersteinrichtung
   wird der Einrichtungslink dauerhaft ungültig. Rufen Sie die Einrichtungsseite
   später erneut auf, zeigt sie „Bereits eingerichtet" und verweist auf die
   Anmeldung. Das nächste nächtliche Update entfernt den Jeton auch vollständig
   aus der `.env`.
5. Danach Anmeldung unter `https://<ihre-box-adresse>/login.html` — fertig.

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

## 5. Sicherung

Die Box sichert **jede Nacht um 01:00** (Datenbank, Dateien, Box-Zertifikat)
und zusätzlich vor jedem Update, das die Datenbank ändert.

**Ziel einrichten** — die Sicherung muss auf einem **anderen Datenträger**
liegen als die Box, sonst ist bei einem Plattendefekt beides weg.

- **Linux-Server (Praxis):** NAS/Platte dauerhaft einbinden (`/etc/fstab`), z. B. nach
  `/mnt/sicherung`, dann bei §2.4 `/mnt/sicherung/praxura` angeben.
- **Windows, externe USB-Platte (z. B. Laufwerk E:):**
  ```powershell
  wsl -d Praxura -- bash -c "mkdir -p /mnt/praxura-sicherung && echo 'E: /mnt/praxura-sicherung drvfs defaults,nofail 0 0' >> /etc/fstab && mount -a && mkdir -p /mnt/praxura-sicherung/praxura"
  ```
  und `BACKUP_ZIEL=/mnt/praxura-sicherung/praxura` in `/opt/praxura/onprem/.env`.
- **Hetzner Cloud Server:** Storage Box oder Volume nach Hetzner-Anleitung dauerhaft
  einbinden (z. B. unter `/mnt/sicherung`), dann bei §2.4 bzw. in `.env`
  `BACKUP_ZIEL=/mnt/sicherung/praxura` und die Markierungsdatei wie unten anlegen
  (rechtliche Hinweise siehe §9).

**Wichtig — die Markierungsdatei:** `install.sh` legt im Ziel eine Datei
`.praxura-backup-ziel` an. Wird das Ziel nachträglich gesetzt, einmal von Hand:
```bash
sudo touch /mnt/<sicherungsordner>/praxura/.praxura-backup-ziel
```
Windows:
```powershell
wsl -d Praxura -- touch /mnt/praxura-sicherung/praxura/.praxura-backup-ziel
```
Ist die Platte einmal **nicht angesteckt**, fehlt die Datei — die Sicherung
bricht dann **laut ab** (Meldung „Yedek hedefi bağlı değil" / Sicherungsziel nicht
verbunden), statt still auf die Box-Platte zu schreiben. Das Update in derselben
Nacht wird dann ebenfalls nicht ausgeführt (ohne Sicherung kein Update).

**Empfehlung:** Box-Platte und Sicherungsplatte verschlüsseln (Windows:
BitLocker; Linux: LUKS bei der Installation). Für den Betrieb der Box und die
Patientendaten auf ihr ist die Praxis verantwortlich, nicht Praxura.

⚠️ **Gilt nur bei internem Zertifikat (§8.3):** Die Sicherungsplatte ist in diesem
Fall so schutzwürdig wie die Box selbst. Sie enthält neben den Patientendaten auch
den **privaten Schlüssel der Box-Zertifizierungsstelle**. Weil jedes Praxisgerät
dieser Stelle vertraut, könnte jemand mit der Platte (und Zugang zum Praxisnetz)
gefälschte Zertifikate für beliebige Webseiten ausstellen. Platte verschlüsseln,
verschlossen aufbewahren, nicht verleihen. Geht sie verloren: Wurzelzertifikat auf
allen Geräten entfernen und die Box neu einrichten. *(Hinweis: Beim Standardweg
mit Einrichtungscode wird kein privater CA-Schlüssel gesichert, da die Zertifikate
über Let's Encrypt bezogen werden.)*

**Sicherungsschlüssel:** Ist keiner eingerichtet (z. B. Box vor Oktober 2026), bricht
die Sicherung ab und nennt den Weg — einmal ausführen:
```bash
cd /opt/praxura/onprem && sudo bash install.sh --sicherungsschluessel
```
Die Box erzeugt dann einen Schlüssel und zeigt ihn einmal an — oder Sie geben einen
eigenen öffentlichen Schlüssel (`age1…`) ein. Wird ein vorhandener Schlüssel
ersetzt, lassen sich ältere Sicherungen nur noch mit dem **alten** Schlüssel öffnen.

**Box vor der Sicherungsverschlüsselung eingerichtet:** Auf so einer Box kennt das
alte `install.sh` den Befehl oben noch nicht. Das automatische Update hält dann an,
rollt alles zurück, schickt eine Mail und legt im Box-Ordner eine Kopie des neuen
Programms ab. Bis Sie den Schlüssel einrichten, kommen **keine Updates**, und die
nächtliche Sicherung der alten Version läuft **unverschlüsselt**. Einmal ausführen:
```bash
cd /opt/praxura/onprem && sudo bash install-sicherungsschluessel.sh --sicherungsschluessel
```
Das nächste Update läuft danach normal durch und entfernt die Kopie wieder.

**Alarm-Mail:** Schlägt die nächtliche Sicherung fehl, bekommt die Inhaber-Adresse
eine kurze Mail (nur wenn ein Mailserver eingerichtet ist; Wiederholung höchstens
alle 7 Tage). Die Ursache steht in `backup.log` im Box-Ordner.

**Wiederherstellen:**
```bash
cd /opt/praxura/onprem && sudo bash restore.sh --von <ordnername>
```
`restore.sh` fragt nach dem Sicherungsschlüssel (Eingabe unsichtbar) — oder er
liegt als Datei vor, z. B. auf einem USB-Stick: `--schluessel /pfad/zur/datei`.
Vor jeder Änderung prüft `restore.sh`, ob die Sicherung unverändert und von dieser
Box ist und ob der Schlüssel passt; sonst bricht es ab, ohne etwas anzufassen.
Am Ende zeigt `restore.sh` die **§302-Referenzzähler** an. Wurden nach dem
Zeitpunkt der Sicherung noch Abrechnungsdateien verschickt, steht der Zähler zu
niedrig — die Annahmestelle würde eine schon benutzte Nummer ablehnen.
`restore.sh` druckt den Befehl zum Vorstellen gleich mit aus.

---

## 6. Betrieb

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

## 7. Von unterwegs zugreifen (FRITZ!Box WireGuard)

Möchten Sie von unterwegs (z. B. bei Hausbesuchen oder von zu Hause) auf eine
in der Praxis stehende Box zugreifen, nutzen Sie das gesicherte VPN Ihrer Praxis.
Die Box selbst wird dafür **nicht** direkt für das Internet geöffnet:
Es werden **keine Portfreigaben** für Port 80 oder 443 in Ihrem Router eingerichtet.
Von außen erreichbar ist ausschließlich der WireGuard-Port Ihrer FRITZ!Box. Praxura
ist an diesem Verbindungsweg nicht beteiligt.

- **Voraussetzung:** FRITZ!Box mit FRITZ!OS ab Version 7.50.
- **WireGuard einrichten:** *Internet → Freigaben → VPN (WireGuard) → Gerät hinzufügen → QR-Code* mit der WireGuard-App scannen.
- `[Bild: FRITZ!Box WireGuard – folgt]`
- **Wichtig zur Namensauflösung:** Verwenden Sie die von der FRITZ!Box erzeugte
  Konfiguration unverändert (dort ist die FRITZ!Box als DNS-Server eingetragen).
  Andernfalls greift die DNS-Rebind-Ausnahme aus §3 nicht, und der DNS-Dienst
  des Mobilfunkanbieters verwirft die interne IP-Adresse der Praxis-Box.

### Mögliche Fehlerquellen bei VPN

- **Falle 1: DS-Lite / CGNAT (keine öffentliche IPv4-Adresse):**
  Manche Internetanschlüsse (häufig bei Kabel- oder Glasfaseranschlüssen) verfügen
  über keine eigene öffentliche IPv4-Adresse. In diesem Fall kann der WireGuard-Tunnel
  aus manchen Mobilfunknetzen heraus unzuverlässig sein. Wenden Sie sich bei Bedarf
  an Ihren Internetanbieter, um eine echte öffentliche IPv4-Adresse zu buchen, oder
  ziehen Sie Ihren IT-Dienstleister hinzu.
- **Falle 2: Gleicher Adressbereich zuhause und in der Praxis:**
  Haben Ihr Heimnetz und das Praxisnetz denselben Standard-Adressbereich (beide
  `192.168.178.0/24`), kann der VPN-Tunnel Daten nicht eindeutig leiten.
  *Lösung:* Stellen Sie das Praxisnetz vorab im Router auf ein anderes Subnetz um
  (z. B. `192.168.188.0/24`). Die Box erkennt ihre neue IP-Adresse selbstständig
  und aktualisiert ihren Eintrag beim Namensdienst alle zwei Minuten.

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
  ⚠️ **Ihre Daten in der Box sind davon NICHT betroffen** — alles läuft auf
  Ihrem Server bzw. PC.
  **Planen Sie den Umstieg bei einer Kündigung, nicht erst, wenn das Zertifikat
  abläuft.**

### 8.1 Weg 1 — Eigene Domain der Praxis
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
   Wurzelzertifikat der Box vertrauen (siehe §8.3). Nutzen Sie eine FRITZ!Box, tragen
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

### 8.2 Weg 2 — Letzter Ausweg ohne Domain
Haben Sie keine eigene Internet-Domain, wählen Sie einen rein internen Namen:
- Interner Name (z. B. `https://praxis.home.arpa`) in `.env`.
- `CADDY_TLS_MODUS=klassisch` in `.env`.
- `CADDY_TLS_ARG=internal` in `.env`.
- Wurzelzertifikat auf jedem Praxisgerät importieren (siehe §8.3).
- Name im Router oder in den `hosts`-Dateien eintragen (siehe §3).

### 8.3 Nur bei internem Zertifikat: Wurzelzertifikat auf jedem Gerät vertrauen

> **Gilt nur für:** Den Weg „eigene Adresse“ mit rein internem Zertifikat
> (`CADDY_TLS_ARG=internal`).
> Beim regulären Weg mit Einrichtungscode über den Praxura-Namensdienst ist
> dieser Schritt **nicht erforderlich**, da die Box ein reguläres Let's-Encrypt-Zertifikat
> nutzt.

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

Das Zertifikat wird bei internem Modus mitgesichert (§5) — nach einer
Wiederherstellung müssen die Geräte es **nicht** neu importieren.

---

## 9. Hetzner Cloud und § 393 SGB V — Hinweise für die Praxis

> **Hinweis:** Keine Rechtsberatung. Verantwortlich für die Datenverarbeitung ist Ihre Praxis.

Betreibt Ihre Praxis die Box auf einem Server bei Hetzner Cloud, verarbeitet Ihre
Praxis Gesundheitsdaten über einen Cloud-Computing-Dienst im Sinne von § 393 Abs. 1
SGB V. Wir gehen vorsichtig davon aus, dass die Anforderungen des § 393 SGB V in
diesem Fall von Ihrer Praxis beachtet werden müssen. Für Praxura gilt § 393 SGB V
nicht, da Praxura zu keinem Zeitpunkt Zugriff auf Ihre Daten hat und keine Rolle bei
der Datenverarbeitung Ihrer Patientendaten einnimmt.

### Die gesetzlichen Kriterien im Überblick (§ 393 SGB V)

1. **Inland und europäischer Sitz (§ 393 Abs. 2 SGB V):**
   Die Verarbeitung erfolgt im Inland bzw. in der EU; der Anbieter Hetzner Online
   GmbH hat seinen Sitz in Deutschland (Gunzenhausen).
2. **Technische und organisatorische Maßnahmen (§ 393 Abs. 3 Nr. 1 SGB V):**
   Die Festlegung und Umsetzung angemessener technischer und organisatorischer
   Maßnahmen (TOM) liegt in der Verantwortung Ihrer Praxis.
3. **C5-Typ-2-Prüfbericht (§ 393 Abs. 3 Nr. 2 SGB V):**
   Hetzner verfügt laut Unternehmensmitteilung vom 25.03.2026 über ein Testat nach
   dem C5-Kriterienkatalog (Typ 2). Ob dieses Testat auch Hetzner Cloud Server
   und die gewählten Standorte vollständig abdeckt, ist aktuell noch nicht
   abschließend geprüft (siehe Kasten „Noch offen").
4. **Kundenkriterien aus dem Prüfbericht (§ 393 Abs. 3 Nr. 3 SGB V):**
   Die im C5-Bericht definierten korrespondierenden Kriterien für Kunden müssen
   von Ihrer Praxis umgesetzt werden. Fordern Sie den C5-Prüfbericht nach Abschluss
   des Auftragsverarbeitungsvertrags im Hetzner-Konto an (*accounts.hetzner.com → DPA*).
   Wichtige Basismaßnahmen der Praxis:
   - Zwei-Faktor-Authentifizierung (2FA) im Hetzner-Kundenkonto aktivieren.
     *(Hinweis: 2FA im Hetzner-Konto schützt den Infrastrukturzugang und ist
     unabhängig von der Benutzeranmeldung an der Praxis-Box.)*
   - Keine Hetzner-API-Token herausgeben oder ungesichert speichern.
   - Hetzner Cloud Firewall strikt auf die benötigten Ports beschränken (80/tcp, 443/tcp, 443/udp sowie 22/tcp nur von der eigenen Admin-IP, ausgehend unbeschränkt; siehe Weg C in §1).
   - Datensicherungen sorgfältig schützen.

### Vertragliche Grundlagen und Verantwortung

- **Auftragsverarbeitungsvertrag (Art. 28 DSGVO):**
  Den AVV schließt Ihre Praxis direkt mit Hetzner per Klick im Hetzner-Kundenportal
  ab. Vertragspartner von Hetzner ist Ihre Praxis, nicht Praxura. Der Server und
  das Abrechnungskonto gehören ausschließlich Ihrer Praxis.
- **Standortauswahl:**
  Wir empfehlen einen Standort in Deutschland: Falkenstein (FSN1) oder Nürnberg
  (NBG1). Ein europäischer Standort wie Helsinki (EU) ist rechtlich möglich.
  Standorte außerhalb der Europäischen Union (wie USA oder Singapur) dürfen für
  den Betrieb der Praxis-Box keinesfalls gewählt werden.
- **Ärztliche Schweigepflicht (§ 203 StGB):**
  Hetzner ist in dieser Konstellation als mitwirkende Person nach § 203 Abs. 3
  Satz 2 StGB anzusehen. Die Praxis ist verpflichtet, mitwirkende Personen zur
  Verschwiegenheit zu verpflichten (§ 203 Abs. 4 Satz 2 Nr. 1 StGB). Ob der
  Standard-AVV von Hetzner bereits eine ausdrückliche § 203-Klausel enthält, ist
  derzeit noch nicht geprüft und muss von der Praxis geprüft werden. Beim Betrieb
  eines Cloud-Servers (IaaS) hat das Personal von Hetzner im Normalbetrieb keinen
  logischen Zugriff auf das laufende Betriebssystem.
- **Zugang und Schlüssel:**
  Die SSH-Schlüssel für den Serverzugang liegen ausschließlich bei Ihrer Praxis.
  Praxura erhält keinen Zugang und nimmt keine Schlüssel entgegen. Unterstützung
  durch Praxura erfolgt im Bedarfsfall ausschließlich per Diagnosepaket oder
  gemeinsamer Bildschirmfreigabe. Gibt die Praxis einem externen IT-Dienstleister
  Zugang (auch über die Hetzner-Konsole oder das Rescue-System), muss die Praxis
  mit diesem Dienstleister einen eigenen AVV sowie eine Verschwiegenheitsverpflichtung
  nach § 203 StGB abschließen.
- **Sicherung bei Hetzner:**
  Als Sicherungsziel dient eine Hetzner Storage Box (im Praxis-Konto buchbar, ca.
  4 €/Monat), ein separates Hetzner Volume (nach Größe abgerechnet) oder eine externe
  Sicherung. Die Box verschlüsselt die Sicherung, bevor sie auf das Speicherziel
  geschrieben wird; der Schlüssel zum Öffnen liegt nur bei der Praxis (§2.5). Geht
  dieser Schlüssel verloren, sind die Sicherungen unlesbar.
- **KI-Modul:**
  Das optionale KI-Modul ist standardmäßig deaktiviert (`AI_MODE=aus`). Vor einer
  eventuellen Aktivierung gelten gesonderte Hinweise (die rechtliche Prüfung dazu läuft).

> ### Noch offen (Stand 07.10.2026)
> - **C5-Typ-2-Abdeckung:** Ob das C5-Testat von Hetzner neben der Rechenzentrumsinfrastruktur
>   auch Hetzner Cloud Server und die Standorte Falkenstein und Nürnberg vollständig
>   abdeckt, ist derzeit noch nicht abschließend geprüft. Bis zur Klärung empfiehlt
>   es sich, den Prüfbericht bei Hetzner anzufordern.
> - **§ 203-Klausel:** Ob der Standard-AVV im Hetzner-Portal bereits eine ausdrückliche
>   Verpflichtung nach § 203 StGB enthält, ist von der Praxis zu prüfen.
> - **Storage Box:** Die C5-Abdeckung und genaue Standortbindung der Storage Box sind
>   bislang nicht abschließend geprüft.

> Stand: 07.10.2026

---

## 10. Wenn etwas nicht geht

| Symptom | Ursache / Lösung |
|---|---|
| Browser: „Website nicht erreichbar" auf dem Tablet | Name nicht im Router (§3), Box-PC schläft, Windows-Netz ist „Öffentlich" (§3), oder FRITZ!Box-Rebind-Schutz blockiert (§3) |
| Browser: Zertifikatswarnung | Wurzelzertifikat auf diesem Gerät nicht vertraut (§8.3); iPad: Schritt „Zertifikatsvertrauen" vergessen |
| Seite bleibt weiß | Adresse in der Leiste ≠ `SITE_URL` aus §2.1 — immer genau den Namen benutzen |
| Windows: Box nach Neustart weg | Windows-Passwort geändert → `praxura-installieren.ps1` erneut ausführen |
| Windows: „Port 80 oder 443 ist belegt" | ein anderes Programm (IIS, Skype, anderer Webserver) beenden |
| `install.sh`: „Images konnten nicht geholt werden" | Internet des Servers prüfen; Kanal `stable` evtl. noch nicht veröffentlicht → `beta` |
| Sicherung bricht ab | Sicherungsplatte nicht angesteckt / Markierungsdatei fehlt (§5) |
| Box-Oberfläche lädt gar nicht, `docker compose logs caddy` zeigt `Failed to read config file` | Zertifikatszugang der Box (`acmedns.json`) fehlt → `install.sh` erneut ausführen (legt Zugang über den Code-Weg neu an oder fällt auf internes Zertifikat zurück); als Notlösung in `.env` `CADDY_TLS_MODUS=klassisch` + `CADDY_TLS_ARG=internal` setzen und `docker compose up -d` (dann §8.3) |

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
