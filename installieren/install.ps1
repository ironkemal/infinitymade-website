<#
============================================================================
 Praxura Praxis-Box - Einrichtung auf einem Windows-PC  (KHS K2.11, K-7)
============================================================================

 Was passiert hier: Die Praxis-Box ist ein Linux-Programmpaket (Docker). Auf
 einem Windows-PC laeuft sie in einer eigenen, kleinen Linux-Umgebung (WSL2),
 die dieses Skript einrichtet. Danach startet es die normale Einrichtung
 (install.sh) - dieselbe wie auf einem Linux-Server.

 Aufruf (PowerShell, am besten ALS ADMINISTRATOR - sonst fragt Windows nach):
   & ([scriptblock]::Create((irm https://praxura.de/install.ps1)))
   # oder heruntergeladen: powershell -ExecutionPolicy Bypass -File .\install.ps1
   # Wenn die Einrichtung noch offen, der 14-Tage-Link aber abgelaufen ist:
   powershell -ExecutionPolicy Bypass -File "$env:ProgramData\Praxura\install.ps1" -NeuerJeton

 K2b.14 (O-157/O-176, guvenlik S-52): Die Programmdateien kommen NICHT mehr
 aus git, sondern aus dem Container-Image des gewaehlten Kanals (Schritt 5) -
 Dateien und Image sind damit immer dieselbe Version. Das Skript legt sich
 selbst unter %ProgramData%\Praxura\install.ps1 ab (Neustart-Fortsetzung,
 -NeuerJeton) und startet sich ohne Administratorrechte als Administrator neu.

 Entwurf mit dem onprem-Agenten, 02.10.2026 (onprem/REGISTER.md, K2.11):
   1  Vorpruefung: Windows 11 22H2+, Administrator, Virtualisierung, >= 8 GB
      RAM, >= 50 GB frei auf C:, Ports 80/443 frei, KEIN laufendes Docker
      Desktop (eigener Docker-Socket wuerde mit dem der Box kollidieren)
   2  WSL-Einstellungen (%UserProfile%\.wslconfig): gespiegeltes Netzwerk
      (LAN-Zugriff ohne Portweiterleitung) + keine Leerlauf-Abschaltung
   3  Eigene Linux-Umgebung "Praxura" (Ubuntu 24.04) - getrennt von einem
      evtl. schon vorhandenen Ubuntu; Neustart-Fortsetzung per Aufgabe
   4  systemd an, Docker Engine IN der Linux-Umgebung (nicht Docker Desktop)
   5  Programmdateien nach /opt/praxura (Linux-Dateisystem - NICHT /mnt/c:
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
  # Nach dem Neustart (WSL-Erstinstallation) - von der Fortsetzungsaufgabe gesetzt.
  [switch]$Fortsetzen,
  # Nur Schritte 1-5 (Test/Fehlersuche): install.sh danach von Hand.
  [switch]$NurVorbereiten,
  # Einrichtung noch offen, Link abgelaufen (14 Tage): neuen Einrichtungslink erzeugen und oeffnen.
  [switch]$NeuerJeton,
  # Update-Kanal; 'stable' fehlt noch -> Rueckfrage, ob 'beta' (O-148: Kanal nur vorwaerts).
  [ValidateSet('stable', 'beta')]
  [string]$Kanal = 'stable',
  # Nur Textfenster, kein Einrichtungsfenster (Konsey 13.10.2026: Rueckweg bleibt offen).
  [switch]$Text
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
# dokumentiert) - ohne Regel dort erreicht im gespiegelten Netz nichts aus
# dem LAN die Box, egal was die Windows-Firewall sagt.
$WslVmCreatorId = '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
$ApiImageBasis = 'ghcr.io/ironkemal/infinitymade-website/calendar-api'  # = onprem/.env.template (check-onprem)
$SkriptKopie   = Join-Path $DatenOrt 'install.ps1'

# K2b.14: eigener Text - aus der Datei oder (irm | scriptblock) aus dem Speicher.
# Nur auf oberster Ebene gueltig ($MyInvocation in einer Funktion waere die Funktion).
$eigenerText = if ($PSCommandPath) { [IO.File]::ReadAllText($PSCommandPath) } else { $MyInvocation.MyCommand.ScriptBlock.ToString() }
# guvenlik S-52 Nr. 1: ein an einem Zeilenende abgerissener Download parst sauber und liefe bis
# zur Abrissstelle. Deshalb VOR jedem Schritt: endet der eigene Text mit der Endmarke? (Die Marke
# wird hier zusammengesetzt, damit diese Zeile sie nicht selbst enthaelt.)
if (-not $eigenerText.TrimEnd().EndsWith('# PRAXURA-' + 'SKRIPT-ENDE')) {
  Write-Host 'Das Skript wurde nicht vollstaendig geladen (Verbindung abgebrochen?). Es wurde nichts veraendert - bitte erneut starten.'
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
  Write-Host 'Die Einrichtung braucht Administratorrechte - Windows fragt gleich nach.'
  try { Start-Process powershell.exe -Verb RunAs -ArgumentList $argListe | Out-Null }
  catch { Write-Host 'Abgebrochen: ohne Administratorrechte geht es nicht. PowerShell als Administrator oeffnen und erneut starten.'; exit 1 }
  exit 0
}

New-Item -ItemType Directory -Force -Path $DatenOrt | Out-Null
# Dauerhafte Kopie: Neustart-Fortsetzung und -NeuerJeton brauchen eine Datei.
if (-not ($PSCommandPath -and ((Resolve-Path $PSCommandPath).Path -eq $SkriptKopie))) {
  [IO.File]::WriteAllText($SkriptKopie, $eigenerText, $utf8Bom)
}
# -- Einrichtungsfenster (Konsey 2026-10-13, Stufe 1) ------------------------
# Zeigt die 11 Schritte mit Haken + Protokoll. Es laeuft in einem eigenen
# STA-Runspace; das Skript selbst bleibt sequenziell wie im Textmodus. Geheimnisse
# (Einrichtungscode, Schluessel, GESICHERT) gehen NIE durch dieses Fenster:
# install.sh fragt sie in seinem eigenen Konsolenfenster (Schritt 6), von Hand.
# Datei bleibt reines ASCII (install-ps1-ascii.test.js) - Umlaute ueber U().
$Ui = $null
function U([string]$s) {
  $s.Replace('{ae}', [string][char]0xE4).Replace('{oe}', [string][char]0xF6).Replace('{ue}', [string][char]0xFC).
     Replace('{Ae}', [string][char]0xC4).Replace('{Oe}', [string][char]0xD6).Replace('{Ue}', [string][char]0xDC).
     Replace('{ss}', [string][char]0xDF).Replace('{-}', [string][char]0x2013)
}
$UiSkript = {
  try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    [System.Windows.Forms.Application]::EnableVisualStyles()
    $t = $s.Texte
    function Rgb([string]$h) { [System.Drawing.ColorTranslator]::FromHtml($h) }
    function Pt([int]$x, [int]$y) { New-Object System.Drawing.Point($x, $y) }
    function Gr([int]$w, [int]$h) { New-Object System.Drawing.Size($w, $h) }
    $dunkel = Rgb '#2B2118'; $bronze = Rgb '#9A7655'; $creme = Rgb '#FAF3EA'; $linie = Rgb '#E8DED1'
    $f = New-Object System.Windows.Forms.Form
    $f.Text = $t.Fenster; $f.StartPosition = 'CenterScreen'; $f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false
    $f.ClientSize = Gr 680 668; $f.BackColor = [System.Drawing.Color]::White; $f.ForeColor = $dunkel
    $f.Font = New-Object System.Drawing.Font('Segoe UI', 10)
    $logo = $null
    try {
      $logo = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream (, [Convert]::FromBase64String($t.Logo))))
      $f.Icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$logo).GetHicon())
    } catch { }
    # Kopf
    $kopf = New-Object System.Windows.Forms.Panel
    $kopf.Location = Pt 0 0; $kopf.Size = Gr 680 100; $kopf.BackColor = $creme
    if ($logo) {
      $bild = New-Object System.Windows.Forms.PictureBox
      $bild.Image = $logo; $bild.SizeMode = 'Zoom'; $bild.Location = Pt 28 22; $bild.Size = Gr 56 56
      $kopf.Controls.Add($bild)
    }
    $marke = New-Object System.Windows.Forms.Label
    $marke.Text = 'PRAXURA'; $marke.AutoSize = $true; $marke.Location = Pt 100 20; $marke.ForeColor = $bronze
    $marke.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
    $titel = New-Object System.Windows.Forms.Label
    $titel.Text = $t.Kopf; $titel.AutoSize = $true; $titel.Location = Pt 98 38
    $titel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 16)
    $kopf.Controls.AddRange(@($marke, $titel))
    $strich = New-Object System.Windows.Forms.Panel
    $strich.Location = Pt 0 100; $strich.Size = Gr 680 1; $strich.BackColor = $linie
    $unter = New-Object System.Windows.Forms.Label
    $unter.Text = $t.Unter; $unter.Location = Pt 28 114; $unter.Size = Gr 624 40; $unter.ForeColor = Rgb '#6B6158'
    $unter.Font = New-Object System.Drawing.Font('Segoe UI', 9.5)
    # Fortschrittsbalken
    $bahn = New-Object System.Windows.Forms.Panel
    $bahn.Location = Pt 28 160; $bahn.Size = Gr 624 6; $bahn.BackColor = Rgb '#EFE7DC'
    $fuell = New-Object System.Windows.Forms.Panel
    $fuell.Location = Pt 0 0; $fuell.Size = Gr 0 6; $fuell.BackColor = $bronze
    $bahn.Controls.Add($fuell)
    $f.Controls.AddRange(@($kopf, $strich, $unter, $bahn))
    # Schritte
    $marken = @(); $zeilen = @()
    for ($i = 0; $i -lt $t.Schritte.Count; $i++) {
      $y = 182 + $i * 26
      $m = New-Object System.Windows.Forms.Label
      $m.Location = Pt 30 $y; $m.Size = Gr 26 24; $m.TextAlign = 'MiddleCenter'
      $m.Font = New-Object System.Drawing.Font('Segoe UI Symbol', 11)
      $l = New-Object System.Windows.Forms.Label
      $l.Location = Pt 60 $y; $l.Size = Gr 590 24; $l.TextAlign = 'MiddleLeft'
      $f.Controls.AddRange(@($m, $l)); $marken += $m; $zeilen += $l
    }
    $protTitel = New-Object System.Windows.Forms.Label
    $protTitel.Text = 'Protokoll'; $protTitel.AutoSize = $true; $protTitel.Location = Pt 26 474; $protTitel.ForeColor = Rgb '#8A7F74'
    $protTitel.Font = New-Object System.Drawing.Font('Segoe UI', 8.5)
    $prot = New-Object System.Windows.Forms.TextBox
    $prot.Multiline = $true; $prot.ReadOnly = $true; $prot.ScrollBars = 'Vertical'; $prot.WordWrap = $true
    $prot.Location = Pt 28 494; $prot.Size = Gr 624 108; $prot.BorderStyle = 'FixedSingle'
    $prot.Font = New-Object System.Drawing.Font('Consolas', 8.5); $prot.BackColor = Rgb '#FBF9F6'; $prot.ForeColor = Rgb '#4A4038'
    $stand = New-Object System.Windows.Forms.Label
    $stand.Location = Pt 28 616; $stand.Size = Gr 480 40; $stand.TextAlign = 'MiddleLeft'
    $stand.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
    $knopf = New-Object System.Windows.Forms.Button
    $knopf.Text = $t.Schliessen; $knopf.Location = Pt 532 618; $knopf.Size = Gr 120 36
    $knopf.FlatStyle = 'Flat'; $knopf.FlatAppearance.BorderSize = 0; $knopf.BackColor = Rgb '#D9D2C9'; $knopf.ForeColor = [System.Drawing.Color]::White
    $knopf.Enabled = $false; $knopf.Add_Click({ $f.Close() })
    $f.Controls.AddRange(@($protTitel, $prot, $stand, $knopf))
    # Frage IM Fenster (14.10.2026): ersetzt das Protokoll, bis geantwortet ist. Ein
    # MessageBox-Fenster lag beim Test hinter/neben dem Fenster und war unauffindbar.
    # Nur Ja/Nein - Geheimnisse (Code, Schluessel, Passwort) kommen hier NIE durch.
    $fp = New-Object System.Windows.Forms.Panel
    $fp.Location = Pt 28 470; $fp.Size = Gr 624 138; $fp.BackColor = $creme; $fp.Visible = $false
    $fpT = New-Object System.Windows.Forms.Label
    $fpT.Location = Pt 16 10; $fpT.Size = Gr 592 24; $fpT.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
    $fpX = New-Object System.Windows.Forms.Label
    $fpX.Location = Pt 16 36; $fpX.Size = Gr 592 56; $fpX.Font = New-Object System.Drawing.Font('Segoe UI', 9.5); $fpX.ForeColor = Rgb '#4A4038'
    $fpJa = New-Object System.Windows.Forms.Button
    $fpJa.Location = Pt 448 94; $fpJa.Size = Gr 160 34; $fpJa.FlatStyle = 'Flat'; $fpJa.FlatAppearance.BorderSize = 0
    $fpJa.BackColor = $dunkel; $fpJa.ForeColor = [System.Drawing.Color]::White
    $fpNein = New-Object System.Windows.Forms.Button
    $fpNein.Location = Pt 278 94; $fpNein.Size = Gr 160 34; $fpNein.FlatStyle = 'Flat'; $fpNein.BackColor = [System.Drawing.Color]::White
    $fpAus = { $fp.Visible = $false; $prot.Visible = $true; $protTitel.Visible = $true }
    $fpJa.Add_Click({ $s.Frage = $null; $s.Antwort = 'ja'; & $fpAus })
    $fpNein.Add_Click({ $s.Frage = $null; $s.Antwort = 'nein'; & $fpAus })
    $fp.Controls.AddRange(@($fpT, $fpX, $fpJa, $fpNein))
    $f.Controls.Add($fp); $fp.BringToFront()
    # Ende (14.10.2026): Adresse der Box anklickbar + kopierbar, statt nur im Protokoll.
    $ep = New-Object System.Windows.Forms.Panel
    $ep.Location = Pt 28 470; $ep.Size = Gr 624 138; $ep.BackColor = $creme; $ep.Visible = $false
    $epT = New-Object System.Windows.Forms.Label
    $epT.Location = Pt 16 10; $epT.Size = Gr 592 24; $epT.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 11)
    $epX = New-Object System.Windows.Forms.Label
    $epX.Location = Pt 16 36; $epX.Size = Gr 592 20; $epX.Font = New-Object System.Drawing.Font('Segoe UI', 9.5); $epX.ForeColor = Rgb '#4A4038'
    $epL = New-Object System.Windows.Forms.LinkLabel
    $epL.Location = Pt 16 60; $epL.Size = Gr 592 26; $epL.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 12)
    $epL.LinkColor = $bronze; $epL.ActiveLinkColor = $dunkel
    $epL.Add_LinkClicked({ try { Start-Process ([string]$s.Link) } catch { } })
    $epK = New-Object System.Windows.Forms.Button
    $epK.Location = Pt 278 94; $epK.Size = Gr 160 34; $epK.FlatStyle = 'Flat'; $epK.BackColor = [System.Drawing.Color]::White
    $epK.Add_Click({ try { [System.Windows.Forms.Clipboard]::SetText([string]$s.Link); $epK.Text = 'Kopiert' } catch { } })
    $epO = New-Object System.Windows.Forms.Button
    $epO.Location = Pt 448 94; $epO.Size = Gr 160 34; $epO.FlatStyle = 'Flat'; $epO.FlatAppearance.BorderSize = 0
    $epO.BackColor = $dunkel; $epO.ForeColor = [System.Drawing.Color]::White
    $epO.Add_Click({ try { Start-Process ([string]$s.Link) } catch { } })
    $ep.Controls.AddRange(@($epT, $epX, $epL, $epK, $epO))
    $f.Controls.Add($ep); $ep.BringToFront()
    $zeichen = @{ offen = [string][char]0x25CB; laeuft = [string][char]0x25CF; ok = [string][char]0x2714; hinweis = [string][char]0x2714; fehler = [string][char]0x2716 }
    $farbe = @{ offen = (Rgb '#CFC7BC'); laeuft = $bronze; ok = (Rgb '#3C8D5A'); hinweis = (Rgb '#C27C0E'); fehler = (Rgb '#B3261E') }
    $fN = New-Object System.Drawing.Font('Segoe UI', 10)
    $fB = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
    $grau = Rgb '#A39A90'
    $tick = {
      if ($s.JetztZu) { $uhr.Stop(); $f.Close(); return }
      while ($s.Zeilen.Count -gt 0) { $prot.AppendText([string]$s.Zeilen.Dequeue() + "`r`n") }
      $fertig = 0
      for ($i = 0; $i -lt $zeilen.Count; $i++) {
        $z = [string]$s.Stand[$i + 1]; if (-not $z) { $z = 'offen' }
        if ($z -eq 'ok' -or $z -eq 'hinweis') { $fertig++ }
        $marken[$i].Text = $zeichen[$z]; $marken[$i].ForeColor = $farbe[$z]
        $zeilen[$i].Text = $t.Schritte[$i]
        $zeilen[$i].ForeColor = $(if ($z -eq 'offen') { $grau } elseif ($z -eq 'fehler') { $farbe.fehler } else { $dunkel })
        $zeilen[$i].Font = $(if ($z -eq 'laeuft') { $fB } else { $fN })
      }
      $fuell.Width = [int](624 * $fertig / [math]::Max(1, $zeilen.Count))
      $stand.Text = [string]$s.Titel
      $q = $s.Frage
      if ($q -and -not $fp.Visible) {
        $fpT.Text = [string]$q.Titel; $fpX.Text = [string]$q.Text
        $fpJa.Text = [string]$q.Ja; $fpNein.Text = [string]$q.Nein; $fpNein.Visible = [bool]$q.Nein
        $prot.Visible = $false; $protTitel.Visible = $false; $fp.Visible = $true
        # Nach vorn holen, auch wenn ein anderes Fenster den Fokus hat.
        if ($f.WindowState -eq 'Minimized') { $f.WindowState = 'Normal' }
        $f.TopMost = $true; $f.TopMost = $false; $f.Activate(); $fpJa.Focus() | Out-Null
      }
      if ($s.Ende -and -not $knopf.Enabled) {
        $knopf.Enabled = $true; $knopf.BackColor = $dunkel
        if ($s.Gut) { $fuell.Width = 624 } else { $fuell.BackColor = $farbe.fehler }
        if ($s.Gut -and $s.Link) {
          $epT.Text = $t.EndeTitel; $epX.Text = [string]$s.LinkText; $epL.Text = [string]$s.Link
          $epK.Text = $t.Kopieren; $epO.Text = $t.Oeffnen
          $fp.Visible = $false; $prot.Visible = $false; $protTitel.Visible = $false; $ep.Visible = $true
        }
        $f.Activate()
      }
    }
    $uhr = New-Object System.Windows.Forms.Timer
    $uhr.Interval = 250; $uhr.Add_Tick($tick)
    # Waehrend der Einrichtung nicht schliessbar - sonst liefe sie unsichtbar weiter.
    $f.Add_FormClosing({ param($q, $e) if (-not $s.Ende) { $e.Cancel = $true } })
    $f.Add_Shown({ & $tick; $s.Bereit = $true; $f.Activate() })
    $uhr.Start()
    [System.Windows.Forms.Application]::Run($f)
  } catch {
    $s.Fehler = "$_"
  } finally {
    $s.Zu = $true
  }
}
function UiStarten {
  try { Add-Type -AssemblyName System.Windows.Forms, System.Drawing -ErrorAction Stop } catch { return $null }
  $s = [hashtable]::Synchronized(@{
    Zeilen = [System.Collections.Queue]::Synchronized((New-Object System.Collections.Queue))
    Stand = [hashtable]::Synchronized(@{}); Hinweis = [hashtable]::Synchronized(@{})
    Aktiv = 0; Titel = ''; Ende = $false; Zu = $false; Bereit = $false; Fehler = ''; JetztZu = $false; Gut = $false
    Frage = $null; Antwort = $null; Link = ''; LinkText = ''
    Texte = @{
      Fenster = 'Praxura ' + (U '{-}') + ' Einrichtung der Praxis-Box'
      Kopf = 'Ihre Praxis-Box wird eingerichtet'
      # Praxura-Logo, 112 px PNG (aus logo.png, 48 Farben) - eingebettet, kein Download.
      Logo = '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'
      Unter = U 'Bitte dieses Fenster offen lassen {-} Fragen erscheinen hier unten bzw. als kleines Praxura-Fenster davor. Dauer etwa 15{-}30 Minuten, beim ersten Mal mit einem Windows-Neustart.'
      Schliessen = U 'Schlie{ss}en'
      EndeTitel = 'Praxura ist bereit'
      Kopieren = 'Link kopieren'
      Oeffnen = U 'Im Browser {oe}ffnen'
      Schritte = @((U 'Vorpr{ue}fung'), 'WSL-Einstellungen', 'Linux-Umgebung', 'Docker', 'Programmdateien',
                   'Einrichtung der Box (Einrichtungscode)', 'Autostart', 'Firewall', 'Zertifikat + Adresse',
                   'Energieoptionen', 'Sicherungsziel')
    }
  })
  $rs = [runspacefactory]::CreateRunspace(); $rs.ApartmentState = 'STA'; $rs.ThreadOptions = 'ReuseThread'; $rs.Open()
  $rs.SessionStateProxy.SetVariable('s', $s)
  $ps = [powershell]::Create(); $ps.Runspace = $rs
  [void]$ps.AddScript($UiSkript)
  $s.Lauf = $ps.BeginInvoke(); $s.Ps = $ps
  for ($i = 0; $i -lt 100 -and -not $s.Bereit -and -not $s.Zu; $i++) { Start-Sleep -Milliseconds 100 }
  if (-not $s.Bereit) { return $null }
  return $s
}
function UiSchritt([int]$n) {
  if (-not $Ui) { return }
  $alt = [int]$Ui.Aktiv
  if ($alt -gt 0 -and $Ui.Stand[$alt] -eq 'laeuft') { $Ui.Stand[$alt] = $(if ($Ui.Hinweis[$alt]) { 'hinweis' } else { 'ok' }) }
  $Ui.Aktiv = $n; $Ui.Stand[$n] = 'laeuft'
  $Ui.Titel = "Schritt $n von 11: $($Ui.Texte.Schritte[$n - 1]) ..."
}
#  Frage/Meldung IM Einrichtungsfenster (unten, statt Protokoll). $nein = '' -> nur ein Knopf.
#  Ersetzt die MessageBox (Test 14.10.2026: lag unsichtbar, Einrichtung stand in Schritt 10).
function UiFrage([string]$titel, [string]$text, [string]$ja = 'Ja', [string]$nein = 'Nein') {
  $Ui.Antwort = $null
  $Ui.Frage = @{ Titel = $titel; Text = $text; Ja = $ja; Nein = $nein }
  while (-not $Ui.Antwort -and -not $Ui.Zu) { Start-Sleep -Milliseconds 200 }
  $Ui.Frage = $null
  return ($Ui.Antwort -eq 'ja')
}
#  Ende im Fenster: Haken setzen, Schliessen-Knopf frei, warten bis es zu ist.
function UiAbschluss([string]$titel, [bool]$gut, [bool]$warten = $true) {
  if (-not $Ui) { return }
  $n = [int]$Ui.Aktiv
  if ($n -gt 0) { $Ui.Stand[$n] = $(if (-not $gut) { 'fehler' } elseif ($Ui.Hinweis[$n]) { 'hinweis' } else { 'ok' }) }
  $Ui.Titel = $titel; $Ui.Gut = $gut; $Ui.Ende = $true
  if ($warten) { while (-not $Ui.Zu) { Start-Sleep -Milliseconds 300 } }
  UiZu
}
#  Fenster sicher schliessen, BEVOR das Skript endet: endet der Prozess bei offenem
#  Fenster, wirft dessen Zeitgeber eine PipelineStoppedException (Testlauf 13.10.2026).
function UiZu {
  if (-not $Ui) { return }
  $Ui.Ende = $true; $Ui.JetztZu = $true
  for ($i = 0; $i -lt 50 -and -not $Ui.Zu; $i++) { Start-Sleep -Milliseconds 100 }
  try { $Ui.Ps.Dispose() } catch { }
  KonsoleZeigen 9
}
#  Konsolenfenster im Fenstermodus minimieren (6) bzw. wiederherstellen (9) - bestmoeglich.
function KonsoleZeigen([int]$modus) {
  try {
    if (-not ('Praxura.Konsole' -as [type])) {
      Add-Type -Namespace Praxura -Name Konsole -MemberDefinition '[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow(); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);'
    }
    $h = [Praxura.Konsole]::GetConsoleWindow()
    if ($h -ne [IntPtr]::Zero) { [Praxura.Konsole]::ShowWindow($h, $modus) | Out-Null }
  } catch { }
}

