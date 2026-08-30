FROM node:22 AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM node:22-slim AS production

ENV NODE_ENV=production
ENV PORT=2567

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /usr/src/app/build ./build

EXPOSE 2567

USER node

CMD ["npm", "start"]