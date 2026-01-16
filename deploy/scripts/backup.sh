#!/bin/bash
#
# Scoliologic Wiki - Скрипт резервного копирования
#
# Создаёт резервные копии:
# - База данных PostgreSQL
# - Файлы MinIO S3
# - Конфигурация (.env)
#
# Использование:
#   ./backup.sh                    # Полный бэкап
#   ./backup.sh --db-only          # Только база данных
#   ./backup.sh --files-only       # Только файлы
#   ./backup.sh --scheduled        # Для cron (без интерактивности)
#

set -e

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$(dirname $(dirname $SCRIPT_DIR))}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/scoliologic-wiki}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Загрузка переменных окружения
load_env() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        set -a
        source "$INSTALL_DIR/.env"
        set +a
    else
        log_error "Файл .env не найден в $INSTALL_DIR"
        exit 1
    fi
}

# Создание директории для бэкапов
create_backup_dir() {
    CURRENT_BACKUP_DIR="$BACKUP_DIR/$TIMESTAMP"
    mkdir -p "$CURRENT_BACKUP_DIR"
    log_info "Директория бэкапа: $CURRENT_BACKUP_DIR"
}

# Бэкап базы данных
backup_database() {
    log_info "Создание бэкапа базы данных..."
    
    DB_BACKUP_FILE="$CURRENT_BACKUP_DIR/database.sql.gz"
    
    docker exec wiki-postgres pg_dump \
        -U "${DB_USER:-wiki}" \
        -d "${DB_NAME:-scoliologic_wiki}" \
        --no-owner \
        --no-acl \
        | gzip > "$DB_BACKUP_FILE"
    
    DB_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
    log_success "База данных: $DB_SIZE"
}

# Бэкап файлов MinIO
backup_files() {
    log_info "Создание бэкапа файлов MinIO..."
    
    FILES_BACKUP_DIR="$CURRENT_BACKUP_DIR/files"
    mkdir -p "$FILES_BACKUP_DIR"
    
    # Копируем данные MinIO
    docker run --rm \
        --volumes-from wiki-minio \
        -v "$FILES_BACKUP_DIR:/backup" \
        alpine \
        tar czf /backup/minio-data.tar.gz -C /data .
    
    FILES_SIZE=$(du -h "$FILES_BACKUP_DIR/minio-data.tar.gz" | cut -f1)
    log_success "Файлы MinIO: $FILES_SIZE"
}

# Бэкап конфигурации
backup_config() {
    log_info "Создание бэкапа конфигурации..."
    
    CONFIG_BACKUP_DIR="$CURRENT_BACKUP_DIR/config"
    mkdir -p "$CONFIG_BACKUP_DIR"
    
    # Копируем .env (без паролей в логах)
    cp "$INSTALL_DIR/.env" "$CONFIG_BACKUP_DIR/.env"
    
    # Копируем docker-compose файлы
    cp "$INSTALL_DIR/docker-compose.full.yml" "$CONFIG_BACKUP_DIR/"
    
    # Копируем конфигурации сервисов
    if [ -d "$INSTALL_DIR/deploy" ]; then
        cp -r "$INSTALL_DIR/deploy/prometheus" "$CONFIG_BACKUP_DIR/" 2>/dev/null || true
        cp -r "$INSTALL_DIR/deploy/grafana" "$CONFIG_BACKUP_DIR/" 2>/dev/null || true
        cp -r "$INSTALL_DIR/deploy/alertmanager" "$CONFIG_BACKUP_DIR/" 2>/dev/null || true
    fi
    
    log_success "Конфигурация сохранена"
}

# Создание архива
create_archive() {
    log_info "Создание финального архива..."
    
    ARCHIVE_FILE="$BACKUP_DIR/wiki-backup-$TIMESTAMP.tar.gz"
    
    cd "$BACKUP_DIR"
    tar czf "$ARCHIVE_FILE" "$TIMESTAMP"
    rm -rf "$CURRENT_BACKUP_DIR"
    
    ARCHIVE_SIZE=$(du -h "$ARCHIVE_FILE" | cut -f1)
    log_success "Архив создан: $ARCHIVE_FILE ($ARCHIVE_SIZE)"
}

# Очистка старых бэкапов
cleanup_old_backups() {
    log_info "Очистка бэкапов старше $RETENTION_DAYS дней..."
    
    find "$BACKUP_DIR" -name "wiki-backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete
    
    REMAINING=$(ls -1 "$BACKUP_DIR"/wiki-backup-*.tar.gz 2>/dev/null | wc -l)
    log_success "Осталось бэкапов: $REMAINING"
}

# Отправка уведомления
send_notification() {
    local status=$1
    local message=$2
    
    # Telegram
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=$message" \
            -d "parse_mode=HTML" > /dev/null 2>&1 || true
    fi
    
    # Slack
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"$message\"}" > /dev/null 2>&1 || true
    fi
}

# Вывод справки
show_help() {
    echo "Использование: $0 [ОПЦИИ]"
    echo ""
    echo "Опции:"
    echo "  --db-only       Только база данных"
    echo "  --files-only    Только файлы MinIO"
    echo "  --config-only   Только конфигурация"
    echo "  --scheduled     Режим для cron (без интерактивности)"
    echo "  --help          Показать эту справку"
    echo ""
    echo "Переменные окружения:"
    echo "  INSTALL_DIR          Директория установки (по умолчанию: /opt/scoliologic-wiki)"
    echo "  BACKUP_DIR           Директория для бэкапов (по умолчанию: /var/backups/scoliologic-wiki)"
    echo "  BACKUP_RETENTION_DAYS Хранить бэкапы N дней (по умолчанию: 7)"
}

# Основная функция
main() {
    local db_only=false
    local files_only=false
    local config_only=false
    local scheduled=false
    
    # Парсинг аргументов
    while [[ $# -gt 0 ]]; do
        case $1 in
            --db-only)
                db_only=true
                shift
                ;;
            --files-only)
                files_only=true
                shift
                ;;
            --config-only)
                config_only=true
                shift
                ;;
            --scheduled)
                scheduled=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Неизвестная опция: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}         ${GREEN}Scoliologic Wiki - Резервное копирование${NC}             ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    START_TIME=$(date +%s)
    
    load_env
    create_backup_dir
    
    # Выполняем бэкап в зависимости от опций
    if [ "$db_only" = true ]; then
        backup_database
    elif [ "$files_only" = true ]; then
        backup_files
    elif [ "$config_only" = true ]; then
        backup_config
    else
        backup_database
        backup_files
        backup_config
    fi
    
    create_archive
    cleanup_old_backups
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo ""
    log_success "Бэкап завершён за ${DURATION} секунд"
    
    # Отправляем уведомление
    if [ "$scheduled" = true ]; then
        send_notification "success" "✅ Бэкап Scoliologic Wiki завершён успешно\nРазмер: $ARCHIVE_SIZE\nВремя: ${DURATION}с"
    fi
}

# Обработка ошибок
trap 'log_error "Ошибка на строке $LINENO"; send_notification "error" "❌ Ошибка бэкапа Scoliologic Wiki"' ERR

# Запуск
main "$@"
