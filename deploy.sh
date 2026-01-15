#!/bin/bash
# Scoliologic Wiki - Production Deployment Script
# Использование: ./deploy.sh [domain]

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Scoliologic Wiki - Production Deploy             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен. Установите Docker и повторите.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose не установлен.${NC}"
    exit 1
fi

# Определение команды docker-compose
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

# Проверка .env файла
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Файл .env не найден. Создаю из примера...${NC}"
    if [ -f .env.production.example ]; then
        cp .env.production.example .env
        echo -e "${GREEN}✅ Файл .env создан. Отредактируйте его перед запуском!${NC}"
        echo ""
        echo -e "${YELLOW}Обязательно измените:${NC}"
        echo "  - DOMAIN (ваш домен)"
        echo "  - ACME_EMAIL (email для SSL)"
        echo "  - MYSQL_PASSWORD (пароль БД)"
        echo "  - MINIO_ROOT_PASSWORD (пароль S3)"
        echo "  - JWT_SECRET (секретный ключ)"
        echo ""
        read -p "Нажмите Enter после редактирования .env файла..."
    else
        echo -e "${RED}❌ Файл .env.production.example не найден!${NC}"
        exit 1
    fi
fi

# Загрузка переменных
source .env

DOMAIN=${1:-${DOMAIN:-localhost}}
echo -e "${BLUE}🌐 Домен: ${DOMAIN}${NC}"

# Создание директорий
echo -e "${BLUE}📁 Создание директорий...${NC}"
mkdir -p deploy/traefik/letsencrypt
mkdir -p deploy/traefik/dynamic
touch deploy/traefik/letsencrypt/acme.json
chmod 600 deploy/traefik/letsencrypt/acme.json

# Сборка приложения
echo -e "${BLUE}🔨 Сборка Docker образа...${NC}"
$COMPOSE_CMD -f docker-compose.production.yml build app

# Запуск сервисов
echo -e "${BLUE}🚀 Запуск сервисов...${NC}"
$COMPOSE_CMD -f docker-compose.production.yml up -d

# Ожидание запуска
echo -e "${BLUE}⏳ Ожидание запуска сервисов...${NC}"
sleep 10

# Проверка статуса
echo -e "${BLUE}📊 Статус сервисов:${NC}"
$COMPOSE_CMD -f docker-compose.production.yml ps

# Инициализация базы данных
echo -e "${BLUE}🗄️  Применение миграций базы данных...${NC}"
$COMPOSE_CMD -f docker-compose.production.yml exec -T app node -e "
const { execSync } = require('child_process');
try {
  execSync('npx drizzle-kit push', { stdio: 'inherit' });
  console.log('Миграции применены успешно');
} catch (e) {
  console.log('Миграции уже применены или ошибка:', e.message);
}
" 2>/dev/null || echo "Миграции будут применены при первом запуске"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ✅ Деплой завершён!                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📌 Доступные сервисы:${NC}"
echo -e "   Wiki:           https://${DOMAIN}"
echo -e "   Traefik:        https://traefik.${DOMAIN} (или http://localhost:8080)"
echo -e "   MinIO Console:  https://minio.${DOMAIN} (или http://localhost:9001)"
echo -e "   S3 API:         https://s3.${DOMAIN}"
echo ""
echo -e "${YELLOW}📝 Полезные команды:${NC}"
echo "   Логи:           $COMPOSE_CMD -f docker-compose.production.yml logs -f"
echo "   Статус:         $COMPOSE_CMD -f docker-compose.production.yml ps"
echo "   Остановка:      $COMPOSE_CMD -f docker-compose.production.yml down"
echo "   Перезапуск:     $COMPOSE_CMD -f docker-compose.production.yml restart"
echo ""
