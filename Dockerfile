# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
RUN npm install

# Copy compiled files, source files, and test files (needed for ts-jest)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/tests ./tests
COPY --from=builder /app/jest.setup.ts ./jest.setup.ts
COPY --from=builder /app/seeds ./seeds
COPY --from=builder /app/config ./config

ENV NODE_ENV=production
ENV PORT=8080

# Seeding and starting the app
CMD ["sh", "-c", "npm run seed && npm start"]
