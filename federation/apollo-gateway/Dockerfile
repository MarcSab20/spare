FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package.json ./

RUN npm install --only=production && npm cache clean --force

COPY src/ ./src/

EXPOSE 4000 4001

ENV NODE_ENV=development
ENV PORT=4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "src/index.js"]