# -- Stufe 2: install.sh --fenster (Konsey 2026-10-13) ------------------------
# install.sh laeuft ohne Terminal; seine Fragen kommen als '@@PRAXURA FRAGE <id> <Text>'
# und werden hier als Dialog gestellt, die Antwort geht als EINE Zeile ueber die
# stdin-Pipe zurueck (nie argv/env/Datei). '@@PRAXURA GEHEIM'-Zeilen (Notfall-
# schluessel) landen nur im Schluessel-Dialog - nie im Protokoll, nie im Log.
$script:BoxFehler = @{ Titel = ''; Gefunden = ''; Tun = '' }
$BraunDunkel = '#2B2118'; $BraunMittel = '#9A7655'
#  Ein Dialog fuer alle Fragen: Text, optional Schluesselblock, Eingabefeld mit Pruefung.
function Dialog {
  param([string]$titel, [string]$text, [string]$geheim = '', [bool]$feld = $true, [string]$vorgabe = '',
        [scriptblock]$pruef = $null, [string]$hinweis = '', [bool]$abbrechbar = $true, [bool]$gross = $false,
        [string]$weiter = 'Weiter', [string]$nein = '', [bool]$passwort = $false)
  $rgb = { param($h) [System.Drawing.ColorTranslator]::FromHtml($h) }
  $d = New-Object System.Windows.Forms.Form
  $d.Text = 'Praxura'; $d.StartPosition = 'CenterScreen'; $d.FormBorderStyle = 'FixedDialog'
  $d.MaximizeBox = $false; $d.MinimizeBox = $false; $d.TopMost = $true; $d.ShowInTaskbar = $true
  $d.BackColor = [System.Drawing.Color]::White; $d.ForeColor = (& $rgb $BraunDunkel)
  $d.Font = New-Object System.Drawing.Font('Segoe UI', 10)
  $w = 560; $y = 24
  $kopf = New-Object System.Windows.Forms.Label
  $kopf.Text = $titel; $kopf.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 14)
  $kopf.Location = New-Object System.Drawing.Point(28, $y); $kopf.Size = New-Object System.Drawing.Size(($w - 56), 32)
  $d.Controls.Add($kopf); $y += 42
  $info = New-Object System.Windows.Forms.Label
  $info.Text = $text; $info.Location = New-Object System.Drawing.Point(28, $y)
  $info.MaximumSize = New-Object System.Drawing.Size(($w - 56), 0); $info.AutoSize = $true
  $d.Controls.Add($info); $y += $info.PreferredHeight + 14
  if ($geheim) {
    $box = New-Object System.Windows.Forms.TextBox
    $box.Multiline = $true; $box.ReadOnly = $true; $box.ScrollBars = 'Vertical'; $box.WordWrap = $true
    $box.Text = $geheim; $box.Font = New-Object System.Drawing.Font('Consolas', 10)
    $box.BackColor = (& $rgb '#FAF3EA'); $box.BorderStyle = 'FixedSingle'
    $box.Location = New-Object System.Drawing.Point(28, $y); $box.Size = New-Object System.Drawing.Size(($w - 56), 190)
    $d.Controls.Add($box); $y += 204
  }
  $ein = $null
  if ($feld) {
    $ein = New-Object System.Windows.Forms.TextBox
    $ein.Text = $vorgabe; $ein.Location = New-Object System.Drawing.Point(28, $y); $ein.Size = New-Object System.Drawing.Size(($w - 56), 30)
    if ($gross) { $ein.CharacterCasing = 'Upper'; $ein.Font = New-Object System.Drawing.Font('Consolas', 14) }
    if ($passwort) { $ein.UseSystemPasswordChar = $true }
    $d.Controls.Add($ein); $y += 40
  }
  $hin = New-Object System.Windows.Forms.Label
  $hin.Text = $hinweis; $hin.ForeColor = (& $rgb '#B3261E'); $hin.Location = New-Object System.Drawing.Point(28, $y)
  $hin.Size = New-Object System.Drawing.Size(($w - 56), 22); $d.Controls.Add($hin); $y += 30
  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = $weiter; $ok.Size = New-Object System.Drawing.Size(130, 36); $ok.Location = New-Object System.Drawing.Point(($w - 28 - 130), $y)
  $ok.FlatStyle = 'Flat'; $ok.FlatAppearance.BorderSize = 0; $ok.ForeColor = [System.Drawing.Color]::White
  $ok.DialogResult = 'OK'; $d.AcceptButton = $ok; $d.Controls.Add($ok)
  $setzeOk = {
    $an = (-not $pruef) -or ($ein -and [bool](& $pruef $ein.Text))
    $ok.Enabled = $an; $ok.BackColor = $(if ($an) { & $rgb $BraunDunkel } else { & $rgb '#D9D2C9' })
  }
  if ($ein) { $ein.Add_TextChanged($setzeOk) }
  & $setzeOk
  if ($nein) {
    # Zweite Antwort statt Abbruch (z. B. "Anderen Namen") - liefert '__NEIN__'.
    $nb = New-Object System.Windows.Forms.Button
    $nb.Text = $nein; $nb.Size = New-Object System.Drawing.Size(170, 36); $nb.Location = New-Object System.Drawing.Point(($w - 28 - 130 - 180), $y)
    $nb.FlatStyle = 'Flat'; $nb.DialogResult = 'No'; $d.Controls.Add($nb)
    $d.ControlBox = $false
  } elseif ($abbrechbar) {
    $ab = New-Object System.Windows.Forms.Button
    $ab.Text = 'Abbrechen'; $ab.Size = New-Object System.Drawing.Size(110, 36); $ab.Location = New-Object System.Drawing.Point(($w - 28 - 130 - 120), $y)
    $ab.FlatStyle = 'Flat'; $ab.DialogResult = 'Cancel'; $d.CancelButton = $ab; $d.Controls.Add($ab)
  } else {
    # Schluessel-Dialog: Schliessen erst nach GESICHERT (sonst blieben Sicherungen unlesbar).
    $d.ControlBox = $false
  }
  $d.ClientSize = New-Object System.Drawing.Size($w, ($y + 56))
  $d.Add_Shown({ $d.Activate(); if ($ein) { $ein.Focus(); $ein.SelectAll() } })
  $erg = $d.ShowDialog()
  $wert = if ($ein) { $ein.Text } else { '' }
  $d.Dispose()
  if ($erg -eq 'No') { return '__NEIN__' }
  if ($erg -ne 'OK') { return $null }
  return $wert
}
#  Eine Frage aus install.sh beantworten. $null = abgebrochen.
function BoxFrage([string]$id, [string]$text, [string]$geheim) {
  switch ($id) {
    'code' {
      $script:CodeVersuche++
      $h = if ($script:CodeVersuche -gt 1) { U 'Das passt nicht zum Format {-} bitte noch einmal pr{ue}fen.' } else { '' }
      return Dialog 'Einrichtungscode' (U "Bitte den Einrichtungscode eingeben, den Sie von Praxura erhalten haben.`r`nFormat: XXXX-XXXX-XXXX-XXXX (Bindestriche d{ue}rfen fehlen).") -gross $true -hinweis $h `
        -pruef { param($t) ($t -replace '[\s-]', '') -match '^[0-9A-Za-z]{16}$' }
    }
    'name' {
      $adr = if ($script:Vorschlag) { $script:Vorschlag } else { '(siehe Protokoll)' }
      $a = Dialog 'Adresse der Box' (U "Ihre Praxis-Box ist im Praxisnetz unter dieser Adresse erreichbar:`r`n`r`n      $adr`r`n`r`nPasst der Name? Sonst schl{ae}gt Praxura einen anderen vor.") -feld $false `
        -weiter (U '{Ue}bernehmen') -nein 'Anderen Namen'
      if ($a -eq '__NEIN__') { return 'N' } elseif ($null -eq $a) { return $null } else { return 'J' }
    }
    'sicherungsziel' {
      return Dialog 'Sicherungsziel' (U ("Die Box sichert jede Nacht ihre Daten. Wohin?`r`n`r`n" +
        "F{ue}r den Anfang einfach leer lassen {-} dann bleiben die Sicherungen auf diesem PC. " +
        "Eine externe Platte oder ein NAS l{ae}sst sich sp{ae}ter einrichten (Pfad in der Linux-Umgebung, z. B. /mnt/sicherung).")) -weiter 'Weiter'
    }
    'tls' {
      $a = Dialog 'Zertifikat' (U "Ist die Adresse der Box aus dem Internet {ue}ber eine echte Domain erreichbar, und soll Let's Encrypt ein Zertifikat ausstellen?`r`n`r`nIm Praxisnetz: Nein.") -feld $false `
        -weiter 'Nein (Praxisnetz)' -nein "Ja, Let's Encrypt"
      if ($a -eq '__NEIN__') { return 'j' } elseif ($null -eq $a) { return $null } else { return 'n' }
    }
    'gesichert' {
      $block = (($geheim -split "`n") | Where-Object { $_ -notmatch '^\s*[^\x00-\x7F]{8,}\s*$' }) -join "`r`n"
      return Dialog (U 'Notfall-Schl{ue}ssel {-} jetzt sichern') (U ("Diese Schl{ue}ssel werden nur jetzt ein einziges Mal angezeigt. Ohne sie lassen sich Sicherungen und verschl{ue}sselte Patientendaten nicht wiederherstellen.`r`n`r`n" +
        "Auf Papier notieren oder auf einem USB-Stick speichern {-} NICHT auf diesem PC und nicht im Sicherungsordner. Danach unten GESICHERT eintippen.")) `
        -geheim $block.Trim() -abbrechbar $false -gross $true -pruef { param($t) $t.Trim() -eq 'GESICHERT' }
    }
    default {
      return Dialog 'Praxura' ($text.Trim())
    }
  }
}
#  Eine normale Zeile von install.sh: ins Protokoll, Teilschritt in die Statuszeile.
function BoxZeile([string]$z) {
  $Ui.Zeilen.Enqueue("    $z")
  if ($z -match '^\[(\d+)/17\]\s*(.*)$') { $Ui.Titel = "Schritt 6 von 11: Box einrichten $(U '{-}') $($Matches[2]) ($($Matches[1])/17)" }
  elseif ($z -match 'Vorgeschlagene Adresse:\s*(\S+)') { $script:Vorschlag = $Matches[1] }
  elseif ($z -match '\[fehler\]\s*(.*)$') { $script:BoxFehler.Titel = $Matches[1].Trim() }
  elseif ($z -match '^\s*Gefunden:\s*(.*)$') { $script:BoxFehler.Gefunden = $Matches[1].Trim() }
  elseif ($z -match '^\s*Was tun:\s*(.*)$') { $script:BoxFehler.Tun = $Matches[1].Trim() }
}
function BoxImFenster {
  $script:CodeVersuche = 0; $script:Vorschlag = ''
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'wsl.exe'
  # Nur feste Werte in der Kommandozeile (Kanal, Pfad) - keine Antwort, kein Geheimnis.
  $psi.Arguments = "-d $Distro -u root --exec bash -c `"exec 2>&1; PRAXURA_BROWSER_OEFFNEN=1 exec bash '$BoxPfad/install.sh' --kanal=$Kanal --fenster`""
  $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
  $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true
  $psi.StandardOutputEncoding = New-Object System.Text.UTF8Encoding $false
  $p = [System.Diagnostics.Process]::Start($psi)
  $an = New-Object System.IO.StreamWriter($p.StandardInput.BaseStream, (New-Object System.Text.UTF8Encoding $false))
  $an.NewLine = "`n"; $an.AutoFlush = $true
  $geheim = New-Object System.Text.StringBuilder
  while ($null -ne ($z = $p.StandardOutput.ReadLine())) {
    if ($z.StartsWith('@@PRAXURA GEHEIM ')) { [void]$geheim.AppendLine($z.Substring(17)); continue }
    if ($z.StartsWith('@@PRAXURA GEHEIM')) { [void]$geheim.AppendLine(''); continue }
    if ($z.StartsWith('@@PRAXURA FRAGE ')) {
      $teile = @($z.Substring(16) -split ' ', 2)
      $text = if ($teile.Count -gt 1) { $teile[1] } else { '' }
      $antwort = BoxFrage $teile[0] $text $geheim.ToString()
      if ($teile[0] -eq 'gesichert') { [void]$geheim.Clear() }
      if ($null -eq $antwort) { try { $an.Close() } catch { } ; continue }   # EOF -> install.sh bricht sauber ab
      try { $an.WriteLine($antwort) } catch { }
      $antwort = $null
      continue
    }
    BoxZeile $z
  }
  $p.WaitForExit()
  [void]$geheim.Clear()
  try { $an.Dispose() } catch { }
  return $p.ExitCode
}

function Log([string]$t)  {
  $z = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $t"; Add-Content -Path $LogDatei -Value $z -Encoding UTF8; Write-Host $t
  if ($Ui) {
    if ($t -match '^\[(\d+)/11\]') { UiSchritt ([int]$Matches[1]) }
    $Ui.Zeilen.Enqueue($t)
  }
}
function Ok([string]$t)   { Log "  [ok] $t" }
function Warn([string]$t) { Log "  [Hinweis] $t"; if ($Ui -and $Ui.Aktiv) { $Ui.Hinweis[[int]$Ui.Aktiv] = $true } }
function Fehler([string]$titel, [string]$gefunden, [string]$tun) {
  Log ''
  Log "  X [Fehler] $titel"
  Log "      Gefunden: $gefunden"
  Log "      Was tun:  $tun"
  Log ''
  Log "  Protokoll: $LogDatei"
  if ($Ui) {
    $Ui.Titel = "Abgebrochen: $titel"
    UiFrage "Abgebrochen: $titel" "Gefunden: $gefunden`r`nWas tun: $tun" 'OK' '' | Out-Null
    UiAbschluss "Abgebrochen: $titel" $false
  }
  exit 1
}
function Frage([string]$text, [bool]$standardJa = $true, [string]$erklaerung = '', [string]$ja = 'Ja', [string]$nein = 'Nein') {
  if ($Ui) { return (UiFrage (U $text) (U $erklaerung) (U $ja) (U $nein)) }
  $vorschlag = if ($standardJa) { '[J/n]' } else { '[j/N]' }
  if ($erklaerung) { Write-Host "  $(U $erklaerung)" }
  $a = Read-Host "  $text $vorschlag"
  if ([string]::IsNullOrWhiteSpace($a)) { return $standardJa }
  return ($a -match '^[jJyY]')
}
# Befehl in der Praxura-Umgebung als root; Ausgabe UTF-8 (wsl.exe schreibt sonst UTF-16).
#  Ausgabe geht an den Bildschirm (Out-Host), NICHT in den Rueckgabewert - sonst
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
#  wsl.exe mit verworfener bzw. eingesammelter Fehlerausgabe. NIE "& wsl.exe ... 2>$null"
#  direkt schreiben: unter $ErrorActionPreference='Stop' macht PowerShell 5.1 aus der
#  ersten Fehlerzeile eines Programms einen Abbruch (NativeCommandError). Auf einem
#  sauberen Windows 11 endete die Einrichtung so in Schritt 2 (11.10.2026).
function WslLeise {
  $alt = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & wsl.exe @args 2>$null } finally { $ErrorActionPreference = $alt }
}
function WslMitFehlertext {
  $alt = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & wsl.exe @args 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $alt }
}
#  Gibt es fuer diesen Benutzer ueberhaupt eine Linux-Umgebung? Aus der Registrierung,
#  NICHT ueber wsl.exe: ohne installiertes WSL ist wsl.exe nur ein Platzhalter, der bei
#  jedem Aufruf "Press any key to install" zeigt und WSL an install.ps1 vorbei einrichtet.
function WslInBenutzung {
  $k = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'
  return [bool]((Test-Path $k) -and @(Get-ChildItem $k -ErrorAction SilentlyContinue).Count -gt 0)
}
function BoxEnv([string]$schluessel) {
  $env:WSL_UTF8 = '1'
  $w = WslLeise -d $Distro -u root --exec awk -F= -v k=$schluessel '$1==k{sub(/^[^=]*=/,x); print; exit}' "$BoxPfad/.env"
  return ([string]($w | Select-Object -First 1)).Trim()
}
function DistroVorhanden {
  if (-not (WslInBenutzung)) { return $false }
  $env:WSL_UTF8 = '1'
  $liste = (WslLeise -l -q) -join "`n"
  return ($liste -split "`n" | ForEach-Object { $_.Trim() }) -contains $Distro
}

