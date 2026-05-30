FROM node:20-alpine3.18

RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    curl

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "bot.js"]
