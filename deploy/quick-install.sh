#!/bin/bash
# Scoliologic Wiki - Quick Installation Script
# Для установки на сервер 10.0.0.221 с существующими MinIO, Traefik, Ollama

set -e

echo "=========================================="
echo "  Scoliologic Wiki - Quick Install"
echo "=========================================="
echo ""

INSTALL_DIR="/opt/scoliologic-wiki"

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен!"
    echo "Установите: curl -fsSL https://get.docker.com | sh"
    exit 1
fi
echo "✅ Docker: $(docker --version)"

# Создание директории
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Создание .env
echo ""
echo "📦 Создание конфигурации..."
cat > .env << 'EOF'
# База данных MySQL
MYSQL_ROOT_PASSWORD=Xk9mPqL2vNwR7tYs
MYSQL_DATABASE=scoliologic_wiki
MYSQL_USER=wiki
MYSQL_PASSWORD=Bz4hJcF8dKmQ3wEr

# MinIO (S3) - 10.0.0.237
S3_ENDPOINT=http://10.0.0.237:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=MqukJCzUet5SB
S3_BUCKET=scoliologic-wiki
S3_REGION=us-east-1
S3_PUBLIC_URL=http://10.0.0.237:9000

# Traefik - 10.0.0.236
TRAEFIK_API_URL=http://10.0.0.236:8080

# Ollama - 10.0.0.229
OLLAMA_BASE_URL=http://10.0.0.229:11434
EMBEDDING_MODEL=nomic-embed-text:latest
LLM_MODEL=llama3.1:70b

# JWT & Security
JWT_SECRET=aR7xKp2mNqLwYtVs9bCdEfGhJkMnPrStUvWxYz1234

# Application
VITE_APP_TITLE=Scoliologic Wiki
DISABLE_AUTH=true
EOF
echo "✅ .env создан"

# Создание docker-compose.yml
echo ""
echo "📦 Создание docker-compose.yml..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: wiki-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: ${MYSQL_DATABASE}
      MYSQL_USER: ${MYSQL_USER}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: --default-authentication-plugin=mysql_native_password

  app:
    image: node:20-alpine
    container_name: wiki-app
    restart: unless-stopped
    working_dir: /app
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@mysql:3306/${MYSQL_DATABASE}
      JWT_SECRET: ${JWT_SECRET}
      S3_ENDPOINT: ${S3_ENDPOINT}
      S3_ACCESS_KEY: ${S3_ACCESS_KEY}
      S3_SECRET_KEY: ${S3_SECRET_KEY}
      S3_BUCKET: ${S3_BUCKET}
      S3_REGION: ${S3_REGION}
      S3_PUBLIC_URL: ${S3_PUBLIC_URL}
      TRAEFIK_API_URL: ${TRAEFIK_API_URL}
      OLLAMA_BASE_URL: ${OLLAMA_BASE_URL}
      EMBEDDING_MODEL: ${EMBEDDING_MODEL}
      LLM_MODEL: ${LLM_MODEL}
      VITE_APP_TITLE: ${VITE_APP_TITLE}
      DISABLE_AUTH: ${DISABLE_AUTH}
    volumes:
      - ./app:/app
    depends_on:
      mysql:
        condition: service_healthy
    command: sh -c "npm install && npm run build && npm start"

volumes:
  mysql_data:
EOF
echo "✅ docker-compose.yml создан"

echo ""
echo "=========================================="
echo "  Конфигурация готова!"
echo "=========================================="
echo ""
echo "Следующие шаги:"
echo ""
echo "1. Создайте bucket в MinIO (на 10.0.0.237):"
echo "   mc alias set myminio http://localhost:9000 minioadmin MqukJCzUet5SB"
echo "   mc mb myminio/scoliologic-wiki --ignore-existing"
echo "   mc anonymous set download myminio/scoliologic-wiki"
echo ""
echo "2. Создайте конфиг Traefik (на 10.0.0.236):"
echo "   nano /etc/traefik/dynamic/wiki.yaml"
echo "   (содержимое см. в traefik-wiki.yaml)"
echo ""
echo "3. Клонируйте репозиторий:"
echo "   git clone <repo_url> app"
echo ""
echo "4. Запустите:"
echo "   docker compose up -d"
echo ""