Log ''
Log "Praxura Praxis-Box - Windows-Einrichtung $(Get-Date -Format 'dd.MM.yyyy HH:mm')"
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
    Warn "Browser liess sich nicht oeffnen - Link: $siteUrl/setup.html (Jeton steht in .env unter SETUP_TOKEN)"
  }
  exit 0
}

if (-not $Text) {
  $Ui = UiStarten
  if ($Ui) { KonsoleZeigen 6 } else { Log '  (Einrichtungsfenster nicht verfuegbar - es geht hier im Textfenster weiter)' }
}

# -- 1  Vorpruefung -----------------------------------------------------------
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
  Fehler 'Windows-Version zu alt' "Build $build" 'Windows 11 ab Version 22H2 (Build 22621) wird benoetigt - das gespiegelte WSL-Netzwerk gibt es erst dort. Windows aktualisieren oder einen Linux-Server verwenden.'
}
$cs  = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
if (-not ($cs.HypervisorPresent -or $cpu.VirtualizationFirmwareEnabled)) {
  Fehler 'Virtualisierung ist ausgeschaltet' 'weder Hypervisor aktiv noch im BIOS/UEFI eingeschaltet' 'Im BIOS/UEFI "Intel VT-x" bzw. "AMD-V/SVM" einschalten, dann erneut starten.'
}
$ramGb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 1)
if ($ramGb -lt 7.5) {
  Fehler 'Zu wenig Arbeitsspeicher' "$ramGb GB" 'Mindestens 8 GB RAM. WSL gibt der Box die Haelfte - darunter reicht es nicht fuer Datenbank + Dienste.'
}
$frei = [math]::Round((Get-PSDrive C).Free / 1GB)
if ($frei -lt 50) {
  Fehler 'Zu wenig freier Speicher auf C:' "$frei GB frei" 'Mindestens 50 GB auf C: freimachen. (install.sh kann das in WSL nicht pruefen - es sieht nur die virtuelle Platte.)'
}
$dd = Get-Process -Name 'Docker Desktop', 'com.docker.backend' -ErrorAction SilentlyContinue
if ($dd) {
  Fehler 'Docker Desktop laeuft' 'Docker Desktop ist gestartet' 'Docker Desktop beenden und in seinen Einstellungen "Start Docker Desktop when you sign in" ausschalten (besser: deinstallieren). Die Box bringt ihren eigenen Docker mit - zwei Docker auf einem PC stoeren sich.'
}
if (Test-Path "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe") {
  Warn 'Docker Desktop ist installiert (laeuft aber nicht). Nicht gleichzeitig mit der Box starten.'
}
if (-not $Fortsetzen -or -not (DistroVorhanden)) {
  $belegt = Get-NetTCPConnection -State Listen -LocalPort 80, 443 -ErrorAction SilentlyContinue
  if ($belegt) {
    $p = ($belegt | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } | Sort-Object -Unique) -join ', '
    Fehler 'Port 80 oder 443 ist belegt' "Programm: $p" 'Dieses Programm beenden/deinstallieren (z. B. IIS, Skype, ein anderer Webserver). Die Box braucht beide Ports. (install.sh sieht Windows-Programme nicht - deshalb hier.)'
  }
}
Ok "Windows Build $build - $ramGb GB RAM - $frei GB frei auf C: - Virtualisierung an"

