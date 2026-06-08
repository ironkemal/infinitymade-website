FROM node:22-alpine
WORKDIR /app

# Install deps first for better layer caching.
# Using npm install (not ci) so a slightly out-of-sync lockfile doesn't break the build.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Then copy source
COPY server.js ./
COPY instrument.js ./
COPY _lib ./_lib
COPY ai ./ai
COPY billing ./billing

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

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
