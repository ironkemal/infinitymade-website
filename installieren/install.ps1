<#
════════════════════════════════════════════════════════════════════════════
 Praxura Praxis-Box — Einrichtung auf einem Windows-PC  (KHS K2.11, K-7)
════════════════════════════════════════════════════════════════════════════

 Was passiert hier: Die Praxis-Box ist ein Linux-Programmpaket (Docker). Auf
 einem Windows-PC laeuft sie in einer eigenen, kleinen Linux-Umgebung (WSL2),
 die dieses Skript einrichtet. Danach startet es die normale Einrichtung
 (install.sh) — dieselbe wie auf einem Linux-Server.

 Aufruf (PowerShell, am besten ALS ADMINISTRATOR — sonst fragt Windows nach):
   & ([scriptblock]::Create((irm https://praxura.de/install.ps1)))
   # oder heruntergeladen: powershell -ExecutionPolicy Bypass -File .\install.ps1
   # Wenn die Einrichtung noch offen, der 14-Tage-Link aber abgelaufen ist:
   powershell -ExecutionPolicy Bypass -File "$env:ProgramData\Praxura\install.ps1" -NeuerJeton

 K2b.14 (O-157/O-176, guvenlik S-52): Die Programmdateien kommen NICHT mehr
 aus git, sondern aus dem Container-Image des gewaehlten Kanals (Schritt 5) —
 Dateien und Image sind damit immer dieselbe Version. Das Skript legt sich
 selbst unter %ProgramData%\Praxura\install.ps1 ab (Neustart-Fortsetzung,
 -NeuerJeton) und startet sich ohne Administratorrechte als Administrator neu.

 Entwurf mit dem onprem-Agenten, 02.10.2026 (onprem/REGISTER.md, K2.11):
   1  Vorpruefung: Windows 11 22H2+, Administrator, Virtualisierung, >= 8 GB
      RAM, >= 50 GB frei auf C:, Ports 80/443 frei, KEIN laufendes Docker
      Desktop (eigener Docker-Socket wuerde mit dem der Box kollidieren)
   2  WSL-Einstellungen (%UserProfile%\.wslconfig): gespiegeltes Netzwerk
      (LAN-Zugriff ohne Portweiterleitung) + keine Leerlauf-Abschaltung
   3  Eigene Linux-Umgebung "Praxura" (Ubuntu 24.04) — getrennt von einem
      evtl. schon vorhandenen Ubuntu; Neustart-Fortsetzung per Aufgabe
   4  systemd an, Docker Engine IN der Linux-Umgebung (nicht Docker Desktop)
   5  Programmdateien nach /opt/praxura (Linux-Dateisystem — NICHT /mnt/c:
      die Datenbank braucht Linux-Dateirechte und waere dort langsam)
   6  install.sh (fragt Einrichtungscode/Adresse, TLS, Kanal, Sicherungsziel)
   7  Autostart: geplante Aufgabe "beim Systemstart", auch ohne Anmeldung
   8  Firewall: 80/443 nur im PRIVATEN Netz (Hyper-V- + Windows-Firewall)
   9  Wurzelzertifikat der Box in Windows (bei internem TLS) + hosts-Eintrag fuer diesen PC (O-163)
  10  Energie: am Netzteil kein Standby/Ruhezustand, Deckel zu = nichts tun
  11  Sicherungsziel: externe Platte/NAS (Hinweise; eingebunden wird in Linux)

 Wiederholbar: jeder Schritt prueft zuerst, ob er schon erledigt ist.
#>
[CmdletBinding()]
param(
  # Nach dem Neustart (WSL-Erstinstallation) — von der Fortsetzungsaufgabe gesetzt.
  [switch]$Fortsetzen,
  # Nur Schritte 1-5 (Test/Fehlersuche): install.sh danach von Hand.
  [switch]$NurVorbereiten,
  # Einrichtung noch offen, Link abgelaufen (14 Tage): neuen Einrichtungslink erzeugen und oeffnen.
  [switch]$NeuerJeton,
  # Update-Kanal; 'stable' fehlt noch -> Rueckfrage, ob 'beta' (O-148: Kanal nur vorwaerts).
  [ValidateSet('stable', 'beta')]
  [string]$Kanal = 'stable'
)

$ErrorActionPreference = 'Stop'
$Distro      = 'Praxura'
$DistroBasis = 'Ubuntu-24.04'
$DatenOrt    = Join-Path $env:ProgramData 'Praxura'
$WslOrt      = Join-Path $DatenOrt 'wsl'
$LogDatei    = Join-Path $DatenOrt 'windows-einrichtung.log'
$BoxPfad     = '/opt/praxura/onprem'
$AufgabeStart     = 'Praxura Box (Autostart)'
$AufgabeFortsetzen = 'Praxura Box (Einrichtung fortsetzen)'
# Microsoft-Kennung der WSL-VM fuer die Hyper-V-Firewall (fest, von Microsoft
# dokumentiert) — ohne Regel dort erreicht im gespiegelten Netz nichts aus
# dem LAN die Box, egal was die Windows-Firewall sagt.
$WslVmCreatorId = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
$ApiImageBasis = 'ghcr.io/ironkemal/infinitymade-website/calendar-api'  # = onprem/.env.template (check-onprem)
$SkriptKopie   = Join-Path $DatenOrt 'install.ps1'

# K2b.14: eigener Text — aus der Datei oder (irm | scriptblock) aus dem Speicher.
# Nur auf oberster Ebene gueltig ($MyInvocation in einer Funktion waere die Funktion).
$eigenerText = if ($PSCommandPath) { [IO.File]::ReadAllText($PSCommandPath) } else { $MyInvocation.MyCommand.ScriptBlock.ToString() }
# guvenlik S-52 Nr. 1: ein an einem Zeilenende abgerissener Download parst sauber und liefe bis
# zur Abrissstelle. Deshalb VOR jedem Schritt: endet der eigene Text mit der Endmarke? (Die Marke
# wird hier zusammengesetzt, damit diese Zeile sie nicht selbst enthält.)
if (-not $eigenerText.TrimEnd().EndsWith('# PRAXURA-' + 'SKRIPT-ENDE')) {
  Write-Host 'Das Skript wurde nicht vollstaendig geladen (Verbindung abgebrochen?). Es wurde nichts veraendert — bitte erneut starten.'
  exit 1
}
$utf8Bom = New-Object System.Text.UTF8Encoding $true   # PS 5.1 liest Umlaute nur mit BOM richtig
$istAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $istAdmin) {
  $tmpKopie = Join-Path $env:TEMP 'praxura-install.ps1'
  [IO.File]::WriteAllText($tmpKopie, $eigenerText, $utf8Bom)
  $argListe = @('-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$tmpKopie`"")
  foreach ($p in $PSBoundParameters.GetEnumerator()) {
    if ($p.Value -is [System.Management.Automation.SwitchParameter]) { if ($p.Value) { $argListe += "-$($p.Key)" } }
    else { $argListe += "-$($p.Key)"; $argListe += [string]$p.Value }
  }
  Write-Host 'Die Einrichtung braucht Administratorrechte — Windows fragt gleich nach.'
  try { Start-Process powershell.exe -Verb RunAs -ArgumentList $argListe | Out-Null }
  catch { Write-Host 'Abgebrochen: ohne Administratorrechte geht es nicht. PowerShell als Administrator oeffnen und erneut starten.'; exit 1 }
  exit 0
}

New-Item -ItemType Directory -Force -Path $DatenOrt | Out-Null
# Dauerhafte Kopie: Neustart-Fortsetzung und -NeuerJeton brauchen eine Datei.
if (-not ($PSCommandPath -and ((Resolve-Path $PSCommandPath).Path -eq $SkriptKopie))) {
  [IO.File]::WriteAllText($SkriptKopie, $eigenerText, $utf8Bom)
}
function Log([string]$t)  { $z = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $t"; Add-Content -Path $LogDatei -Value $z -Encoding UTF8; Write-Host $t }
function Ok([string]$t)   { Log "  [ok] $t" }
function Warn([string]$t) { Log "  [Hinweis] $t" }
function Fehler([string]$titel, [string]$gefunden, [string]$tun) {
  Log ''
  Log "  X [Fehler] $titel"
  Log "      Gefunden: $gefunden"
  Log "      Was tun:  $tun"
  Log ''
  Log "  Protokoll: $LogDatei"
  exit 1
}
function Frage([string]$text, [bool]$standardJa = $true) {
  $vorschlag = if ($standardJa) { '[J/n]' } else { '[j/N]' }
  $a = Read-Host "  $text $vorschlag"
  if ([string]::IsNullOrWhiteSpace($a)) { return $standardJa }
  return ($a -match '^[jJyY]')
}
# Befehl in der Praxura-Umgebung als root; Ausgabe UTF-8 (wsl.exe schreibt sonst UTF-16).
#  Ausgabe geht an den Bildschirm (Out-Host), NICHT in den Rueckgabewert — sonst
#  waere das Ergebnis ein Array aus Textzeilen + Code und jeder "-ne 0"-Test falsch.
#  Befehl als Base64: PowerShell 5.1 maskiert innere "..." fuer wsl.exe nicht, und
#  "wsl --" schickt alles zusaetzlich durch eine Shell, die $ ersetzt (04.10.2026).
#  Base64 enthaelt weder Anfuehrungszeichen noch $ noch Leerzeichen.
function InWsl([string]$befehl) {
  $env:WSL_UTF8 = '1'
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($befehl))
  & wsl.exe -d $Distro -u root --exec bash -lc "source <(echo $b64 | base64 -d)" | Out-Host
  return $LASTEXITCODE
}
#  Einen Wert aus der .env der Box lesen (Text-Rueckgabe, kein Exit-Code).
#  --exec statt --: sonst laeuft der Aufruf durch die Linux-Shell, die das awk-$1
#  als leere Variable ersetzt (Admin-Lauf 04.10.2026: Abbruch nach Schritt 6).
function BoxEnv([string]$schluessel) {
  $env:WSL_UTF8 = '1'
  $w = & wsl.exe -d $Distro -u root --exec awk -F= -v k=$schluessel '$1==k{sub(/^[^=]*=/,x); print; exit}' "$BoxPfad/.env" 2>$null
  return ([string]($w | Select-Object -First 1)).Trim()
}
function DistroVorhanden {
  $env:WSL_UTF8 = '1'
  $liste = (& wsl.exe -l -q 2>$null) -join "`n"
  return ($liste -split "`n" | ForEach-Object { $_.Trim() }) -contains $Distro
}

Log ''
Log "Praxura Praxis-Box — Windows-Einrichtung $(Get-Date -Format 'dd.MM.yyyy HH:mm')"
if ($Fortsetzen) {
  Log '  (Fortsetzung nach Neustart)'
  Unregister-ScheduledTask -TaskName $AufgabeFortsetzen -Confirm:$false -ErrorAction SilentlyContinue
}

if ($NeuerJeton) {
  & wsl.exe -d $Distro -u root -- env PRAXURA_BROWSER_OEFFNEN=1 bash "$BoxPfad/install.sh" --neuer-jeton
  if ($LASTEXITCODE -ne 0) {
    Fehler 'install.sh --neuer-jeton ist nicht durchgelaufen' "Rueckgabe $LASTEXITCODE" "Meldung oben lesen; Protokoll: wsl -d $Distro -- cat $BoxPfad/install.log"
  }
  $siteUrl = BoxEnv 'SITE_URL'
  $jeton = BoxEnv 'SETUP_TOKEN'
  try {
    Start-Process "$siteUrl/setup.html#$jeton"
  } catch {
    Warn "Browser liess sich nicht oeffnen — Link: $siteUrl/setup.html (Jeton steht in .env unter SETUP_TOKEN)"
  }
  exit 0
}

# ── 1  Vorpruefung ───────────────────────────────────────────────────────────
Log '[1/11] Vorpruefung'
# O-174: Images nur fuer x86 (amd64). Auf einem ARM-Laptop wuerden sonst erst
# WSL und Docker installiert und install.sh bricht danach ab. PROCESSOR_ARCHITEW6432
# zuerst: aus einer 32-Bit-PowerShell meldet PROCESSOR_ARCHITECTURE sonst "x86".
$arch = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
if ($arch -ne 'AMD64') {
  Fehler 'Prozessor wird nicht unterstuetzt' "Architektur $arch" 'Die Praxis-Box laeuft nur auf PCs mit Intel- oder AMD-Prozessor (x64), nicht auf ARM (z. B. Snapdragon). Einen anderen PC oder einen Linux-Server verwenden.'
}
$build = [int](Get-CimInstance Win32_OperatingSystem).BuildNumber
if ($build -lt 22621) {
  Fehler 'Windows-Version zu alt' "Build $build" 'Windows 11 ab Version 22H2 (Build 22621) wird benoetigt — das gespiegelte WSL-Netzwerk gibt es erst dort. Windows aktualisieren oder einen Linux-Server verwenden.'
}
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if (-not ($cs.HypervisorPresent -or $cpu.VirtualizationFirmwareEnabled)) {
  Fehler 'Virtualisierung ist ausgeschaltet' 'weder Hypervisor aktiv noch im BIOS/UEFI eingeschaltet' 'Im BIOS/UEFI "Intel VT-x" bzw. "AMD-V/SVM" einschalten, dann erneut starten.'
}
$ramGb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
if ($ramGb -lt 7.5) {
  Fehler 'Zu wenig Arbeitsspeicher' "$ramGb GB" 'Mindestens 8 GB RAM. WSL gibt der Box die Haelfte — darunter reicht es nicht fuer Datenbank + Dienste.'
}
$frei = [math]::Round((Get-PSDrive C).Free / 1GB)
if ($frei -lt 50) {
  Fehler 'Zu wenig freier Speicher auf C:' "$frei GB frei" 'Mindestens 50 GB auf C: freimachen. (install.sh kann das in WSL nicht pruefen — es sieht nur die virtuelle Platte.)'
}
$dd = Get-Process -Name 'Docker Desktop', 'com.docker.backend' -ErrorAction SilentlyContinue
if ($dd) {
  Fehler 'Docker Desktop laeuft' 'Docker Desktop ist gestartet' 'Docker Desktop beenden und in seinen Einstellungen "Start Docker Desktop when you sign in" ausschalten (besser: deinstallieren). Die Box bringt ihren eigenen Docker mit — zwei Docker auf einem PC stoeren sich.'
}
if (Test-Path "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe") {
  Warn 'Docker Desktop ist installiert (laeuft aber nicht). Nicht gleichzeitig mit der Box starten.'
}
if (-not $Fortsetzen -or -not (DistroVorhanden)) {
  $belegt = Get-NetTCPConnection -State Listen -LocalPort 80, 443 -ErrorAction SilentlyContinue
  if ($belegt) {
    $p = ($belegt | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } | Sort-Object -Unique) -join ', '
    Fehler 'Port 80 oder 443 ist belegt' "Programm: $p" 'Dieses Programm beenden/deinstallieren (z. B. IIS, Skype, ein anderer Webserver). Die Box braucht beide Ports. (install.sh sieht Windows-Programme nicht — deshalb hier.)'
  }
}
Ok "Windows Build $build · $ramGb GB RAM · $frei GB frei auf C: · Virtualisierung an"

# ── 2  .wslconfig ────────────────────────────────────────────────────────────
Log '[2/11] WSL-Einstellungen'
$wslconfig = Join-Path $env:USERPROFILE '.wslconfig'
$soll = @"
# Praxura Praxis-Box (praxura-installieren.ps1) — bitte nicht entfernen.
[wsl2]
# Gespiegeltes Netzwerk: die Box ist unter der IP dieses PCs im Praxisnetz
# erreichbar (Tablet, zweiter PC), ohne Portweiterleitung.
networkingMode=mirrored
# Nie wegen Leerlauf abschalten — die Box soll auch nachts erreichbar sein
# (nächtliche Sicherung 01:00, Update 02:00).
vmIdleTimeout=-1

[general]
instanceIdleTimeout=-1
"@
$vorhanden = if (Test-Path $wslconfig) { Get-Content $wslconfig -Raw } else { '' }
if ($vorhanden -match 'networkingMode\s*=\s*mirrored' -and $vorhanden -match 'vmIdleTimeout\s*=\s*-1') {
  Ok '.wslconfig schon passend'
} else {
  if ($vorhanden) {
    Copy-Item $wslconfig "$wslconfig.vor-praxura" -Force
    Warn "Vorhandene .wslconfig gesichert als $wslconfig.vor-praxura und ersetzt (eigene Einstellungen ggf. von Hand zurueckholen)."
  }
  Set-Content -Path $wslconfig -Value $soll -Encoding UTF8
  Ok '.wslconfig geschrieben (gespiegeltes Netzwerk, kein Leerlauf-Stopp)'
  # Wirkt erst nach Neustart der WSL-VM. Laufende Distros werden dabei beendet.
  & wsl.exe --shutdown 2>$null
  Start-Sleep -Seconds 8   # WSL braucht einige Sekunden, bis die VM wirklich weg ist
}

# ── 3  Linux-Umgebung "Praxura" ─────────────────────────────────────────────
Log "[3/11] Linux-Umgebung '$Distro' ($DistroBasis)"
if (DistroVorhanden) {
  Ok "'$Distro' ist schon eingerichtet"
} else {
  New-Item -ItemType Directory -Force -Path $WslOrt | Out-Null
  $env:WSL_UTF8 = '1'
  $out = & wsl.exe --install $DistroBasis --name $Distro --location $WslOrt --no-launch 2>&1
  $code = $LASTEXITCODE
  ($out | Out-String).Trim() -split "`n" | ForEach-Object { Log "    $_" }
  if (-not (DistroVorhanden)) {
    # Typisch beim allerersten Mal: das Windows-Feature "Subsystem fuer Linux"
    # wurde gerade erst eingeschaltet und braucht einen Neustart.
    if (($out | Out-String) -match 'restart|Neustart|neu gestartet|reboot' -or $code -eq 3010) {
      # Dauerhafte Kopie, nicht $MyInvocation (bei irm | scriptblock gibt es keine Datei)
      $weiterArgs = ''
      if ($PSBoundParameters.ContainsKey('Kanal')) { $weiterArgs += " -Kanal $Kanal" }
      if ($NurVorbereiten) { $weiterArgs += ' -NurVorbereiten' }
      $akt = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoExit -ExecutionPolicy Bypass -File `"$SkriptKopie`" -Fortsetzen$weiterArgs"
      $trg = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
      $prn = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
      Register-ScheduledTask -TaskName $AufgabeFortsetzen -Action $akt -Trigger $trg -Principal $prn -Force | Out-Null
      Log ''
      Log '  >>> Windows muss jetzt einmal NEU GESTARTET werden. Nach der Anmeldung'
      Log '      geht die Einrichtung in einem PowerShell-Fenster von selbst weiter.'
      exit 0
    }
    Fehler 'Linux-Umgebung konnte nicht angelegt werden' "wsl --install, Rueckgabe $code" 'Ausgabe oben bzw. im Protokoll pruefen. "wsl --update" ausfuehren und dieses Skript erneut starten.'
  }
  Ok "'$Distro' angelegt unter $WslOrt"
}
if ((InWsl 'true') -ne 0) {
  Fehler "'$Distro' startet nicht" 'wsl -d Praxura liefert einen Fehler' '"wsl --update" ausfuehren, PC neu starten, Skript erneut starten.'
}

# ── 4  systemd + Docker Engine ───────────────────────────────────────────────
Log '[4/11] systemd + Docker Engine (in der Linux-Umgebung)'
if ((InWsl 'grep -q "^systemd=true" /etc/wsl.conf 2>/dev/null') -ne 0) {
  InWsl 'printf "[boot]\nsystemd=true\n\n[user]\ndefault=root\n" > /etc/wsl.conf' | Out-Null
  & wsl.exe --terminate $Distro 2>$null
  Start-Sleep -Seconds 8   # wsl.conf wird nur bei einem echten Neustart der Umgebung gelesen
}
if ((InWsl '[ "$(ps -p 1 -o comm=)" = systemd ]') -ne 0) {
  Fehler 'systemd laeuft nicht' 'PID 1 ist nicht systemd' '"wsl --shutdown", 10 Sekunden warten, Skript erneut starten.'
}
if ((InWsl 'command -v docker >/dev/null && docker compose version >/dev/null 2>&1') -ne 0) {
  Log '  Docker Engine wird installiert (dauert einige Minuten) ...'
  # guvenlik S-52 Nr. 9: aus dem signierten apt-Repository von Docker, kein 'get.docker.com | sh'.
  $dockerApt = 'set -e; exec >/tmp/docker-install.log 2>&1; apt-get update -qq; apt-get install -y -qq curl ca-certificates openssl; install -m 0755 -d /etc/apt/keyrings; ' +
               'curl --proto ''=https'' --tlsv1.2 -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc; chmod a+r /etc/apt/keyrings/docker.asc; ' +
               'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list; ' +
               'apt-get update -qq; apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin'
  if ((InWsl $dockerApt) -ne 0) {
    Fehler 'Docker-Installation fehlgeschlagen' 'apt (download.docker.com) meldet einen Fehler' "In der Linux-Umgebung nachsehen: wsl -d $Distro -- cat /tmp/docker-install.log"
  }
}
InWsl 'systemctl enable --now docker >/dev/null 2>&1' | Out-Null
if ((InWsl 'docker info >/dev/null 2>&1') -ne 0) {
  Fehler 'Docker laeuft nicht' 'docker info schlaegt fehl' "wsl -d $Distro -- systemctl status docker"
}
Ok 'systemd aktiv, Docker Engine laeuft'

# ── 5  Programmdateien ───────────────────────────────────────────────────────
Log '[5/11] Programmdateien nach /opt/praxura'
if ((InWsl "[ -f $BoxPfad/.env ]") -eq 0) {
  # Eingerichtete Box: Dateien gehoeren update.sh (manifest/.praxura-stand, J3) — nicht ueberschreiben.
  Ok 'Box schon eingerichtet — Programmdateien bleiben (Aktualisierung macht update.sh)'
} else {
  # K2b.14 (O-157/O-176): Dateien aus DEMSELBEN Image wie spaeter der Betrieb, per Digest.
  if ((InWsl "docker manifest inspect ${ApiImageBasis}:$Kanal >/dev/null 2>&1") -ne 0) {
    if ($Kanal -eq 'stable' -and -not $PSBoundParameters.ContainsKey('Kanal')) {
      Warn "Der Kanal 'stable' ist noch nicht veroeffentlicht."
      if (-not (Frage "Mit 'beta' installieren? (Wechsel zu 'stable' geht erst, wenn 'stable' Ihre Version erreicht hat)" $true)) {
        Fehler 'Abgebrochen' "Kanal 'stable' nicht verfuegbar" 'Spaeter erneut starten oder mit -Kanal beta.'
      }
      $Kanal = 'beta'
    }
    if ((InWsl "docker manifest inspect ${ApiImageBasis}:$Kanal >/dev/null 2>&1") -ne 0) {
      Fehler 'Image nicht erreichbar' "${ApiImageBasis}:$Kanal" 'Internetverbindung pruefen (ghcr.io) und Skript erneut starten.'
    }
  }
  $holen = 'set -e; img=' + $ApiImageBasis + ':' + $Kanal + '; docker pull -q "$img" >/dev/null; ' +
           'd="$(docker image inspect -f ''{{index .RepoDigests 0}}'' "$img")"; [ -n "$d" ]; echo "  Image: $d"; ' +
           't="$(mktemp -d)"; docker rm -f praxura-starter-tmp >/dev/null 2>&1 || true; ' +
           'docker create --name praxura-starter-tmp "$d" >/dev/null; docker cp praxura-starter-tmp:/app/onprem-bundle "$t/bundle" >/dev/null; ' +
           'docker rm -f praxura-starter-tmp >/dev/null; [ -f "$t/bundle/install.sh" ] && [ -f "$t/bundle/manifest.json" ]; ' +
           'install -d -m 0755 /opt/praxura; rm -rf -- /opt/praxura/onprem; mv "$t/bundle" /opt/praxura/onprem; rmdir "$t"'
  if ((InWsl $holen) -ne 0) {
    Fehler 'Programmdateien nicht geladen' "${ApiImageBasis}:$Kanal" 'Internetverbindung pruefen und Skript erneut starten.'
  }
  Ok "Programmdateien (Kanal $Kanal) nach $BoxPfad"
}

if ($NurVorbereiten) {
  Log ''
  Log "  -NurVorbereiten: hier Stopp. Weiter von Hand: wsl -d $Distro -u root -- bash $BoxPfad/install.sh"
  exit 0
}

# ── 6  install.sh ────────────────────────────────────────────────────────────
Log '[6/11] Einrichtung der Box (install.sh)'
$installiertJetzt = $false
if ((InWsl "[ -f $BoxPfad/.env ]") -eq 0) {
  Ok 'Box ist schon eingerichtet (.env vorhanden) — install.sh wird NICHT erneut ausgefuehrt'
} else {
  Log ''
  Log '  Gleich stellt die Einrichtung Fragen. Empfehlungen fuer diesen PC:'
  Log '    Einrichtungscode:    Einrichtungscode (von Praxura erhalten) eingeben — Enter ohne Code = eigene Adresse (Ausnahmefall)'
  Log "    Eigene Adresse:      (nur im Ausnahmefall): https://praxis.home.arpa  (oder: https://$($env:COMPUTERNAME.ToLower()).fritz.box)"
  Log '    Echtes Zertifikat:   n   (Praxisnetz, nicht aus dem Internet erreichbar; entfaellt bei Einrichtungscode)'
  Log '    Sicherungsziel:      siehe Schritt 11 unten — fuer den Anfang leer lassen geht auch'
  Log ''
  & wsl.exe -d $Distro -u root -- env PRAXURA_BROWSER_OEFFNEN=1 bash "$BoxPfad/install.sh" "--kanal=$Kanal"
  if ($LASTEXITCODE -ne 0) {
    Fehler 'install.sh ist nicht durchgelaufen' "Rueckgabe $LASTEXITCODE" "Meldung oben lesen; Protokoll: wsl -d $Distro -- cat $BoxPfad/install.log"
  }
  $installiertJetzt = $true
}
$siteUrl = BoxEnv 'SITE_URL'
$hostName = ($siteUrl -replace '^https://', '').Trim().TrimEnd('/')
if (-not $hostName) { Fehler 'SITE_URL nicht gefunden' "$BoxPfad/.env" 'install.sh erneut ausfuehren.' }
Ok "Box eingerichtet: $siteUrl"

# ── 7  Autostart ─────────────────────────────────────────────────────────────
Log '[7/11] Autostart beim Einschalten des PCs'
# Eine WSL-Umgebung gehoert einem BENUTZER (nicht SYSTEM) — die Aufgabe laeuft
# deshalb als der einrichtende Benutzer, "auch wenn niemand angemeldet ist".
# sleep infinity haelt die Umgebung offen; Docker startet die Container selbst
# (restart: unless-stopped). Aendert sich das Windows-Passwort, muss die
# Aufgabe neu gespeichert werden (Anleitung, Abschnitt Windows).
if (Get-ScheduledTask -TaskName $AufgabeStart -ErrorAction SilentlyContinue) {
  Ok 'Autostart-Aufgabe ist schon eingerichtet'
} else {
  $akt = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wsl.exe" -Argument "-d $Distro -u root --exec /bin/sleep infinity"
  $trg = New-ScheduledTaskTrigger -AtStartup
  $set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
  Log "  Fuer den Start OHNE Anmeldung braucht Windows einmalig das Passwort von $env:USERNAME"
  Log '  (es wird von Windows verschluesselt gespeichert, nicht von Praxura).'
  $cred = Get-Credential -UserName "$env:USERDOMAIN\$env:USERNAME" -Message 'Windows-Passwort fuer den Autostart der Praxis-Box'
  try {
    Register-ScheduledTask -TaskName $AufgabeStart -Action $akt -Trigger $trg -Settings $set -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Highest -Force | Out-Null
    Ok 'Autostart eingerichtet (beim Systemstart, auch ohne Anmeldung)'
  } catch {
    Warn "Autostart ohne Anmeldung nicht moeglich ($($_.Exception.Message)) — richte Start bei Anmeldung ein."
    $trg2 = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    Register-ScheduledTask -TaskName $AufgabeStart -Action $akt -Trigger $trg2 -Settings $set -User "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest -Force | Out-Null
    Warn 'Die Box startet jetzt erst, wenn sich jemand an diesem PC anmeldet (automatische Anmeldung waere eine Alternative).'
  }
}

# ── 8  Firewall ──────────────────────────────────────────────────────────────
Log '[8/11] Firewall: Box im Praxisnetz erreichbar (nur privates Netz)'
if (Get-Command New-NetFirewallHyperVRule -ErrorAction SilentlyContinue) {
  if (-not (Get-NetFirewallHyperVRule -Name 'Praxura-Box-HTTPS' -ErrorAction SilentlyContinue)) {
    New-NetFirewallHyperVRule -Name 'Praxura-Box-HTTPS' -DisplayName 'Praxura Box (80/443)' -Direction Inbound -VMCreatorId $WslVmCreatorId -Protocol TCP -LocalPorts 80, 443 -Action Allow | Out-Null
  }
  Ok 'Hyper-V-Firewall: 80/443 eingehend erlaubt'
} else {
  Warn 'Hyper-V-Firewall-Befehle fehlen (Windows zu alt?) — Zugriff aus dem LAN evtl. blockiert.'
}
if (-not (Get-NetFirewallRule -Name 'Praxura-Box-HTTPS' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'Praxura-Box-HTTPS' -DisplayName 'Praxura Box (80/443)' -Direction Inbound -Protocol TCP -LocalPort 80, 443 -Action Allow -Profile Private | Out-Null
}
Ok 'Windows-Firewall: 80/443 eingehend, nur Profil "Privat"'
$profile = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'NoTraffic' } | Select-Object -First 1
if ($profile -and $profile.NetworkCategory -ne 'Private') {
  Warn "Das Netzwerk '$($profile.Name)' ist als '$($profile.NetworkCategory)' eingestuft — andere Geraete erreichen die Box erst, wenn es in Windows auf 'Privat' gestellt wird (Einstellungen > Netzwerk > Eigenschaften)."
}

# ── 9  Wurzelzertifikat + hosts ──────────────────────────────────────────────
Log '[9/11] Wurzelzertifikat der Box + Adresse auf diesem PC'
$tlsModus = BoxEnv 'CADDY_TLS_MODUS'
$tls = BoxEnv 'CADDY_TLS_ARG'
if ($tlsModus -eq 'acmedns') {
  Ok "echtes Zertifikat (Let's Encrypt ueber den Praxura-Namensdienst) — kein Import noetig"
} elseif ($tls -eq 'internal') {
  $crt = Join-Path $DatenOrt 'praxura-wurzelzertifikat.crt'
  $crtWsl = '/mnt/' + $crt.Substring(0, 1).ToLower() + ($crt.Substring(2) -replace '\\', '/')
  InWsl "cd $BoxPfad && docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt '$crtWsl'" | Out-Null
  if (Test-Path $crt) {
    Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Ok "Zertifikat in Windows als vertrauenswuerdig eingetragen ($crt — diese Datei auch auf Tablets/anderen PCs importieren)"
  } else {
    Warn 'Zertifikat noch nicht vorhanden (caddy startet evtl. noch) — Skript spaeter erneut ausfuehren.'
  }
} else {
  Ok "echtes Zertifikat (Let's Encrypt) — kein Import noetig"
}
# O-163: Mirrored WSL leitet eigene LAN-IP nicht an WSL weiter -> 127.0.0.1 in hosts erforderlich.
# Bei Neueinrichtung (anderer Name): ALLE alten '# Praxura Box'-Zeilen entfernen und genau
# eine neue schreiben. Kodierung der Datei bleibt (System-ANSI lesen/schreiben = wie Notepad;
# ASCII wuerde Umlaute in fremden Kommentaren zu '?' machen).
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$zeile = "127.0.0.1`t$hostName`t# Praxura Box"
$ansi  = [Text.Encoding]::Default
$alt   = if (Test-Path $hosts) { [IO.File]::ReadAllLines($hosts, $ansi) } else { @() }
$box   = @($alt | Where-Object { $_ -match '# Praxura Box' })
if ($box.Count -eq 1 -and $box[0] -eq $zeile) {
  Ok "hosts-Eintrag fuer $hostName schon vorhanden"
} else {
  $rest = @($alt | Where-Object { $_ -notmatch '# Praxura Box' })
  [IO.File]::WriteAllText($hosts, ((@($rest) + $zeile) -join "`r`n") + "`r`n", $ansi)
  if ($box.Count -gt 0) { Ok "hosts-Eintrag ersetzt: $hostName -> 127.0.0.1 (vorherige Praxura-Box-Zeile entfernt)" }
  else { Ok "hosts-Eintrag: $hostName -> 127.0.0.1 (nur fuer diesen PC)" }
}

# ── 10 Energie ───────────────────────────────────────────────────────────────
Log '[10/11] Energieoptionen'
Log '  Schlaeft oder ruht der PC, ist die Box fuer alle anderen Geraete weg.'
if (Frage 'Am Netzteil Standby + Ruhezustand ausschalten und "Deckel zuklappen = nichts tun"?' $true) {
  powercfg /change standby-timeout-ac 0   | Out-Null
  powercfg /change hibernate-timeout-ac 0 | Out-Null
  powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 2>$null | Out-Null
  powercfg /setactive SCHEME_CURRENT | Out-Null
  Ok 'Energie: am Netzteil kein Standby/Ruhezustand, Deckel zu = nichts tun'
} else {
  Warn 'Energieoptionen unveraendert — die Box ist nur erreichbar, solange der PC wach ist.'
}
if ((Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)) {
  Warn 'Laptop erkannt: am Akku greifen die Windows-Energiesparregeln trotzdem. Fuer den Praxisbetrieb dauerhaft am Netzteil lassen.'
}

# ── 11 Sicherungsziel ────────────────────────────────────────────────────────
Log '[11/11] Sicherungsziel'
$ziel = BoxEnv 'BACKUP_ZIEL'
if ($ziel) {
  Ok "Sicherungen gehen nach $ziel"
} else {
  Warn 'Sicherungen liegen auf DIESEM PC — bei einem Plattendefekt sind Daten und Sicherung zugleich weg.'
  Log  '  Externe USB-Platte (z. B. Laufwerk E:) dauerhaft einbinden — in der Linux-Umgebung:'
  Log  "    wsl -d $Distro -- bash -c ""mkdir -p /mnt/praxura-sicherung && echo 'E: /mnt/praxura-sicherung drvfs defaults,nofail 0 0' >> /etc/fstab && mount -a"""
  Log  "    dann in $BoxPfad/.env: BACKUP_ZIEL=/mnt/praxura-sicherung/praxura  und einmal:"
  Log  "    wsl -d $Distro -- bash -c 'mkdir -p /mnt/praxura-sicherung/praxura && touch /mnt/praxura-sicherung/praxura/.praxura-backup-ziel'"
  Log  '  (Fehlt die Platte spaeter, bricht die Sicherung laut ab statt still auf den PC zu schreiben.)'
  Log  '  Empfehlung: die Sicherungsplatte mit BitLocker verschluesseln.'
}

# ── Ende ─────────────────────────────────────────────────────────────────────
# Adapter MIT Standard-Gateway = echtes Praxisnetz. Ohne diesen Filter kam beim
# Test (02.10.2026) eine Hyper-V-Adresse (vEthernet, 192.168.176.1) heraus.
$lanIp = (Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress
Log ''
Log '  ════════════════════════════════════════════════════════════════'
Log "  Fertig. Auf diesem PC im Browser:  $siteUrl/login.html"
if ($lanIp) {
  Log "  Andere Geraete (Tablet, zweiter PC) brauchen die Adresse $hostName -> $lanIp"
  Log '  (im Router als DNS-Eintrag; bei der FRITZ!Box zusaetzlich unter'
  Log "   Heimnetz > Netzwerk > Netzwerkeinstellungen > DNS-Rebind-Schutz: $hostName)"
  Log '  und das Wurzelzertifikat (siehe Schritt 9). Dem PC im Router eine feste IP geben.'
}
Log '  ════════════════════════════════════════════════════════════════'
Log "  Protokoll: $LogDatei"

# hosts-Eintrag (Schritt 9) ist dann schon gesetzt, deshalb erst am Ende.
if ($installiertJetzt) {
  $jeton = BoxEnv 'SETUP_TOKEN'
  if ($jeton) {
    # Im acmedns-Modus kann das Let's-Encrypt-Zertifikat direkt nach der
    # Installation noch fehlen; Caddy bricht TLS dann ab und der Browser
    # zeigt nicht einmal "trotzdem fortfahren". Bis zu ~120 s auf /health warten.
    $bereit = $false
    for ($i = 0; $i -lt 24; $i++) {
      try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri "$siteUrl/health" -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $bereit = $true; break }
      } catch {
        # Noch nicht bereit oder TLS-Handshake noch nicht moeglich
      }
      Start-Sleep -Seconds 5
    }
    if (-not $bereit) {
      Warn 'Die Seite ist evtl. noch nicht bereit — in 1-2 Minuten im Browser neu laden (F5).'
    }
    Log '  Die Einrichtung oeffnet sich jetzt im Browser.'
    try {
      Start-Process "$siteUrl/setup.html#$jeton"
    } catch {
      Warn "Browser liess sich nicht oeffnen — Link: $siteUrl/setup.html (Jeton steht in .env unter SETUP_TOKEN)"
    }
  }
}


# PRAXURA-SKRIPT-ENDE
