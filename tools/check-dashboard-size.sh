#!/bin/sh
# dashboard.js büyüme kapısı — Konsey 2026-08-13
#
# Neden: dashboard.js 26.857 satıra ulaştı. Karar "yeni kod yeni dosyaya" (CLAUDE.md
# → Kurallar → Frontend). Kural tek başına tutmaz, bu yüzden kapı var: dosya
# büyürse commit reddedilir.
#
# Taban değeri düşürmek serbest ve teşvik edilir (kod ayrı modüle taşındıkça).
# Yükseltmek bilinçli bir karardır — tabanı elle değiştirmeden commit geçmez.
#
# Devre dışı bırakmak (istisna): SKIP_SIZE_GATE=1 git commit ...

set -e

repo_root=$(git rev-parse --show-toplevel)
target="dashboard.js"
baseline_file="$repo_root/tools/.dashboard-baseline"

[ "$SKIP_SIZE_GATE" = "1" ] && exit 0
[ -f "$baseline_file" ] || exit 0

baseline=$(tr -d ' \n\r' < "$baseline_file")

# Sadece dashboard.js commit'e giriyorsa bak.
git diff --cached --name-only | grep -qx "$target" || exit 0

# Çalışma kopyası değil, COMMIT EDİLECEK içerik sayılır.
current=$(git show ":$target" | wc -l | tr -d ' ')

if [ "$current" -gt "$baseline" ]; then
  cat >&2 <<EOF

  ✗ COMMIT REDDEDİLDİ — dashboard.js büyüyor

    taban : $baseline satır
    şimdi : $current satır  (+$((current - baseline)))

  Karar (Konsey 2026-08-13): yeni kod dashboard.js'e yazılmaz.
  Yeni modül  ->  module/<alan>.js açıp dashboard.js'e tek import satırı ekle.
  Örnekler    ->  dashboard.js:1-8 (katalog-suche, patient-suche, calendar-widget...)

  Ayrıntı: CLAUDE.md > Kurallar > Frontend
           konsey/tutanak/2026-08-13-frontend-mimari-katman.md

  Bilinçli istisna gerekiyorsa:  SKIP_SIZE_GATE=1 git commit ...
  (ve tools/.dashboard-baseline elle güncellenir — gerekçesiyle)

EOF
  exit 1
fi

# Küçüldüyse tabanı otomatik sıkıştır — kazanım geri alınamasın.
if [ "$current" -lt "$baseline" ]; then
  printf '%s\n' "$current" > "$baseline_file"
  git add "$baseline_file"
  echo "  ✓ dashboard.js küçüldü: $baseline -> $current satır. Taban sıkıştırıldı." >&2
fi

exit 0
