# Stage 1: Build TypeScript server modules
FROM node:20-alpine AS node-builder

WORKDIR /backend

RUN apk add --no-cache git
COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# Stage 2: Final Nakama image
FROM registry.heroiclabs.com/heroiclabs/nakama:3.22.0

COPY --from=node-builder /backend/build/*.js /nakama/data/modules/build/
COPY local.yml /nakama/data/local.yml
