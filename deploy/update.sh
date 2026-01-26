#!/bin/bash
#===============================================================================
# Scoliologic Wiki - Auto Update Script
# Скрипт для быстрого обновления приложения через SSH
#===============================================================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_DIR}/deploy/update.log"
BACKUP_DIR="${PROJECT_DIR}/backups"
LOCK_FILE="/tmp/wiki-update.lock"
MAX_RETRIES=3
RETRY_DELAY=5
HEALTH_CHECK_URL="http://localhost:3000/api/health"

# Версия скрипта
VERSION="1.0.0"

#===============================================================================
# Функции логирования
#===============================================================================

log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "${BLUE}ℹ${NC} $@"; }
log_success() { log "SUCCESS" "${GREEN}✓${NC} $@"; }
log_warning() { log "WARNING" "${YELLOW}⚠${NC} $@"; }
log_error() { log "ERROR" "${RED}✗${NC} $@"; }
log_step() { echo -e "\n${CYAN}▶${NC} $@" | tee -a "$LOG_FILE"; }

#===============================================================================
# Утилиты
#===============================================================================

# Проверка блокировки (предотвращение параллельного запуска)
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log_error "Другой процесс обновления уже запущен (PID: $pid)"
            exit 1
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
    trap "rm -f $LOCK_FILE" EXIT
}

# Проверка зависимостей
check_dependencies() {
    local deps=("docker" "docker-compose" "git" "curl")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Отсутствуют зависимости: ${missing[*]}"
        exit 1
    fi
}

# Проверка здоровья приложения
health_check() {
    local retries=0
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            return 0
        fi
        retries=$((retries + 1))
        log_info "Ожидание запуска приложения... ($retries/$MAX_RETRIES)"
        sleep $RETRY_DELAY
    done
    
    return 1
}

#===============================================================================
# Резервное копирование
#===============================================================================

backup_database() {
    log_step "Создание резервной копии базы данных"
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="${BACKUP_DIR}/db_$(date '+%Y%m%d_%H%M%S').sql"
    
    if docker ps --format '{{.Names}}' | grep -q wiki-postgres; then
        if docker exec wiki-postgres pg_dump -U wiki scoliologic_wiki > "$backup_file" 2>/dev/null; then
            gzip "$backup_file"
            log_success "Резервная копия: ${backup_file}.gz"
            
            # Ротация бэкапов (оставляем последние 7)
            ls -t "${BACKUP_DIR}"/db_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm
        else
            log_warning "Не удалось создать резервную копию БД"
        fi
    else
        log_warning "PostgreSQL не запущен, пропуск резервного копирования"
    fi
}

#===============================================================================
# Обновление кода
#===============================================================================

pull_changes() {
    log_step "Получение обновлений из репозитория"
    
    cd "$PROJECT_DIR"
    
    # Сохраняем текущий коммит
    PREVIOUS_COMMIT=$(git rev-parse HEAD)
    PREVIOUS_COMMIT_SHORT=$(git rev-parse --short HEAD)
    
    # Проверяем локальные изменения
    if ! git diff --quiet 2>/dev/null; then
        log_warning "Обнаружены локальные изменения"
        git stash push -m "Auto-stash $(date '+%Y-%m-%d %H:%M:%S')" 2>/dev/null || true
    fi
    
    # Получаем изменения
    git fetch origin main --quiet
    
    # Проверяем наличие обновлений
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [ "$LOCAL" == "$REMOTE" ]; then
        log_info "Нет новых обновлений"
        return 1
    fi
    
    # Применяем обновления
    git pull origin main --quiet
    
    NEW_COMMIT=$(git rev-parse HEAD)
    NEW_COMMIT_SHORT=$(git rev-parse --short HEAD)
    
    log_success "Обновлено: $PREVIOUS_COMMIT_SHORT → $NEW_COMMIT_SHORT"
    
    # Показываем список изменений
    echo ""
    log_info "Изменения:"
    git log --oneline "$PREVIOUS_COMMIT..$NEW_COMMIT" | head -10
    echo ""
    
    return 0
}

#===============================================================================
# Установка зависимостей
#===============================================================================

install_dependencies() {
    log_step "Установка зависимостей"
    
    cd "$PROJECT_DIR"
    
    # Проверяем изменения в package.json или pnpm-lock.yaml
    if git diff --name-only "$PREVIOUS_COMMIT" HEAD 2>/dev/null | grep -qE "package.json|pnpm-lock.yaml"; then
        log_info "Обнаружены изменения в зависимостях"
        
        if command -v pnpm &> /dev/null; then
            pnpm install --frozen-lockfile --silent
        elif command -v npm &> /dev/null; then
            npm ci --silent
        fi
        
        log_success "Зависимости обновлены"
    else
        log_info "Зависимости не изменились, пропуск"
    fi
}

