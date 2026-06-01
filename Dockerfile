# Base image containing Node.js
FROM node:20-alpine

# Setup app directory
WORKDIR /usr/src/app

# Copy package configurations
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Run Prisma Client generator
RUN npx prisma generate

# Compile Tailwind CSS stylesheet
RUN npm run build:css

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose server port
EXPOSE 3000

CMD npx prisma migrate deploy && npm start
