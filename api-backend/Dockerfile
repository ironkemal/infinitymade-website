FROM node:22-alpine
WORKDIR /app

# Install deps first for better layer caching.
# Using npm install (not ci) so a slightly out-of-sync lockfile doesn't break the build.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Then copy source
COPY server.js ./
COPY ai ./ai
COPY billing ./billing

ENV NODE_ENV=production
EXPOSE 3000

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

CMD ["node", "server.js"]
