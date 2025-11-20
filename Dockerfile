FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js", "-h", "0.0.0.0", "-p", "3000", "-c", "./cache"]