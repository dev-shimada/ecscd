# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files
COPY ecscd/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY ecscd/ .

# Build the application
RUN npm run build

# Production stage
FROM gcr.io/distroless/nodejs24-debian12:latest

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/.next/static ./.next/static
COPY --from=builder --chown=nonroot:nonroot /app/public ./public

USER nonroot

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production
ENV SQLITE_DB_PATH=/tmp/ecscd.db

CMD ["server.js"]
