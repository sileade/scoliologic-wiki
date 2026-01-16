#!/bin/bash
# =============================================================================
# Scoliologic Wiki - Production Update Script
# =============================================================================
# Этот скрипт обновляет production версию Scoliologic Wiki
# 
# Использование:
#   ./update-production.sh
#
# Требования:
#   - Git доступ к репозиторию
#   - Docker и Docker Compose
#   - Права на перезапуск сервисов
# =============================================================================

set -e  # Остановить при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для логирования
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Конфигурация (измените под ваш сервер)
PROJECT_DIR="${PROJECT_DIR:-/opt/scoliologic-wiki}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/scoliologic-wiki}"

# =============================================================================
# Начало обновления
# =============================================================================

echo ""
echo "=============================================="
echo "  Scoliologic Wiki - Production Update"
echo "=============================================="
echo ""

# Проверка директории проекта
if [ ! -d "$PROJECT_DIR" ]; then
    log_error "Директория проекта не найдена: $PROJECT_DIR"
    log_info "Установите переменную PROJECT_DIR или создайте директорию"
    exit 1
fi

cd "$PROJECT_DIR"
log_info "Рабочая директория: $(pwd)"

# =============================================================================
# 1. Создание резервной копии
# =============================================================================

log_info "Создание резервной копии..."

BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/backup_$BACKUP_TIMESTAMP"

mkdir -p "$BACKUP_PATH"

# Бэкап конфигурации
if [ -f ".env" ]; then
    cp .env "$BACKUP_PATH/"
    log_success "Конфигурация сохранена"
fi

# Бэкап docker-compose
if [ -f "$COMPOSE_FILE" ]; then
    cp "$COMPOSE_FILE" "$BACKUP_PATH/"
fi

log_success "Резервная копия создана: $BACKUP_PATH"

# =============================================================================
# 2. Получение обновлений из Git
# =============================================================================

log_info "Получение обновлений из репозитория..."

# Сохраняем текущий коммит
CURRENT_COMMIT=$(git rev-parse HEAD)
log_info "Текущий коммит: $CURRENT_COMMIT"

# Получаем обновления
git fetch origin main

# Проверяем наличие обновлений
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
    log_warning "Обновлений нет. Текущая версия актуальна."
    echo ""
    read -p "Продолжить перезапуск сервисов? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Обновление отменено"
        exit 0
    fi
else
    # Показываем изменения
    log_info "Новые коммиты:"
    git log --oneline HEAD..origin/main
    echo ""
    
    # Применяем обновления
    git pull origin main
    NEW_COMMIT=$(git rev-parse HEAD)
    log_success "Обновлено до коммита: $NEW_COMMIT"
fi

# =============================================================================
# 3. Обновление зависимостей (если нужно)
# =============================================================================

log_info "Проверка зависимостей..."

# Проверяем изменения в package.json
if git diff --name-only $CURRENT_COMMIT HEAD | grep -q "package.json"; then
    log_warning "Обнаружены изменения в package.json"
    log_info "Обновление зависимостей..."
    
    # Если используется Docker
    if [ -f "$COMPOSE_FILE" ]; then
        docker-compose -f "$COMPOSE_FILE" build --no-cache
    else
        pnpm install
    fi
    
    log_success "Зависимости обновлены"
else
    log_info "Зависимости не изменились"
fi

# =============================================================================
# 4. Применение миграций БД (если нужно)
# =============================================================================

if git diff --name-only $CURRENT_COMMIT HEAD | grep -q "drizzle/"; then
    log_warning "Обнаружены изменения в схеме БД"
    log_info "Применение миграций..."
    
    if [ -f "$COMPOSE_FILE" ]; then
        docker-compose -f "$COMPOSE_FILE" exec -T app pnpm db:push
    else
        pnpm db:push
    fi
    
    log_success "Миграции применены"
fi

# =============================================================================
# 5. Перезапуск сервисов
# =============================================================================

log_info "Перезапуск сервисов..."

if [ -f "$COMPOSE_FILE" ]; then
    # Docker Compose
    docker-compose -f "$COMPOSE_FILE" down
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_info "Ожидание запуска сервисов..."
    sleep 10
    
    # Проверка статуса
    docker-compose -f "$COMPOSE_FILE" ps
else
    # Systemd
    if systemctl is-active --quiet scoliologic-wiki; then
        sudo systemctl restart scoliologic-wiki
    else
        log_warning "Сервис scoliologic-wiki не найден в systemd"
        log_info "Перезапустите сервис вручную"
    fi
fi

log_success "Сервисы перезапущены"

# =============================================================================
# 6. Проверка здоровья
# =============================================================================

log_info "Проверка здоровья приложения..."

# Ждём запуска
sleep 5

# Проверяем доступность
HEALTH_URL="${HEALTH_URL:-http://localhost:3000}"

if curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" | grep -q "200\|302"; then
    log_success "Приложение доступно: $HEALTH_URL"
else
    log_warning "Приложение может быть недоступно. Проверьте логи."
    
    if [ -f "$COMPOSE_FILE" ]; then
        log_info "Последние логи:"
        docker-compose -f "$COMPOSE_FILE" logs --tail=20
    fi
fi

# =============================================================================
# Завершение
# =============================================================================

echo ""
echo "=============================================="
echo "  Обновление завершено!"
echo "=============================================="
echo ""
log_info "Резервная копия: $BACKUP_PATH"
log_info "Текущая версия: $(git rev-parse --short HEAD)"
log_info "Дата: $(date)"
echo ""

# Показываем последние изменения
log_info "Последние изменения:"
git log --oneline -5
echo ""
