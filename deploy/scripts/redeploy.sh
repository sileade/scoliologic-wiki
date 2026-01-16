#!/bin/bash
#
# Scoliologic Wiki - Полное переразвёртывание
# 
# Этот скрипт:
# 1. Останавливает все контейнеры
# 2. Удаляет старые образы и volumes (опционально)
# 3. Клонирует свежую версию из GitHub
# 4. Запускает новую версию
#
# Использование:
#   ./redeploy.sh [--clean] [--keep-data]
#
# Опции:
#   --clean     Полная очистка (удаление volumes с данными)
#   --keep-data Сохранить данные БД и файлы (по умолчанию)
#

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Параметры
CLEAN_MODE=false
KEEP_DATA=true
INSTALL_DIR="/opt/scoliologic-wiki"
REPO_URL="https://github.com/sileade/scoliologic-wiki.git"
BRANCH="main"
COMPOSE_FILE="docker-compose.full.yml"

# Обработка аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --clean)
            CLEAN_MODE=true
            KEEP_DATA=false
            shift
            ;;
        --keep-data)
            KEEP_DATA=true
            shift
            ;;
        *)
            log_error "Неизвестный параметр: $1"
            exit 1
            ;;
    esac
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     Scoliologic Wiki - Полное переразвёртывание              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

if [ "$CLEAN_MODE" = true ]; then
    log_warning "РЕЖИМ ПОЛНОЙ ОЧИСТКИ - все данные будут удалены!"
    echo ""
    read -p "Вы уверены? Введите 'YES' для подтверждения: " confirm
    if [ "$confirm" != "YES" ]; then
        log_info "Отменено пользователем"
        exit 0
    fi
else
    log_info "Режим: сохранение данных БД и файлов"
fi

# Проверка прав
if [ "$EUID" -ne 0 ]; then
    log_error "Запустите скрипт с правами root: sudo ./redeploy.sh"
    exit 1
fi

# ============================================
# ШАГ 1: Создание резервной копии
# ============================================
log_info "Шаг 1/6: Создание резервной копии..."

BACKUP_DIR="/opt/backups/scoliologic-wiki"
BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

