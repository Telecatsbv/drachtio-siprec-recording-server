FROM node:buster-slim
WORKDIR /usr/src/siprec

RUN apt-get update && apt-get install -y procps tcpdump
# ENV NODE_ENV=production
# VOLUME [ "/usr/src/siprec/config" ]

COPY package*.json ./
COPY lib ./lib
COPY app.js ./
COPY ddi_redis.js ./
COPY README.md ./

RUN npm install


ENTRYPOINT ["npm", "start"]
