# Production Dockerfile for DocuMind AI Backend Gateway
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies if needed for build steps)
RUN npm ci

# Copy source code
COPY . .

# Prune devDependencies for a smaller production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files from builder
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/src ./src

EXPOSE 5000

CMD ["node", "server.js"]
