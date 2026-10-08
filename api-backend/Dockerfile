FROM node:22-alpine
WORKDIR /app

# Install deps first for better layer caching.
# Using npm install (not ci) so a slightly out-of-sync lockfile doesn't break the build.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Then copy source.
# ACHTUNG: Diese Liste ist vollstaendig aufzufuehren — es gibt kein "COPY . .".
# Ein neues Quellverzeichnis, das hier fehlt, fehlt auch im Image: server.js
# startet dann nicht (ERR_MODULE_NOT_FOUND), PM2 startet endlos neu und Traefik
# antwortet mit 502. Genau so ist booking/ am 11.08.2026 in die Produktion
# gegangen. Beim Anlegen eines neuen Verzeichnisses in api-backend/ hier eine
# Zeile ergaenzen.
COPY server.js ./
COPY instrument.js ./
COPY start.mjs ./
COPY _lib ./_lib
COPY ai ./ai
COPY billing ./billing
COPY booking ./booking
COPY lib ./lib
COPY setup ./setup
COPY routes ./routes
# Kutu-Kimlik + Merkez-Client (K2b.17): kayit.js und die signierten Anfragen laufen im api-Image.
COPY merkez-istemci ./merkez-istemci
COPY dsgvo ./dsgvo
# db/ = Migrations-Runner + die SQL-Kette. Fehlt sie hier, startet server.js zwar,
# aber das Schema der Kundenbox bleibt stehen — und zwar lautlos.
COPY db ./db

# onprem-bundle: die on-prem Kundenbox aktualisiert ihr eigenes compose/env
# NUR über das, was in DIESEM Image mitkommt (O-45 (b), onprem/REGISTER.md §7J).
# Zusätzlicher Build-Kontext "onprem" (siehe .github/workflows/publish-calendar-api.yml
# build-contexts: onprem=../onprem) — der primäre Kontext bleibt ./api-backend,
# nichts an den obigen COPY-Zeilen ändert sich. Einzeln aufgeführt wie oben:
# KEIN Verzeichnis-COPY von volumes/ (onprem/volumes/db/data wäre sonst die
# LIVE-Postgres-Datenverzeichnis — s. onprem/REGISTER.md §7J J2).
COPY --from=onprem docker-compose.yml .env.template install.sh update.sh lib-health.sh lib-ip.sh lib-setup-jeton.sh ip-melden.sh backup.sh restore.sh reset-owner-passwort.sh manifest.json ./onprem-bundle/
COPY --from=onprem volumes/api/kong.yml volumes/api/kong-entrypoint.sh ./onprem-bundle/volumes/api/
COPY --from=onprem volumes/db/_supabase.sql volumes/db/jwt.sql volumes/db/no-pg-net.sql volumes/db/realtime.sql volumes/db/roles.sql volumes/db/webhooks.sql volumes/db/praxura-rollen.sql ./onprem-bundle/volumes/db/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Lebendigkeits-Prüfung. Ohne sie meldet Docker einen dauerhaft neustartenden
# Container als "up" — genau so lief der PM2-Restart-Loop vom 11.08.2026
# unbemerkt weiter. Fragt /health (nicht /health/ready): ein DB-Ausfall soll
# einen gesunden Prozess NICHT als krank markieren.
#
# node statt curl/wget: curl ist in node:22-alpine nicht enthalten, und auf
# busybox-wget wollen wir uns nicht verlassen. node ist ohnehin da.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Run as non-root for safety
# Verzeichnisse für Box-Identität und acme-dns anlegen, damit frische benannte
# Volumes die Rechte für Benutzer app erben (O-161, K2b.5 — verhindert EACCES in kayit.js).
# Caddy läuft als root und liest acmedns.json problemlos; Dateirechte in kayit.js
# bleiben 0600 für Benutzer app (O-161, onprem-Bedingung 10).
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app \
  && mkdir -p /var/lib/praxura/kimlik /var/lib/praxura/acmedns \
  && chown -R app:app /var/lib/praxura \
  && chmod 700 /var/lib/praxura/kimlik /var/lib/praxura/acmedns
# PM2_HOME bleibt nur für Phase 1 von O-179: der SaaS-VPS überschreibt CMD noch
# per compose-"command:" mit pm2-runtime (api-backend/docker-compose.yml). Fällt mit pm2.
ENV PM2_HOME=/tmp/.pm2
USER app

# O-179 (08.10.2026): start.mjs statt pm2-runtime — pm2 (AGPL-3.0) ruft täglich
# version.pm2.io auf, nicht abschaltbar (G1). start.mjs übernimmt 1:1:
#   · 2 Worker (node:cluster), NODE_APP_INSTANCE 0/1 (server.js 23:55-Tor, ip-abgleich)
#   · --import ./instrument.js je Worker (Sentry vor Express, ESM)
#   · O-83 drei Schichten gegen unbegrenztes Wachstum:
#       1. --max-old-space-size=256  V8-Heap pro Worker
#       2. RSS > 500 MB je Worker (/proc) → nur dieser Worker startet neu
#          (gemessen 13.09.2026: 2 gleichzeitige ~15MB-Rezepte ≈ 295 MB RSS)
#       3. mem_limit im docker-compose.yml — letzte Instanz
#   · SIGTERM an die Worker, Absturz → Neustart mit wachsender Pause.
# Gemessen 08.10.2026 im echten Image (Stub-server.js): 2 Worker verteilt, docker stop
# 0,4 s, Absturz-Backoff 2/4/8 s, 660-MB-Worker nach ≤ 30 s neu, der andere blieb.
# "node" liegt im Image auf dem PATH (anders als node_modules/.bin, Docker-CMD-Lehre).
CMD ["node", "start.mjs"]
