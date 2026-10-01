FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm --prefix backend install --legacy-peer-deps

COPY . .

RUN npm --prefix backend run build

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "backend/dist/server.js"]