# -- 2  .wslconfig ------------------------------------------------------------
Log '[2/11] WSL-Einstellungen'
$wslconfig = Join-Path $env:USERPROFILE '.wslconfig'
$soll = @"
# Praxura Praxis-Box (praxura-installieren.ps1) - bitte nicht entfernen.
[wsl2]
# Gespiegeltes Netzwerk: die Box ist unter der IP dieses PCs im Praxisnetz
# erreichbar (Tablet, zweiter PC), ohne Portweiterleitung.
networkingMode=mirrored
# Nie wegen Leerlauf abschalten - die Box soll auch nachts erreichbar sein
# (naechtliche Sicherung 01:00, Update 02:00).
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
  # Ohne vorhandene Linux-Umgebung laeuft nichts - dann nicht aufrufen (Platzhalter, s. o.).
  if (WslInBenutzung) {
    WslLeise --shutdown | Out-Null
    Start-Sleep -Seconds 8   # WSL braucht einige Sekunden, bis die VM wirklich weg ist
  }
}

# O-190: alle WSL-Distributionen teilen eine Netzschicht. Startet eine ZWEITE
# Distribution ihren eigenen dockerd, schreibt der iptables fuer sein Netz neu
# und die Box verliert die Verbindung zur eigenen Datenbank (10.10.2026 auf der
# Test-Box gemessen) - api/caddy bleiben dabei gruen, kein Alarm.
# Nur LAUFENDE Distributionen pruefen: eine gestoppte zu starten waere genau der Fehler.
$env:WSL_UTF8 = '1'
$laufend = @()
if (WslInBenutzung) {
  $laufend = (WslLeise -l --running -q) -replace "`0", '' |
    ForEach-Object { $_.Trim() } | Where-Object { $_ -and $_ -ne $Distro }
}
foreach ($d in $laufend) {
  WslLeise -d $d --exec pgrep -x dockerd | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Warn "WARNUNG: In der Linux-Umgebung `"$d`" laeuft ein eigener Docker-Dienst. Laufen beide gleichzeitig, kann die Praxura-Box die Verbindung zu ihrer Datenbank verlieren. Bitte `"$d`" beenden (wsl --terminate $d) und nicht parallel zur Box betreiben."
  }
}

