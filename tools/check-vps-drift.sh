#!/bin/sh
# VPS drift kontrolü — 12.09.2026 (O-84)
#
# Neden: SaaS VPS'in /opt/calendar-api/docker-compose.yml'i git'in hiç görmediği bir
# yoldan (SSH + elle duzenleme) repo'dan bağımsız değişebiliyor. O-84'te tam bu oldu:
# VPS'te aylardır duran bir `command:` override ve bir `mem_limit: 700m` repo'ya hiç
# yansımamıştı — üstelik o override, O-83'ün Dockerfile'a eklediği iki guardrail
# bayrağını (imaj güncellenmiş olsa bile) sessizce eziyordu. Watchtower yalnız imajı
# çeker, compose dosyasını asla — bu yüzden repo'daki düzeltme kutuya kendiliğinden
# gitmez (aynı dosyanın kendi 15.08.2026/08.11.2026 dersleri).
#
# Ne yapar: repo'daki api-backend/docker-compose.yml'in `calendar-api:` servis bloğunu
# VPS'teki gerçek dosyanın aynı bloğuyla karşılaştırır. Fark varsa gösterir, exit 1.
#
# Bu bir pre-commit kapısı DEĞİL — SSH/ağ erişimi gerektirir, commit'i yavaşlatmamalı.
# Elle, VPS'e dokunmadan ÖNCE ve dokunduktan SONRA çalıştırılır:
#   sh tools/check-vps-drift.sh
#
# Gereksinim: INFRASTRUCTURE.md §2'deki SSH erişimi (ssh root@n8n.infinitymade.de).

set -e

repo_root=$(git rev-parse --show-toplevel)
repo_file="$repo_root/api-backend/docker-compose.yml"
vps_host="root@n8n.infinitymade.de"
vps_path="/opt/calendar-api/docker-compose.yml"

# `calendar-api:` bloğunu bir sonraki ayni-girintili anahtara kadar keser (2 bosluk
# girintili servis adi — `watchtower:` vb.), sonra tam-satir yorumlari ve bos
# satirlari atar. Yorumlar iki tarafta hep farkli metin tasir (ayri ayri yazilir,
# kelimesi kelimesine eslesmesi beklenmez) — gurultu, gercek sinyal degil. Yalniz
# GERCEK config satirlari (image, command, mem_limit, label degerleri vb.) kalir.
extract_block() {
  awk '
    /^  calendar-api:/ { found=1; print; next }
    found && /^  [a-zA-Z]/ { exit }
    found { print }
  ' "$1" | grep -vE '^\s*#' | grep -vE '^\s*$'
}

if [ ! -f "$repo_file" ]; then
  echo "HATA: $repo_file yok." >&2
  exit 2
fi

repo_block=$(extract_block "$repo_file")

vps_content=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$vps_host" "cat $vps_path" 2>&1) || {
  echo "HATA: VPS'e bağlanılamadı veya dosya okunamadı:" >&2
  echo "$vps_content" >&2
  exit 2
}

vps_block=$(printf '%s\n' "$vps_content" | awk '
  /^  calendar-api:/ { found=1; print; next }
  found && /^  [a-zA-Z]/ { exit }
  found { print }
' | grep -vE '^\s*#' | grep -vE '^\s*$')

if [ "$repo_block" = "$vps_block" ]; then
  echo "OK — repo ve VPS'in calendar-api bloğu birebir aynı."
  exit 0
fi

echo "FARK VAR — repo (api-backend/docker-compose.yml) ile VPS'in gerçek dosyası" >&2
echo "(/opt/calendar-api/docker-compose.yml) arasında calendar-api bloğu uyuşmuyor:" >&2
echo "" >&2
diff <(printf '%s\n' "$repo_block") <(printf '%s\n' "$vps_block") >&2 || true
echo "" >&2
echo "Bu VPS'e elle yapılmış (git'e hiç girmemiş) bir değişiklik anlamına gelebilir," >&2
echo "ya da repo'da yapılan bir düzeltmenin VPS'e henüz uygulanmadığı anlamına gelebilir." >&2
echo "Hangisi olduğunu INFRASTRUCTURE.md §3'teki adımlarla elle karar ver — bu script" >&2
echo "yalnız farkı gösterir, hangi tarafın doğru olduğuna karar vermez." >&2
exit 1
