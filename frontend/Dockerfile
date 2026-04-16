FROM node:22-alpine AS builder

WORKDIR /app

# Copy all source first (quasar prepare needs project context)
COPY . .

# Install dependencies (postinstall runs quasar prepare which needs the project files)
RUN npm install

# Build with a placeholder that gets replaced at runtime
ENV VITE_API_URL=__RUNTIME_API_URL__
RUN npx quasar build -m pwa

# Production runtime stage using NGINX
FROM nginx:alpine

# Quasar PWA output folder
COPY --from=builder /app/dist/pwa /usr/share/nginx/html

# SPA fallback nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint script for runtime env var injection
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose the default NGINX port
EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
