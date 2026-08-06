FROM node:22-slim

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
COPY client/package*.json ./client/
RUN npm install && npm --prefix client install

# Build the client and serve via the Express server.
COPY . .
RUN npm --prefix client run build

ENV PORT=3000
EXPOSE 3000
CMD ["npm", "start"]
