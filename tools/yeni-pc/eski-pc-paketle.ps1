# ESKI PC'de calistir: tasinmasi gereken her seyi tek klasore toplar.
#   & "<yol>\eski-pc-paketle.ps1" -Hedef "E:\praxura-tasima"
#
# DIKKAT: Hedef USB disk / harici disk olmali. Google Drive DEGIL:
#    icinde sirlar var (.env, SSH anahtari, Azure, Supabase, Stripe).
#    CLAUDE.md: "Sirlar Drive'a da girmez."
param([Parameter(Mandatory)][string]$Hedef)

$H   = $env:USERPROFILE
$Web = Join-Path $H 'Desktop\claude\website'

# 0. Depo durumu - commit edilmemis is kaybolmasin diye uyari
Write-Host '--- Depo durumu ---' -ForegroundColor Cyan
git -C $Web fetch --quiet
git -C $Web status -sb | Select-Object -First 15
Write-Host "(Depo klasoru BUTUNUYLE kopyalaniyor, commit edilmemis is de gider. Yine de once commit+push en temizi.)`n" -ForegroundColor Yellow

function Kopyala($kaynak, $hedef, [string[]]$haric = @()) {
    if (-not (Test-Path $kaynak)) { Write-Host "  yok, atlandi: $kaynak" -ForegroundColor DarkGray; return }
    $xd = @('/XD') + $haric
    if ($haric.Count -eq 0) { $xd = @() }
    robocopy $kaynak $hedef /E /R:1 /W:1 /NFL /NDL /NP /MT:16 @xd | Out-Null
    Write-Host "  OK  $kaynak" -ForegroundColor Green
}

# 1. Depo (gitignore'lu sirlar + PDF'ler + guvenlik/ mentor/ Meetings/ dahil), node_modules haric
Kopyala $Web (Join-Path $Hedef 'website') @('node_modules')

# 2. Ev klasoru
$ev = Join-Path $Hedef 'home'
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
# agy CLI (Antigravity IDE kurulunca gelmezse buradan geri konur)
Kopyala "$env:LOCALAPPDATA\agy" (Join-Path $Hedef 'localappdata\agy')

# 3. WSL 'Praxura' kutusu (lokal on-prem test ortami) - buyuk olabilir, istege bagli
$cevap = Read-Host "WSL 'Praxura' dagitimini da disa aktarayim mi? (e/h)"
if ($cevap -eq 'e') {
    wsl --shutdown
    wsl --export Praxura (Join-Path $Hedef 'wsl-Praxura.tar')
    Write-Host '  OK  wsl-Praxura.tar' -ForegroundColor Green
}

Write-Host "`nBitti -> $Hedef" -ForegroundColor Cyan
Write-Host "Yeni PC'de:  kurulum.ps1 -Yedek `"$Hedef`"" -ForegroundColor Cyan
