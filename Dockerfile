# Use lightweight Node
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install only production deps
RUN npm install --production

# Copy the rest of the backend code
COPY . .

# Expose backend port (change if not using 5000)
EXPOSE 4000

# Start your server
CMD ["node", "server.js"]
