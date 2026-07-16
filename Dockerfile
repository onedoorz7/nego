# nego — production image for Railway / Render / Fly.io / any Docker host.
# Needs Node ≥ 22.5 (node:sqlite). Data lives in /data — mount a volume there.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEGO_DATA_DIR=/data
COPY --from=builder /app ./
RUN mkdir -p /data
EXPOSE 3000
# Next.js binds PORT if set (Railway/Render inject it).
CMD ["npm", "start"]
