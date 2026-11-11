# ESKI PC'de calistir: tasinacak her seyi toplar, TEK SIFRELI RAR yapar,
# Google Drive'daki "pc transfer" klasorune koyar.
#
#   Set-ExecutionPolicy -Scope Process Bypass -Force
#   & "$env:USERPROFILE\Desktop\claude\website\tools\yeni-pc\eski-pc-paketle.ps1"
#
# Sifreleme: RAR5 AES-256, dosya adlari da sifreli (-hp). Sifreyi bilmeyen
# icinde ne oldugunu bile goremez. Sifre HICBIR YERE kaydedilmez -> parola kasasina yaz.
param(
    [string]$Hedef,                                   # bos = "My Drive\pc transfer" otomatik bulunur
    [string]$Ara = (Join-Path $env:TEMP 'praxura-tasima')
)

$H   = $env:USERPROFILE
$Web = Join-Path $H 'Desktop\claude\website'
$Rar = 'C:\Program Files\WinRAR\Rar.exe'
if (-not (Test-Path $Rar)) { Write-Host 'WinRAR yok: winget install -e --id RARLab.WinRAR' -ForegroundColor Red; exit 1 }

if (-not $Hedef) {
    $Hedef = Get-PSDrive -PSProvider FileSystem | ForEach-Object { Join-Path $_.Root 'My Drive\pc transfer' } |
             Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $Hedef) { Write-Host "Drive'da 'My Drive\pc transfer' bulunamadi. -Hedef ile ver." -ForegroundColor Red; exit 1 }
}
Write-Host "Hedef: $Hedef" -ForegroundColor Cyan

# 0. Depo durumu
Write-Host '--- Depo durumu ---' -ForegroundColor Cyan
git -C $Web status -sb | Select-Object -First 10
Write-Host "(Depo klasoru butunuyle gider, commit edilmemis is dahil.)`n" -ForegroundColor Yellow

# Sifre (iki kez)
$s1 = Read-Host 'Arsiv sifresi (en az 12 karakter)' -AsSecureString
$s2 = Read-Host 'Sifre tekrar' -AsSecureString
$p1 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s1))
$p2 = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s2))
if ($p1 -ne $p2 -or $p1.Length -lt 12) { Write-Host 'Sifreler uyusmuyor ya da kisa.' -ForegroundColor Red; exit 1 }

if (Test-Path $Ara) { Remove-Item $Ara -Recurse -Force }
New-Item -ItemType Directory -Force $Ara | Out-Null

function Kopyala($kaynak, $hedef, [string[]]$haric = @()) {
    if (-not (Test-Path $kaynak)) { Write-Host "  yok, atlandi: $kaynak" -ForegroundColor DarkGray; return }
    $xd = @(); if ($haric.Count) { $xd = @('/XD') + $haric }
    robocopy $kaynak $hedef /E /R:1 /W:1 /NFL /NDL /NP /MT:16 @xd | Out-Null
    Write-Host "  OK  $kaynak" -ForegroundColor Green
}

# 1. Depo, node_modules haric
Kopyala $Web (Join-Path $Ara 'website') @('node_modules')

# 2. Ev klasoru
$ev = Join-Path $Ara 'home'
Kopyala "$H\.claude"           "$ev\.claude"           @("$H\.claude\plugins\cache", "$H\.claude\plugins\marketplaces", "$H\.claude\downloads", "$H\.claude\shell-snapshots")
Kopyala "$H\.claude-mem"       "$ev\.claude-mem"
Kopyala "$H\.gemini"           "$ev\.gemini"           @("$H\.gemini\bin", "$H\.gemini\logs")
Kopyala "$H\.antigravitycli"   "$ev\.antigravitycli"
Kopyala "$H\.antigravity-ide"  "$ev\.antigravity-ide"
Kopyala "$H\.ssh"              "$ev\.ssh"
Kopyala "$H\.n8n-mcp"          "$ev\.n8n-mcp"
Kopyala "$H\.mcp-auth"         "$ev\.mcp-auth"
Kopyala "$H\.azure"            "$ev\.azure"
Kopyala "$H\.docker"           "$ev\.docker"
foreach ($f in '.claude.json', '.wslconfig', '.gitconfig') {
    if (Test-Path "$H\$f") { Copy-Item "$H\$f" "$ev\$f" -Force; Write-Host "  OK  $H\$f" -ForegroundColor Green }
}
Kopyala "$env:LOCALAPPDATA\agy" (Join-Path $Ara 'localappdata\agy')

