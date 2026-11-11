# Praxura - yeni PC kurulumu (Windows 11)
# --------------------------------------------------------------
# Calistirma (Yonetici PowerShell):
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   & "<yol>\kurulum.ps1"
#
# Kaldigi yerden devam eder: her adim bitince durum dosyasina yazilir.
# Yeniden baslatma gerekirse (WSL/Docker) kendini RunOnce'a koyar,
# oturum acinca kaldigi adimdan surer. Tekrar calistirmak zararsizdir.
#
# Bayraklar:
#   -Android   Android Studio + JDK 21 de kur (Infinity Muslim icin)
#   -Ekstra    OBS, CapCut, Discord, Telegram, Steam gibi kisisel uygulamalar
#   -Sifirla   Durum dosyasini sil, bastan basla
#   -Drive     Google Drive "My Drive\pc transfer" icindeki sifreli praxura-tasima.rar'i
#              acar, depo + hafiza + sirlari dogru yerlere dagitir (eski-pc-paketle.ps1 ciktisi)
#   -Yedek X   ayni is, ama .rar'in (ya da acilmis klasorun) durdugu yer elle verilir
# --------------------------------------------------------------
param([switch]$Android, [switch]$Ekstra, [switch]$Sifirla, [string]$Yedek, [switch]$Drive)

$ErrorActionPreference = 'Continue'
$DurumDir  = Join-Path $env:LOCALAPPDATA 'praxura-kurulum'
$DurumFile = Join-Path $DurumDir 'durum.json'
$LogFile   = Join-Path $DurumDir 'kurulum.log'
$RepoUrl   = 'https://github.com/ironkemal/infinitymade-website.git'
# Ayni yol = Claude hafizasi (~\.claude\projects\c--Users-Kemal-Demir-Desktop-claude-website) eslesir
$RepoDir   = Join-Path $env:USERPROFILE 'Desktop\claude\website'

New-Item -ItemType Directory -Force $DurumDir | Out-Null
if ($Sifirla -and (Test-Path $DurumFile)) { Remove-Item $DurumFile -Force }

