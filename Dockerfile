FROM node:20-slim

WORKDIR /app

COPY package.json ./package.json
COPY backend/package*.json ./backend/

RUN npm --prefix backend install --include=dev

COPY . .

RUN npm --prefix backend run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/dist/server.js"]
