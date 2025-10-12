# node (node) service
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev || true
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]