function Log($m) { $s = "[{0:HH:mm:ss}] $m" -f (Get-Date); Write-Host $s -ForegroundColor Cyan; Add-Content $LogFile $s }
function Durum { if (Test-Path $DurumFile) { Get-Content $DurumFile -Raw | ConvertFrom-Json } else { [pscustomobject]@{ bitti = @() } } }
function Bitti($ad) { (Durum).bitti -contains $ad }
function Isaretle($ad) { $d = Durum; $d.bitti = @($d.bitti) + $ad; $d | ConvertTo-Json | Set-Content $DurumFile -Encoding utf8 }
function PathTazele { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }
function Var($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function YenidenBaslatVeDevam {
    $arg = "-NoExit -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($Android) { $arg += ' -Android' }; if ($Ekstra) { $arg += ' -Ekstra' }
    if ($Yedek) { $arg += " -Yedek `"$Yedek`"" }; if ($Drive) { $arg += ' -Drive' }
    Set-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'PraxuraKurulum' `
        -Value "powershell.exe $arg"
    Log 'Yeniden baslatma gerekiyor. Oturum acinca kurulum KENDILIGINDEN devam edecek.'
    Read-Host 'Enter = simdi yeniden baslat (Ctrl+C = sonra kendim)'
    Restart-Computer -Force; exit
}

function Adim($ad, [scriptblock]$is) {
    if (Bitti $ad) { Log "atlandi (zaten bitti): $ad"; return }
    Log ">>> $ad"
    try { & $is; Isaretle $ad; Log "bitti: $ad" }
    catch { Log "HATA ($ad): $_  -> betigi tekrar calistir, buradan devam eder"; exit 1 }
}

# --- Yonetici kontrolu ---
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Write-Host 'Yonetici PowerShell ile calistir (sag tik > Als Administrator ausfuehren).' -ForegroundColor Red; exit 1 }
if ($env:USERNAME -ne 'Kemal Demir') {
    Write-Host "UYARI: Windows kullanici adi '$env:USERNAME'. Eski PC'de 'Kemal Demir' idi." -ForegroundColor Yellow
    Write-Host '       Claude hafiza klasoru yol adina bagli - TASINACAKLAR.md > "Kullanici adi farkliysa" bolumune bak.' -ForegroundColor Yellow
}

# --- 1. WSL (yeniden baslatma isteyebilir) ---
Adim 'wsl' {
    winget install -e --id Microsoft.WSL --accept-source-agreements --accept-package-agreements --silent
    wsl --install --no-distribution
    Isaretle 'wsl'; YenidenBaslatVeDevam
}

# --- 2. Gelistirme araclari (winget) ---
$paketler = @(
    'Git.Git',
    'GitHub.cli',
    'OpenJS.NodeJS.LTS',
    'Python.Python.3.13',
    'Python.Launcher',
    'astral-sh.uv',
    'Oven-sh.Bun',
    'Docker.DockerDesktop',
    'Gyan.FFmpeg',                 # sosyal/ video uretimi
    'oschwartz10612.Poppler',      # pdftotext (wissensbank protokolu)
    'UB-Mannheim.TesseractOCR',    # pytesseract
    'BurntSushi.ripgrep.MSVC',
    'jqlang.jq',
    'Microsoft.VisualStudioCode',
    'Microsoft.PowerShell',
    'Microsoft.WindowsTerminal',
    'Google.AntigravityIDE',       # Antigravity / Gemini (agy)
    'Anthropic.Claude',            # Claude masaustu uygulamasi
    'Google.GoogleDrive',          # I:\My Drive\Ops Praxura gitnogo
    'Google.Chrome',
    'TeamViewer.TeamViewer',       # Datenuebernahme oturumlari
    'RARLab.WinRAR'
)
if ($Android) { $paketler += 'EclipseAdoptium.Temurin.21.JDK', 'Google.AndroidStudio' }
if ($Ekstra)  { $paketler += 'OBSProject.OBSStudio', 'ByteDance.CapCut', 'Discord.Discord', 'Telegram.TelegramDesktop', 'Valve.Steam' }

$basarisiz = @()
foreach ($p in $paketler) {
    if (Bitti "winget:$p") { continue }
    Log ">>> winget $p"
    winget install -e --id $p --accept-source-agreements --accept-package-agreements --silent
    # 0 = kuruldu, -1978335189 = guncelleme yok, -1978335135 = zaten kurulu
    if ($LASTEXITCODE -in 0, -1978335189, -1978335135) { Isaretle "winget:$p" }
    else { $basarisiz += $p; Log "UYARI: $p kurulamadi (kod $LASTEXITCODE) - devam ediliyor, sonraki calistirmada tekrar denenir" }
}
if ($basarisiz) { Log ("Kurulamayanlar: " + ($basarisiz -join ', ')) }
if ((Test-Path 'C:\Program Files\Docker\Docker') -and -not (Bitti 'docker-reboot')) { Isaretle 'docker-reboot'; YenidenBaslatVeDevam }
PathTazele

# --- 3. Claude Code CLI (yerel kurucu -> ~\.local\bin\claude.exe) ---
Adim 'claude-code' {
    if (-not (Var 'claude')) { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression }
    PathTazele
}

# --- 4. npm / pip / playwright global araclari ---
Adim 'npm-global' { npm i -g @playwright/cli }
Adim 'pip' {
    py -3.13 -m pip install --upgrade pip
    py -3.13 -m pip install playwright pdfplumber pypdf pikepdf pdf2image pytesseract python-docx openpyxl reportlab `
        opencv-python-headless pillow_heif zxing-cpp jsonschema defusedxml piper-tts
    py -3.13 -m playwright install chromium
}

# --- 5. Git kimligi ---
Adim 'git-config' {
    git config --global user.name  'ironkemal5'
    git config --global user.email 'ironkemal5@gmail.com'
    git config --global core.autocrlf true
    git config --global init.defaultBranch main
    git config --global credential.helper manager
}

# --- 5b. Eski PC yedegini geri koy (eski-pc-paketle.ps1 ciktisi) ---
if ($Drive -or $Yedek) {
    Adim 'geri-yukle' {
        # a) Drive klasorunu bul - Drive'a giris yapilmamissa bekle
        if (-not $Yedek) {
            while ($true) {
                $Yedek = Get-PSDrive -PSProvider FileSystem | ForEach-Object { Join-Path $_.Root 'My Drive\pc transfer'; Join-Path $_.Root 'Meine Ablage\pc transfer' } |
                         Where-Object { Test-Path $_ } | Select-Object -First 1
                if ($Yedek) { break }
                Start-Process "$env:ProgramFiles\Google\Drive File Stream\launch.bat" -ErrorAction SilentlyContinue
                Read-Host "Google Drive'a giris yap ('My Drive\pc transfer' gorunene kadar), sonra Enter"
            }
        }
        if (-not (Test-Path $Yedek)) { throw "Yedek yeri yok: $Yedek" }

        # b) Sifreli RAR varsa ac
        $rar = Get-ChildItem $Yedek -Filter 'praxura-tasima*.rar' -ErrorAction SilentlyContinue | Sort-Object Name | Select-Object -First 1
        if ($rar) {
            $unrar = 'C:\Program Files\WinRAR\UnRAR.exe'
            if (-not (Test-Path $unrar)) { throw 'WinRAR yok (winget RARLab.WinRAR)' }
            $acik = Join-Path $env:TEMP 'praxura-geri'
            if (Test-Path $acik) { Remove-Item $acik -Recurse -Force }
            Log "Arsiv: $($rar.FullName) (Drive once indirir, buyukse surer)"
            $ss = Read-Host 'Arsiv sifresi' -AsSecureString
            $pw = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss))
            & $unrar x -o+ -idq "-p$pw" $rar.FullName "$acik\"
            $kod = $LASTEXITCODE; $pw = $null
            if ($kod -ne 0) { throw "Arsiv acilamadi (kod $kod) - sifre yanlis ya da Drive henuz tum parcalari indirmedi" }
            $Yedek = $acik
        }
        if (Test-Path "$Yedek\website") { robocopy "$Yedek\website" $RepoDir /E /R:1 /W:1 /NFL /NDL /NP /MT:16 | Out-Null }
        if (Test-Path "$Yedek\home")    { robocopy "$Yedek\home" $env:USERPROFILE /E /R:1 /W:1 /NFL /NDL /NP /MT:16 | Out-Null }
        if ((Test-Path "$Yedek\localappdata\agy") -and -not (Var 'agy')) {
            robocopy "$Yedek\localappdata\agy" "$env:LOCALAPPDATA\agy" /E /R:1 /W:1 /NFL /NDL /NP | Out-Null
            $up = [Environment]::GetEnvironmentVariable('Path','User')
            if ($up -notmatch 'agy\\bin') { [Environment]::SetEnvironmentVariable('Path', "$up;$env:LOCALAPPDATA\agy\bin", 'User') }
            PathTazele
        }
        if (Test-Path "$Yedek\wsl-Praxura.tar") {
            $wslDir = Join-Path $env:LOCALAPPDATA 'wsl\Praxura'
            New-Item -ItemType Directory -Force $wslDir | Out-Null
            wsl --import Praxura $wslDir "$Yedek\wsl-Praxura.tar"
        }
        # Windows kullanici ortam degiskenleri (N8N_API_KEY, SUPABASE_ACCESS_TOKEN ...)
        $uj = Join-Path $Yedek 'user-env.json'
        if (Test-Path $uj) {
            $uv = Get-Content $uj -Raw | ConvertFrom-Json
            foreach ($pr in $uv.PSObject.Properties) {
                [Environment]::SetEnvironmentVariable($pr.Name, $pr.Value, 'User')
                Log "ortam degiskeni kondu: $($pr.Name)"
            }
        }
        # .ssh izinleri: yalniz kullanicinin kendisi okusun (OpenSSH aksi halde anahtari reddeder)
        if (Test-Path "$env:USERPROFILE\.ssh") {
            Get-ChildItem "$env:USERPROFILE\.ssh" -File | Where-Object { $_.Extension -ne '.pub' -and $_.Name -notmatch 'known_hosts|config' } | ForEach-Object {
                icacls $_.FullName /inheritance:r /grant:r "${env:USERNAME}:F" | Out-Null
            }
        }
        # Acilmis gecici kopya sirlar iceriyor -> sil
        if ($Yedek -like "$env:TEMP*") { Remove-Item $Yedek -Recurse -Force -ErrorAction SilentlyContinue }
        $global:LASTEXITCODE = 0
    }
}

# --- 6. Depo ---
Adim 'repo' {
    if (-not (Test-Path (Join-Path $RepoDir '.git'))) {
        New-Item -ItemType Directory -Force (Split-Path $RepoDir) | Out-Null
        Log 'GitHub girisi tarayicida acilabilir (Git Credential Manager).'
        git clone $RepoUrl $RepoDir
        if ($LASTEXITCODE -ne 0) { throw 'git clone basarisiz' }
    }
    Push-Location $RepoDir
    git config core.hooksPath .githooks     # pre-commit kapilari
    npm install
    if ($LASTEXITCODE -ne 0) { npm install --cache "$env:TEMP\npm-cache-praxura" }
    npx playwright install chromium --only-shell
    if (Test-Path 'api-backend\package.json') { Push-Location api-backend; npm install; Pop-Location }
    Pop-Location
}

# --- 7. Kontrol listesi ---
PathTazele
Log '================ KONTROL ================'
foreach ($c in 'git','gh','node','npm','py','uv','bun','docker','wsl','ffmpeg','pdftotext','tesseract','rg','jq','code','claude','agy') {
    if (Var $c) { Write-Host ("  OK    {0}" -f $c) -ForegroundColor Green } else { Write-Host ("  EKSIK {0}" -f $c) -ForegroundColor Yellow }
}
Write-Host @"

ELLE YAPILACAKLAR (betik bunlari yapamaz):
  1. Docker Desktop'i bir kez ac, WSL2 motorunu onayla.
  2. Antigravity IDE'yi ac, Google hesabiyla gir. 'agy' EKSIK ise:
     eski PC'den  %LOCALAPPDATA%\agy  klasorunu kopyala ve  %LOCALAPPDATA%\agy\bin  PATH'e ekle.
  3. 'claude' calistir -> /login. Sonra:  gh auth login
  4. -Yedek ile calistirmadiysan: TASINACAKLAR.md'deki dosyalari eski PC'den kopyala.
     Claude eklentileri (plugins) kopyalanmadi -> claude icinde /plugin ile yeniden kur.
  5. Google Drive'da oturum ac -> I:\My Drive\Ops Praxura gitnogo gorunmeli.
  6. Depoda:  git status -sb   (eski PC'de commit edilmemis is varsa once onu getir).

Log: $LogFile
"@
Remove-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce' -Name 'PraxuraKurulum' -ErrorAction SilentlyContinue
