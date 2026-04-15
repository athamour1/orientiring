FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies and build
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

# Production runtime stage
FROM node:22-alpine

WORKDIR /app

# We only install production dependencies to keep the image lean
COPY package*.json ./
RUN npm install --omit=dev

# Copy the compiled output and Prisma generated client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
# Copy seed script 
COPY --from=builder /app/seed.ts ./seed.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Expose backend port
EXPOSE 3000

# Only start the app — migrations and seeding are separate deployment steps
CMD ["node", "dist/src/main"]
