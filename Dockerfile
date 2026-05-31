FROM node:22

ENV PORT 2567

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 2567

CMD ["npm", "start"]