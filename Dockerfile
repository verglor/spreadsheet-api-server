FROM node:8-alpine

WORKDIR /opt/server

COPY *.json *.js ./

RUN npm install

ENV NODE_ENV=production

ENTRYPOINT ["node", "spreadsheet-api-server.js"]

VOLUME /opt/server/data

EXPOSE 8888
