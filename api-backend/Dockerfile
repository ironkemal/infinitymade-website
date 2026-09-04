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
COPY _lib ./_lib
COPY ai ./ai
COPY billing ./billing
COPY booking ./booking
COPY lib ./lib
# db/ = Migrations-Runner + die SQL-Kette. Fehlt sie hier, startet server.js zwar,
# aber das Schema der Kundenbox bleibt stehen — und zwar lautlos.
COPY db ./db

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
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
ENV PM2_HOME=/tmp/.pm2
USER app

# ESM mode: Sentry must be loaded via --import to instrument Express BEFORE
# the app code runs. See https://docs.sentry.io/platforms/javascript/guides/express/install/esm/
#
# Explicit path to the pm2-runtime bin: node_modules/.bin is NOT on the image
# PATH, so a bare "pm2-runtime" CMD fails with MODULE_NOT_FOUND (verified in a
# real container). --node-args forwards --import to each forked cluster worker
# so Sentry instruments every worker, not just the PM2 master.
CMD ["./node_modules/.bin/pm2-runtime", "start", "server.js", "-i", "2", "--node-args", "--import ./instrument.js"]