# -- 3  Linux-Umgebung "Praxura" ---------------------------------------------
Log "[3/11] Linux-Umgebung '$Distro' ($DistroBasis)"
if (DistroVorhanden) {
  Ok "'$Distro' ist schon eingerichtet"
} else {
  New-Item -ItemType Directory -Force -Path $WslOrt | Out-Null
  $env:WSL_UTF8 = '1'
  $out = WslMitFehlertext --install $DistroBasis --name $Distro --location $WslOrt --no-launch
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
      if ($Text) { $weiterArgs += ' -Text' }
      $akt = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoExit -ExecutionPolicy Bypass -File `"$SkriptKopie`" -Fortsetzen$weiterArgs"
      $trg = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
      $prn = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
      Register-ScheduledTask -TaskName $AufgabeFortsetzen -Action $akt -Trigger $trg -Principal $prn -Force | Out-Null
      Log ''
      Log '  >>> Windows muss jetzt einmal NEU GESTARTET werden. Nach der Anmeldung'
      Log '      geht die Einrichtung in einem PowerShell-Fenster von selbst weiter.'
      if ($Ui) {
        $Ui.Titel = 'Neustart noetig - danach geht es von selbst weiter'
        $a = UiFrage 'Windows jetzt neu starten?' (U "Die Linux-Umgebung ist erst nach einem Neustart fertig. Nach der Anmeldung geht die Einrichtung von selbst weiter (Windows fragt dann noch einmal nach Administratorrechten). Vorher offene Dokumente speichern.") 'Jetzt neu starten' (U 'Sp{ae}ter selbst')
        if ($a) { Restart-Computer -Force }
        UiAbschluss (U 'Neustart n{oe}tig {-} danach geht es von selbst weiter') $true $false
      }
      exit 0
    }
    Fehler 'Linux-Umgebung konnte nicht angelegt werden' "wsl --install, Rueckgabe $code" 'Ausgabe oben bzw. im Protokoll pruefen. "wsl --update" ausfuehren und dieses Skript erneut starten.'
  }
  Ok "'$Distro' angelegt unter $WslOrt"
}
if ((InWsl 'true') -ne 0) {
  Fehler "'$Distro' startet nicht" 'wsl -d Praxura liefert einen Fehler' '"wsl --update" ausfuehren, PC neu starten, Skript erneut starten.'
}