if [ -d "$INSTALL_DIR" ]; then
    # Бэкап .env файла
    if [ -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env" "$BACKUP_DIR/${BACKUP_NAME}.env"
        log_success "Сохранён .env файл"
    fi
    
    # Бэкап базы данных (если контейнер запущен)
    if docker ps --format '{{.Names}}' | grep -q "wiki-postgres"; then
        log_info "Создание дампа базы данных..."
        docker exec wiki-postgres pg_dump -U wiki wiki > "$BACKUP_DIR/${BACKUP_NAME}.sql" 2>/dev/null || true
        if [ -f "$BACKUP_DIR/${BACKUP_NAME}.sql" ]; then
            log_success "Создан дамп БД: ${BACKUP_NAME}.sql"
        fi
    fi
fi

# ============================================
# ШАГ 2: Остановка контейнеров
# ============================================
log_info "Шаг 2/6: Остановка контейнеров..."

cd "$INSTALL_DIR" 2>/dev/null || true

# Остановка через docker-compose
if [ -f "$INSTALL_DIR/$COMPOSE_FILE" ]; then
    docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
fi

# Остановка всех контейнеров wiki-*
docker ps -a --filter "name=wiki-" --format "{{.Names}}" | xargs -r docker stop 2>/dev/null || true
docker ps -a --filter "name=wiki-" --format "{{.Names}}" | xargs -r docker rm -f 2>/dev/null || true

log_success "Контейнеры остановлены"

# ============================================
# ШАГ 3: Очистка (опционально)
# ============================================
log_info "Шаг 3/6: Очистка..."

if [ "$CLEAN_MODE" = true ]; then
    log_warning "Удаление volumes..."
    docker volume ls --filter "name=scoliologic" --format "{{.Name}}" | xargs -r docker volume rm 2>/dev/null || true
    docker volume ls --filter "name=wiki" --format "{{.Name}}" | xargs -r docker volume rm 2>/dev/null || true
    log_success "Volumes удалены"
fi

# Удаление старых образов
log_info "Удаление старых образов..."
docker images --filter "reference=*wiki*" --format "{{.ID}}" | xargs -r docker rmi -f 2>/dev/null || true
docker image prune -f 2>/dev/null || true

log_success "Очистка завершена"

# ============================================
# ШАГ 4: Клонирование репозитория
# ============================================
log_info "Шаг 4/6: Клонирование репозитория..."

# Удаление старой директории (сохраняем .env)
if [ -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env" /tmp/scoliologic-wiki.env.bak
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"

# Восстановление .env
if [ -f /tmp/scoliologic-wiki.env.bak ]; then
    cp /tmp/scoliologic-wiki.env.bak "$INSTALL_DIR/.env"
    rm /tmp/scoliologic-wiki.env.bak
    log_success "Восстановлен .env файл"
elif [ -f "$BACKUP_DIR/${BACKUP_NAME}.env" ]; then
    cp "$BACKUP_DIR/${BACKUP_NAME}.env" "$INSTALL_DIR/.env"
    log_success "Восстановлен .env из бэкапа"
else
    # Создание нового .env из примера
    if [ -f "$INSTALL_DIR/deploy/env.example.txt" ]; then
        cp "$INSTALL_DIR/deploy/env.example.txt" "$INSTALL_DIR/.env"
        log_warning "Создан новый .env из примера - требуется настройка!"
    fi
fi

cd "$INSTALL_DIR"
log_success "Репозиторий клонирован"

# ============================================
# ШАГ 5: Сборка и запуск
# ============================================
log_info "Шаг 5/6: Сборка и запуск контейнеров..."

# Проверка .env
if [ ! -f ".env" ]; then
    log_error ".env файл не найден!"
    log_info "Создайте .env файл на основе deploy/env.example.txt"
    exit 1
fi

# Запуск с нужными профилями
PROFILES="--profile default"

# Проверяем, нужен ли Ollama
if grep -q "OLLAMA_ENABLED=true" .env 2>/dev/null; then
    PROFILES="$PROFILES --profile ollama"
fi

# Проверяем, нужен ли мониторинг
if grep -q "MONITORING_ENABLED=true" .env 2>/dev/null; then
    PROFILES="$PROFILES --profile monitoring"
fi

# Проверяем, нужен ли GitOps
if grep -q "GITOPS_ENABLED=true" .env 2>/dev/null; then
    PROFILES="$PROFILES --profile gitops"
fi

log_info "Запуск с профилями: $PROFILES"

docker compose -f "$COMPOSE_FILE" $PROFILES pull
docker compose -f "$COMPOSE_FILE" $PROFILES build --no-cache
docker compose -f "$COMPOSE_FILE" $PROFILES up -d

log_success "Контейнеры запущены"

# ============================================
# ШАГ 6: Проверка здоровья
# ============================================
log_info "Шаг 6/6: Проверка здоровья сервисов..."

sleep 10

# Проверка контейнеров
echo ""
echo "Статус контейнеров:"
docker compose -f "$COMPOSE_FILE" ps

# Проверка здоровья приложения
APP_URL="http://localhost:3000"
for i in {1..30}; do
    if curl -s "$APP_URL/api/health" > /dev/null 2>&1; then
        log_success "Приложение доступно на $APP_URL"
        break
    fi
    if [ $i -eq 30 ]; then
        log_warning "Приложение ещё запускается..."
    fi
    sleep 2
done

# ============================================
# ГОТОВО
# ============================================
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    Переразвёртывание завершено!              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log_success "Scoliologic Wiki успешно переразвёрнут!"
echo ""
echo "Доступ:"
echo "  - Приложение: http://$(hostname -I | awk '{print $1}'):3000"
echo "  - Pull Agent: http://$(hostname -I | awk '{print $1}'):8080"
if grep -q "MONITORING_ENABLED=true" .env 2>/dev/null; then
    echo "  - Grafana:    http://$(hostname -I | awk '{print $1}'):3001"
fi
echo ""
echo "Бэкап сохранён в: $BACKUP_DIR"
echo ""
echo "Логи: docker compose -f $COMPOSE_FILE logs -f"
echo ""