# Windows kullanici ortam degiskenleri (N8N_API_KEY, SUPABASE_ACCESS_TOKEN ...) - dosya degil, registry'de
$std = 'Path','TEMP','TMP','OneDrive','OneDriveConsumer','PSModulePath','ChocolateyLastPathUpdate'
$uenv = [ordered]@{}
$ue = [Environment]::GetEnvironmentVariables('User')
foreach ($k in $ue.Keys) { if ($k -notin $std) { $uenv[$k] = $ue[$k] } }
$uenv | ConvertTo-Json | Set-Content (Join-Path $Ara 'user-env.json') -Encoding utf8
Write-Host ("  OK  Windows ortam degiskenleri: " + (($uenv.Keys) -join ', ')) -ForegroundColor Green

# 3. WSL 'Praxura' kutusu (istege bagli, buyuk)
if ((Read-Host "WSL 'Praxura' test kutusunu da ekleyeyim mi? (e/h)") -eq 'e') {
    wsl --shutdown
    wsl --export Praxura (Join-Path $Ara 'wsl-Praxura.tar')
    Write-Host '  OK  wsl-Praxura.tar' -ForegroundColor Green
}

# 4. Sifreli RAR, 2 GB'lik parcalar (Drive yuklemesi kopsa da parca parca devam eder)
Write-Host "`nSifreli arsiv olusturuluyor (birkac dakika surer)..." -ForegroundColor Cyan
Get-ChildItem $Hedef -Filter 'praxura-tasima*.rar' -ErrorAction SilentlyContinue | Remove-Item -Force
& $Rar a -r -ep1 -m3 -ma5 -v2g -idq "-hp$p1" (Join-Path $Hedef 'praxura-tasima.rar') "$Ara\*"
$kod = $LASTEXITCODE
$p1 = $p2 = $null
if ($kod -ne 0) { Write-Host "RAR hatasi (kod $kod). Ara klasor duruyor: $Ara" -ForegroundColor Red; exit 1 }

# Uzun yollar (>260) Remove-Item'i kirar -> once bos klasorle aynala
$bos = Join-Path $env:TEMP 'praxura-bos'; New-Item -ItemType Directory -Force $bos | Out-Null
robocopy $bos $Ara /MIR /R:0 /W:0 /NFL /NDL /NJH /NJS | Out-Null
Remove-Item $Ara, $bos -Recurse -Force -ErrorAction SilentlyContinue
Get-ChildItem $Hedef -Filter 'praxura-tasima*.rar' | ForEach-Object { "  {0}  {1:N0} MB" -f $_.Name, ($_.Length/1MB) }
Write-Host @"

Bitti. Google Drive simdi yukluyor - sistem tepsisindeki Drive simgesinde
yukleme BITENE kadar bu PC'yi kapatma.

Yeni PC'de (Yonetici PowerShell):
  1. Bu klasorden kurulum.ps1'i indir (Drive > pc transfer), ya da GitHub'dan:
     depo > tools/yeni-pc/kurulum.ps1
  2. Set-ExecutionPolicy -Scope Process Bypass -Force
     & .\kurulum.ps1 -Drive
"@ -ForegroundColor Cyan
Copy-Item (Join-Path $PSScriptRoot 'kurulum.ps1') $Hedef -Force