#===============================================================================
# Перезапуск сервисов
#===============================================================================

restart_services() {
    log_step "Перезапуск сервисов"
    
    cd "$PROJECT_DIR"
    
    # Определяем compose файл
    local compose_file="docker-compose.yml"
    if [ -f "docker-compose.existing-traefik.yml" ] && [ -f ".use-existing-traefik" ]; then
        compose_file="docker-compose.existing-traefik.yml"
    fi
    
    # Пересборка и перезапуск только приложения (минимальный даунтайм)
    log_info "Пересборка образа приложения..."
    docker-compose -f "$compose_file" build --quiet app
    
    log_info "Перезапуск контейнера..."
    docker-compose -f "$compose_file" up -d --no-deps --force-recreate app
    
    log_success "Сервисы перезапущены"
}

#===============================================================================
# Миграции базы данных
#===============================================================================

run_migrations() {
    log_step "Проверка миграций базы данных"
    
    cd "$PROJECT_DIR"
    
    # Проверяем изменения в схеме
    if git diff --name-only "$PREVIOUS_COMMIT" HEAD 2>/dev/null | grep -qE "drizzle/|schema.ts"; then
        log_info "Обнаружены изменения в схеме БД"
        
        # Ждём готовности PostgreSQL
        local retries=0
        while ! docker exec wiki-postgres pg_isready -U wiki &>/dev/null; do
            retries=$((retries + 1))
            if [ $retries -ge 10 ]; then
                log_error "PostgreSQL не готов"
                return 1
            fi
            sleep 2
        done
        
        if command -v pnpm &> /dev/null; then
            pnpm db:push 2>/dev/null || log_warning "Миграции не применены"
        else
            npm run db:push 2>/dev/null || log_warning "Миграции не применены"
        fi
        
        log_success "Миграции выполнены"
    else
        log_info "Миграции не требуются"
    fi
}

#===============================================================================
# Откат
#===============================================================================

rollback() {
    log_step "Откат к предыдущей версии"
    
    cd "$PROJECT_DIR"
    
    if [ -z "$PREVIOUS_COMMIT" ]; then
        log_error "Невозможно выполнить откат: предыдущий коммит не сохранён"
        exit 1
    fi
    
    log_warning "Откат к коммиту $PREVIOUS_COMMIT"
    
    git checkout "$PREVIOUS_COMMIT" --quiet
    
    if command -v pnpm &> /dev/null; then
        pnpm install --frozen-lockfile --silent
    else
        npm ci --silent
    fi
    
    restart_services
    
    log_success "Откат выполнен"
}

#===============================================================================
# Уведомления
#===============================================================================

send_notification() {
    local status=$1
    local message=$2
    
    # Telegram
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        local emoji="✅"
        [ "$status" == "error" ] && emoji="❌"
        [ "$status" == "warning" ] && emoji="⚠️"
        
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_CHAT_ID" \
            -d text="${emoji} <b>Scoliologic Wiki</b>%0A${message}" \
            -d parse_mode="HTML" > /dev/null 2>&1 || true
    fi
    
    # Slack (если настроен)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        [ "$status" == "error" ] && color="danger"
        [ "$status" == "warning" ] && color="warning"
        
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            -d "{\"attachments\":[{\"color\":\"${color}\",\"text\":\"${message}\"}]}" \
            > /dev/null 2>&1 || true
    fi
}

#===============================================================================
# Команды
#===============================================================================

cmd_update() {
    local force=false
    local skip_backup=false
    
    # Парсинг аргументов
    for arg in "$@"; do
        case $arg in
            --force|-f) force=true ;;
            --no-backup) skip_backup=true ;;
        esac
    done
    
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   Scoliologic Wiki - Auto Update v${VERSION}   ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    
    acquire_lock
    check_dependencies
    
    # Резервное копирование
    if [ "$skip_backup" = false ]; then
        backup_database
    fi
    
    # Получение обновлений
    if ! pull_changes; then
        if [ "$force" = true ]; then
            log_info "Принудительный перезапуск..."
        else
            log_success "Система актуальна, обновление не требуется"
            exit 0
        fi
    fi
    
    # Установка зависимостей
    install_dependencies
    
    # Перезапуск
    restart_services
    
    # Миграции
    run_migrations
    
    # Проверка здоровья
    log_step "Проверка работоспособности"
    
    if health_check; then
        send_notification "success" "Обновление успешно завершено"
        
        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║       ✓ Обновление успешно завершено!      ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
        echo ""
    else
        log_error "Приложение не отвечает после обновления"
        send_notification "error" "Ошибка обновления, выполняется откат"
        rollback
        
        if health_check; then
            log_success "Откат выполнен успешно"
        else
            log_error "Критическая ошибка! Требуется ручное вмешательство"
        fi
        exit 1
    fi
}

