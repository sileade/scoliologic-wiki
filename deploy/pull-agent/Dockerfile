# Pull Agent for GitOps-lite deployment
# Автоматически проверяет GitHub репозиторий и обновляет приложение

FROM node:22-alpine

# Install required tools
RUN apk add --no-cache \
    git \
    curl \
    docker-cli \
    docker-cli-compose \
    bash \
    jq \
    openssh-client \
    tzdata

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create directories for data and backups
RUN mkdir -p /app/data /app/backups /app/logs

# Set permissions
RUN chmod +x /app/entrypoint.sh

# Health check endpoint port
EXPOSE 8080

# Environment variables with defaults
ENV NODE_ENV=production \
    PULL_INTERVAL=300 \
    GIT_BRANCH=main \
    KEEP_BACKUPS=5 \
    ROLLBACK_ON_FAILURE=true \
    LOG_LEVEL=info

# Run the pull agent
ENTRYPOINT ["/app/entrypoint.sh"]
