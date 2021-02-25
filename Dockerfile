FROM node:stretch-slim
WORKDIR /usr/src/siprec

# ENV NODE_ENV=production
# VOLUME [ "/usr/src/siprec/config" ]

COPY package*.json ./
COPY lib ./lib
COPY app.js ./

RUN npm install


CMD ["npm", "start"]