cmd_status() {
    echo ""
    echo -e "${CYAN}═══ Статус сервисов ═══${NC}"
    echo ""
    docker-compose ps 2>/dev/null || docker ps --filter "name=wiki-"
    echo ""
    echo -e "${CYAN}═══ Использование ресурсов ═══${NC}"
    echo ""
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null | grep wiki || true
    echo ""
    echo -e "${CYAN}═══ Версия ═══${NC}"
    echo ""
    cd "$PROJECT_DIR" 2>/dev/null && git log -1 --format="Коммит: %h%nДата: %ci%nСообщение: %s" || echo "Не удалось получить информацию о версии"
    echo ""
}

cmd_logs() {
    local follow=false
    local lines=100
    
    for arg in "$@"; do
        case $arg in
            -f|--follow) follow=true ;;
            -n=*|--lines=*) lines="${arg#*=}" ;;
        esac
    done
    
    cd "$PROJECT_DIR"
    
    if [ "$follow" = true ]; then
        docker-compose logs -f --tail="$lines" app
    else
        docker-compose logs --tail="$lines" app
    fi
}

cmd_restart() {
    log_step "Перезапуск сервисов"
    
    cd "$PROJECT_DIR"
    docker-compose restart app
    
    if health_check; then
        log_success "Сервисы перезапущены"
    else
        log_error "Приложение не отвечает после перезапуска"
        exit 1
    fi
}

cmd_backup() {
    backup_database
}

cmd_rollback() {
    if [ -z "$1" ]; then
        log_error "Укажите коммит для отката: $0 rollback <commit>"
        exit 1
    fi
    
    PREVIOUS_COMMIT="$1"
    rollback
}

show_help() {
    echo "
${CYAN}Scoliologic Wiki - Auto Update Script v${VERSION}${NC}

${YELLOW}Использование:${NC}
    $0 <команда> [опции]

${YELLOW}Команды:${NC}
    update      Обновить приложение из репозитория
    status      Показать статус сервисов
    logs        Показать логи приложения
    restart     Перезапустить приложение
    backup      Создать резервную копию БД
    rollback    Откатить к указанному коммиту
    help        Показать эту справку

${YELLOW}Опции для update:${NC}
    --force, -f     Принудительный перезапуск даже без изменений
    --no-backup     Пропустить создание резервной копии

${YELLOW}Опции для logs:${NC}
    -f, --follow    Следить за логами в реальном времени
    -n=N, --lines=N Количество строк (по умолчанию: 100)

${YELLOW}Примеры:${NC}
    $0 update                    # Стандартное обновление
    $0 update --force            # Принудительное обновление
    $0 logs -f                   # Следить за логами
    $0 rollback abc1234          # Откат к коммиту

${YELLOW}Переменные окружения:${NC}
    TELEGRAM_BOT_TOKEN    Токен Telegram бота для уведомлений
    TELEGRAM_CHAT_ID      ID чата для уведомлений
    SLACK_WEBHOOK_URL     URL вебхука Slack для уведомлений

${YELLOW}Автоматизация (cron):${NC}
    # Проверка обновлений каждые 5 минут
    */5 * * * * /path/to/update.sh update >> /var/log/wiki-update.log 2>&1
"
}

#===============================================================================
# Точка входа
#===============================================================================

main() {
    mkdir -p "$(dirname "$LOG_FILE")"
    mkdir -p "$BACKUP_DIR"
    
    local command=${1:-help}
    shift || true
    
    case $command in
        update)     cmd_update "$@" ;;
        status)     cmd_status ;;
        logs)       cmd_logs "$@" ;;
        restart)    cmd_restart ;;
        backup)     cmd_backup ;;
        rollback)   cmd_rollback "$@" ;;
        help|--help|-h) show_help ;;
        *)
            log_error "Неизвестная команда: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
