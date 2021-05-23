FROM node:14

RUN mkdir -p /usr/src/app/
WORKDIR /usr/src/app/

COPY package-lock.json ./
COPY . .

# тут указать путь до БД и запустить команду volume create web
COPY . /usr/src/app/
RUN npm install
EXPOSE 15000
EXPOSE 3000


CMD ["node", "app.js"]