# -- 4  systemd + Docker Engine -----------------------------------------------
Log '[4/11] systemd + Docker Engine (in der Linux-Umgebung)'
if ((InWsl 'grep -q "^systemd=true" /etc/wsl.conf 2>/dev/null') -ne 0) {
  InWsl 'printf "[boot]\nsystemd=true\n\n[user]\ndefault=root\n" > /etc/wsl.conf' | Out-Null
  WslLeise --terminate $Distro | Out-Null
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

# -- 5  Programmdateien -------------------------------------------------------
Log '[5/11] Programmdateien nach /opt/praxura'
if ((InWsl "[ -f $BoxPfad/.env ]") -eq 0) {
  # Eingerichtete Box: Dateien gehoeren update.sh (manifest/.praxura-stand, J3) - nicht ueberschreiben.
  Ok 'Box schon eingerichtet - Programmdateien bleiben (Aktualisierung macht update.sh)'
} else {
  # K2b.14 (O-157/O-176): Dateien aus DEMSELBEN Image wie spaeter der Betrieb, per Digest.
  if ((InWsl "docker manifest inspect ${ApiImageBasis}:$Kanal >/dev/null 2>&1") -ne 0) {
    if ($Kanal -eq 'stable' -and -not $PSBoundParameters.ContainsKey('Kanal')) {
      Warn "Der Kanal 'stable' ist noch nicht veroeffentlicht."
      if (-not (Frage "Mit 'beta' installieren?" $true "Der Kanal 'stable' ist noch nicht ver{oe}ffentlicht. Ein Wechsel zu 'stable' geht sp{ae}ter, sobald 'stable' Ihre Version erreicht hat. 'Nein' bricht die Einrichtung ab.")) {
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
  UiAbschluss '-NurVorbereiten: Schritte 1-5 fertig' $true
  exit 0
}

# -- 6  install.sh ------------------------------------------------------------
Log '[6/11] Einrichtung der Box (install.sh)'
$installiertJetzt = $false
if ((InWsl "[ -f $BoxPfad/.env ]") -eq 0) {
  Ok 'Box ist schon eingerichtet (.env vorhanden) - install.sh wird NICHT erneut ausgefuehrt'
} else {
  # Stufe 2 (Konsey 2026-10-13): kann das install.sh dieses Kanals --fenster, fragt
  # das Einrichtungsfenster selbst - kein schwarzes Fenster. Sonst (aelteres Image,
  # O-204 Bed. 1) Stufe 1: eigenes Konsolenfenster.
  $fensterFaehig = $false
  if ($Ui) { $fensterFaehig = ((InWsl "grep -q -- '--fenster' $BoxPfad/install.sh") -eq 0) }
  if (-not $fensterFaehig) {
  Log ''
  Log '  Gleich stellt die Einrichtung Fragen. Empfehlungen fuer diesen PC:'
  Log '    Einrichtungscode:    Einrichtungscode (von Praxura erhalten) eingeben - Enter ohne Code = eigene Adresse (Ausnahmefall)'
  Log "    Eigene Adresse:      (nur im Ausnahmefall): https://praxis.home.arpa  (oder: https://$($env:COMPUTERNAME.ToLower()).fritz.box)"
  Log '    Echtes Zertifikat:   n   (Praxisnetz, nicht aus dem Internet erreichbar; entfaellt bei Einrichtungscode)'
  Log '    Sicherungsziel:      siehe Schritt 11 unten - fuer den Anfang leer lassen geht auch'
  Log ''
  }
  if ($fensterFaehig) {
    $Ui.Titel = 'Die Box wird eingerichtet ...'
    $rcSh = BoxImFenster
  } elseif ($Ui) {
    # Eigenes Konsolenfenster: install.sh braucht ein echtes Terminal (-t 0) und die
    # Antworten (Code, Name, GESICHERT) tippt die Praxis dort selbst - nichts davon
    # geht durch das Einrichtungsfenster, die Kommandozeile oder eine Datei.
    $Ui.Titel = 'Bitte im zweiten Fenster weitermachen ...'
    UiFrage 'Gleich kommt ein zweites, schwarzes Fenster' (U ("Dort: Einrichtungscode eintippen, Name und Sicherungsziel mit Enter {ue}bernehmen, " +
      "angezeigte Schl{ue}ssel auf Papier/USB-Stick sichern und GESICHERT eintippen. Am Ende mit Enter schlie{ss}en {-} danach geht es hier weiter.")) 'Verstanden' '' | Out-Null
    $sh = ("printf ']0;Praxura - Einrichtung der Box'`n" +
           "env PRAXURA_BROWSER_OEFFNEN=1 bash '$BoxPfad/install.sh' '--kanal=$Kanal'`n" +
           "rc=`$?`n" +
           "echo`n" +
           "if [ `$rc -eq 0 ]; then echo '  Fertig. Enter druecken - es geht im Praxura-Fenster weiter.'; else echo `"  Abgebrochen (Rueckgabe `$rc). Meldung oben lesen, dann Enter druecken.`"; fi`n" +
           "read -r _`n" +
           "exit `$rc`n")
    $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sh))
    $proc = Start-Process -FilePath 'wsl.exe' -ArgumentList "-d $Distro -u root --exec bash -c `"source <(echo $b64 | base64 -d)`"" -PassThru
    $null = $proc.Handle   # sonst liefert ExitCode in PowerShell 5.1 nichts
    $proc.WaitForExit()
    $rcSh = $proc.ExitCode
  } else {
    & wsl.exe -d $Distro -u root -- env PRAXURA_BROWSER_OEFFNEN=1 bash "$BoxPfad/install.sh" "--kanal=$Kanal"
    $rcSh = $LASTEXITCODE
  }
  if ($rcSh -ne 0) {
    if ($script:BoxFehler.Titel) {
      Fehler $script:BoxFehler.Titel $script:BoxFehler.Gefunden "$($script:BoxFehler.Tun) (Protokoll der Box: wsl -d $Distro -- cat $BoxPfad/install.log)"
    }
    Fehler 'install.sh ist nicht durchgelaufen' "Rueckgabe $rcSh" "Meldung oben bzw. im zweiten Fenster lesen; Protokoll: wsl -d $Distro -- cat $BoxPfad/install.log"
  }
  $installiertJetzt = $true
}
$siteUrl = BoxEnv 'SITE_URL'
$hostName = ($siteUrl -replace '^https://', '').Trim().TrimEnd('/')
if (-not $hostName) { Fehler 'SITE_URL nicht gefunden' "$BoxPfad/.env" 'install.sh erneut ausfuehren.' }
Ok "Box eingerichtet: $siteUrl"

# -- 7  Autostart -------------------------------------------------------------
Log '[7/11] Autostart beim Einschalten des PCs'
# Eine WSL-Umgebung gehoert einem BENUTZER (nicht SYSTEM) - die Aufgabe laeuft
# deshalb als der einrichtende Benutzer, "auch wenn niemand angemeldet ist".
# sleep infinity haelt die Umgebung offen; Docker startet die Container selbst
# (restart: unless-stopped). Aendert sich das Windows-Passwort, muss die
# Aufgabe neu gespeichert werden (Anleitung, Abschnitt Windows).
#
# O-197/O-198 (11.10.2026, Testbox): der Start-Ausloeser allein reicht nicht.
# Nach dem Aufwachen aus dem Standby beendet Windows die Umgebung, und beim
# Hochfahren endete die Aufgabe einmal sofort mit 0xC000013A - beide Male blieb
# die Box aus, bis jemand von Hand nachsah (RestartCount half nicht). Deshalb
# zusaetzlich alle 5 Minuten ausloesen; laeuft die Aufgabe noch, verwirft
# "IgnoreNew" den neuen Start, sonst ist die Box spaetestens dann wieder da.
$wdh = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5)
$set = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew
# Ohne Fenster (Test 14.10.2026): wsl.exe direkt als Aufgabe oeffnet bei "Start bei
# Anmeldung" ein schwarzes Konsolenfenster. conhost --headless startet es unsichtbar.
$wslArg = "-d $Distro -u root --exec /bin/sleep infinity"
$conhost = "$env:SystemRoot\System32\conhost.exe"
if (Test-Path $conhost) { $akt = New-ScheduledTaskAction -Execute $conhost -Argument "--headless `"$env:SystemRoot\System32\wsl.exe`" $wslArg" }
else { $akt = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\wsl.exe" -Argument $wslArg }
$vorh = Get-ScheduledTask -TaskName $AufgabeStart -ErrorAction SilentlyContinue
if ($vorh -and ($vorh.Triggers | Where-Object { $_.Repetition.Interval })) {
  Ok 'Autostart-Aufgabe ist schon eingerichtet'
  if ((Test-Path $conhost) -and -not ($vorh.Actions | Where-Object { $_.Execute -like '*conhost*' })) {
    try {
      Set-ScheduledTask -TaskName $AufgabeStart -Action $akt -ErrorAction Stop | Out-Null
      Ok 'Autostart-Aufgabe startet die Box jetzt ohne sichtbares Fenster'
    } catch {
      Warn "Autostart-Aufgabe konnte nicht auf 'ohne Fenster' umgestellt werden ($($_.Exception.Message))."
    }
  }
} elseif ($vorh) {
  # Aufgabe aus einer aelteren Einrichtung: Wiederholung nachtragen. Mit
  # gespeichertem Passwort verlangt Windows es dafuer erneut - dann nur warnen.
  try {
    Set-ScheduledTask -TaskName $AufgabeStart -Trigger (@($vorh.Triggers) + $wdh) -Settings $set -ErrorAction Stop | Out-Null
    Ok 'Autostart-Aufgabe ergaenzt (startet die Box nach Standby/Absturz innerhalb von 5 Minuten neu)'
  } catch {
    Warn "Autostart-Aufgabe konnte nicht ergaenzt werden ($($_.Exception.Message)). Nach Standby bleibt die Box aus. Abhilfe: Aufgabe `"$AufgabeStart`" in der Aufgabenplanung loeschen und dieses Skript erneut starten."
  }
} else {
  $trg = @((New-ScheduledTaskTrigger -AtStartup), $wdh)
  Log "  Fuer den Start OHNE Anmeldung braucht Windows einmalig das Passwort von $env:USERNAME"
  Log '  (es wird von Windows verschluesselt gespeichert, nicht von Praxura).'
  # Im Fenstermodus eigener Praxura-Dialog: Get-Credential kam beim Test (14.10.2026)
  # nicht sichtbar und lieferte leer. Das Passwort geht nur an Register-ScheduledTask,
  # nie ins Einrichtungsfenster, Protokoll oder Log.
  if ($Ui) {
    $pw = Dialog 'Windows-Passwort' (U ("Damit die Box schon beim Einschalten des PCs startet {-} auch bevor sich jemand anmeldet {-} braucht Windows einmalig das Passwort von $env:USERNAME. " +
      "Windows speichert es verschl{ue}sselt, Praxura nicht.`r`n`r`n'{Ue}berspringen': die Box startet erst, wenn sich jemand an diesem PC anmeldet.")) `
      -passwort $true -weiter 'Speichern' -nein (U '{Ue}berspringen') -pruef { param($t) $t.Length -gt 0 }
    if ($pw -eq '__NEIN__') { $pw = $null }
    $benutzer = "$env:USERDOMAIN\$env:USERNAME"
  } else {
    $cred = Get-Credential -UserName "$env:USERDOMAIN\$env:USERNAME" -Message 'Windows-Passwort fuer den Autostart der Praxis-Box'
    $pw = if ($cred) { $cred.GetNetworkCredential().Password } else { $null }
    $benutzer = if ($cred) { $cred.UserName } else { "$env:USERDOMAIN\$env:USERNAME" }
  }
  try {
    if (-not $pw) { throw 'kein Passwort eingegeben' }
    Register-ScheduledTask -TaskName $AufgabeStart -Action $akt -Trigger $trg -Settings $set -User $benutzer -Password $pw -RunLevel Highest -Force | Out-Null
    $pw = $null
    Ok 'Autostart eingerichtet (beim Systemstart, auch ohne Anmeldung)'
  } catch {
    $pw = $null
    Warn "Autostart ohne Anmeldung nicht moeglich ($($_.Exception.Message)) - richte Start bei Anmeldung ein."
    $trg2 = @((New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"), $wdh)
    Register-ScheduledTask -TaskName $AufgabeStart -Action $akt -Trigger $trg2 -Settings $set -User "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest -Force | Out-Null
    Warn 'Die Box startet jetzt erst, wenn sich jemand an diesem PC anmeldet (automatische Anmeldung waere eine Alternative).'
  }
}

# -- 8  Firewall --------------------------------------------------------------
Log '[8/11] Firewall: Box im Praxisnetz erreichbar (nur privates Netz)'
if (Get-Command New-NetFirewallHyperVRule -ErrorAction SilentlyContinue) {
  if (-not (Get-NetFirewallHyperVRule -Name 'Praxura-Box-HTTPS' -ErrorAction SilentlyContinue)) {
    New-NetFirewallHyperVRule -Name 'Praxura-Box-HTTPS' -DisplayName 'Praxura Box (80/443)' -Direction Inbound -VMCreatorId $WslVmCreatorId -Protocol TCP -LocalPorts 80, 443 -Action Allow | Out-Null
  }
  Ok 'Hyper-V-Firewall: 80/443 eingehend erlaubt'
} else {
  Warn 'Hyper-V-Firewall-Befehle fehlen (Windows zu alt?) - Zugriff aus dem LAN evtl. blockiert.'
}
if (-not (Get-NetFirewallRule -Name 'Praxura-Box-HTTPS' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -Name 'Praxura-Box-HTTPS' -DisplayName 'Praxura Box (80/443)' -Direction Inbound -Protocol TCP -LocalPort 80, 443 -Action Allow -Profile Private | Out-Null
}
Ok 'Windows-Firewall: 80/443 eingehend, nur Profil "Privat"'
$profile = Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'NoTraffic' } | Select-Object -First 1
if ($profile -and $profile.NetworkCategory -ne 'Private') {
  Warn "Das Netzwerk '$($profile.Name)' ist als '$($profile.NetworkCategory)' eingestuft - andere Geraete erreichen die Box erst, wenn es in Windows auf 'Privat' gestellt wird (Einstellungen > Netzwerk > Eigenschaften)."
}

# -- 9  Wurzelzertifikat + hosts ----------------------------------------------
Log '[9/11] Wurzelzertifikat der Box + Adresse auf diesem PC'
$tlsModus = BoxEnv 'CADDY_TLS_MODUS'
$tls = BoxEnv 'CADDY_TLS_ARG'
if ($tlsModus -eq 'acmedns') {
  Ok "echtes Zertifikat (Let's Encrypt ueber den Praxura-Namensdienst) - kein Import noetig"
} elseif ($tls -eq 'internal') {
  $crt = Join-Path $DatenOrt 'praxura-wurzelzertifikat.crt'
  $crtWsl = '/mnt/' + $crt.Substring(0, 1).ToLower() + ($crt.Substring(2) -replace '\\', '/')
  # K2b.19: namensbeschraenkter Root aus volumes/caddy-ca; aeltere Boxen: Caddys eigener Root.
  if (Test-Path $crt) { Remove-Item $crt -Force }
  InWsl "cd $BoxPfad && if [ -f volumes/caddy-ca/root.crt ]; then cp volumes/caddy-ca/root.crt '$crtWsl'; else docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt '$crtWsl'; fi" | Out-Null
  if (Test-Path $crt) {
    # Fingerabdruck aus der DATEI (Import-Certificate liefert bei schon vorhandenem Zertifikat ggf. nichts).
    $neuThumb = (New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $crt).Thumbprint
    Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    # Frueher importierte Roots GENAU dieser Box (anderer Fingerabdruck) entfernen (S-53 Nr. 5) -
    # nur dieser Name, damit eine zweite Praxura-Box im selben Netz ihren Root behaelt.
    if ($neuThumb) {
      Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -eq "CN=Praxura Box CA $hostName" -and $_.Thumbprint -ne $neuThumb } |
        ForEach-Object { Remove-Item -Path $_.PSPath -Force; Ok "alten Praxura-Root entfernt ($($_.Thumbprint))" }
    }
    Ok "Zertifikat in Windows als vertrauenswuerdig eingetragen ($crt - diese Datei auch auf Tablets/anderen PCs importieren)"
  } else {
    Warn 'Zertifikat noch nicht vorhanden (caddy startet evtl. noch) - Skript spaeter erneut ausfuehren.'
  }
} else {
  Ok "echtes Zertifikat (Let's Encrypt) - kein Import noetig"
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

# -- 10 Energie ---------------------------------------------------------------
Log '[10/11] Energieoptionen'
Log '  Schlaeft oder ruht der PC, ist die Box fuer alle anderen Geraete weg.'
if (Frage 'Soll dieser PC wach bleiben?' $true ('Schl{ae}ft der PC, ist die Box f{ue}r Tablets und andere PCs weg. "Ja": am Netzteil kein Standby/Ruhezustand, ' +
    'Deckel zuklappen = nichts tun. "Nein": nichts {ae}ndern - reicht, wenn Praxura nur an diesem PC benutzt wird.') 'Ja, wach bleiben' 'Nein, nichts {ae}ndern') {
  powercfg /change standby-timeout-ac 0   | Out-Null
  powercfg /change hibernate-timeout-ac 0 | Out-Null
  $eapAlt = $ErrorActionPreference; $ErrorActionPreference = 'Continue'   # Desktop-PC ohne Deckel: Fehlerzeile, kein Abbruch
  try { powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0 2>$null | Out-Null } finally { $ErrorActionPreference = $eapAlt }
  powercfg /setactive SCHEME_CURRENT | Out-Null
  Ok 'Energie: am Netzteil kein Standby/Ruhezustand, Deckel zu = nichts tun'
} else {
  Warn 'Energieoptionen unveraendert - die Box ist nur erreichbar, solange der PC wach ist.'
}
if ((Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue)) {
  Warn 'Laptop erkannt: am Akku greifen die Windows-Energiesparregeln trotzdem. Fuer den Praxisbetrieb dauerhaft am Netzteil lassen.'
}

# -- 11 Sicherungsziel --------------------------------------------------------
Log '[11/11] Sicherungsziel'
$ziel = BoxEnv 'BACKUP_ZIEL'
if ($ziel) {
  Ok "Sicherungen gehen nach $ziel"
} else {
  Warn 'Sicherungen liegen auf DIESEM PC - bei einem Plattendefekt sind Daten und Sicherung zugleich weg.'
  Log  '  Externe USB-Platte (z. B. Laufwerk E:) dauerhaft einbinden - in der Linux-Umgebung:'
  Log  "    wsl -d $Distro -- bash -c ""mkdir -p /mnt/praxura-sicherung && echo 'E: /mnt/praxura-sicherung drvfs defaults,nofail 0 0' >> /etc/fstab && mount -a"""
  Log  "    dann in $BoxPfad/.env: BACKUP_ZIEL=/mnt/praxura-sicherung/praxura  und einmal:"
  Log  "    wsl -d $Distro -- bash -c 'mkdir -p /mnt/praxura-sicherung/praxura && touch /mnt/praxura-sicherung/praxura/.praxura-backup-ziel'"
  Log  '  (Fehlt die Platte spaeter, bricht die Sicherung laut ab statt still auf den PC zu schreiben.)'
  Log  '  Empfehlung: die Sicherungsplatte mit BitLocker verschluesseln.'
}

# -- Ende ---------------------------------------------------------------------
# Adapter MIT Standard-Gateway = echtes Praxisnetz. Ohne diesen Filter kam beim
# Test (02.10.2026) eine Hyper-V-Adresse (vEthernet, 192.168.176.1) heraus.
$lanIp = (Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress
Log ''
Log '  ================================================================'
Log "  Fertig. Auf diesem PC im Browser:  $siteUrl/login.html"
if ($lanIp) {
  Log "  Andere Geraete (Tablet, zweiter PC) brauchen die Adresse $hostName -> $lanIp"
  Log '  (im Router als DNS-Eintrag; bei der FRITZ!Box zusaetzlich unter'
  Log "   Heimnetz > Netzwerk > Netzwerkeinstellungen > DNS-Rebind-Schutz: $hostName)"
  Log '  und das Wurzelzertifikat (siehe Schritt 9). Dem PC im Router eine feste IP geben.'
}
Log '  ================================================================'
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
      Warn 'Die Seite ist evtl. noch nicht bereit - in 1-2 Minuten im Browser neu laden (F5).'
    }
    Log '  Die Einrichtung oeffnet sich jetzt im Browser.'
    try {
      Start-Process "$siteUrl/setup.html#$jeton"
    } catch {
      Warn "Browser liess sich nicht oeffnen - Link: $siteUrl/setup.html (Jeton steht in .env unter SETUP_TOKEN)"
    }
  }
}
if ($Ui) {
  # Nur die Adresse - nie den Einrichtungs-Jeton (der geht nur direkt an den Browser).
  $Ui.Link = "$siteUrl/login.html"
  $Ui.LinkText = U 'Hier melden Sie sich an {-} am besten als Lesezeichen speichern:'
  if ($installiertJetzt) { $Ui.LinkText = U 'Die Einrichtung wurde im Browser ge{oe}ffnet. Danach melden Sie sich hier an:' }
}
UiAbschluss (U "Fertig {-} weiter im Browser: $siteUrl") $true


# PRAXURA-SKRIPT-ENDE
