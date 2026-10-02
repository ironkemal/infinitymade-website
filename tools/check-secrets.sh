#!/bin/sh
# Secret-Scan-Tor vor dem Commit (Praxura, guvenlik S-05/S-16, KHS K1.7)
#
# Neden / Warum:
# Bu depo PUBLIC (GitHub üzerinde herkese açık).
# S-08 olayı (05.08.2026): herkese açık repoya sızan bir API token'ı veya
# şifre saniyeler içinde arama motorları ve botlar tarafından kopyalanır.
# Token'ı sonradan silmek veya commit'i geri almak yetmez — git geçmişinde kalır
# ve anında suistimal edilir.
#
# Was dieses Tor tut / Ne yapar:
# Staged değişiklikleri (index) bilinen gizli anahtar kalıplarına karşı tarar:
# JWT, Stripe API & Webhook, GitHub Token, AWS Access Key, Google API Key,
# Slack Token, OpenAI / Anthropic Key, Private Keys, parola / token atamaları
# ve kimlik bilgisi içeren bağlantı URL'leri.
#
# Wie umgehen / Nasıl atlanır (Ausnahmen):
# 1. Satır içi istisna: İlgili satırın sonuna şu işareti ekleyin:
#      // secret-scan: ignore
# 2. Hash ile izin verme: tools/.secret-allowlist dosyasına eşleşmenin SHA-256
#    özetini ekleyin (Klartext NIE hier eintragen! Sadece sha256 hash'i):
#      printf '%s' "DEGER" | sha256sum | awk '{print $1}' >> tools/.secret-allowlist
# 3. Acil durum / bilinçli atlama:
#      SKIP_SECRET_GATE=1 git commit ...

set -e

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

if [ "$SKIP_SECRET_GATE" = "1" ]; then
  echo "WARNUNG / UYARI: SKIP_SECRET_GATE=1 gesetzt — Secret-Scan-Tor wird übersprungen." >&2
  exit 0
fi

node tools/check-secrets.mjs --staged
