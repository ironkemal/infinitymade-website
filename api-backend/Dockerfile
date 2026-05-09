FROM node:22-alpine
WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Then copy source
COPY server.js ./

ENV NODE_ENV=production
EXPOSE 3000

# Run as non-root for safety
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

CMD ["node", "server.js"]
