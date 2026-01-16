#!/bin/bash
#
# Scoliologic Wiki - Скрипт восстановления из бэкапа
#
# Восстанавливает:
# - База данных PostgreSQL
# - Файлы MinIO S3
# - Конфигурация (.env)
#
# Использование:
#   ./restore.sh /path/to/wiki-backup-20260116_120000.tar.gz
#   ./restore.sh --list                    # Показать доступные бэкапы
#   ./restore.sh --db-only /path/to/backup # Только база данных
#

set -e

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${INSTALL_DIR:-$(dirname $(dirname $SCRIPT_DIR))}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/scoliologic-wiki}"
TEMP_DIR="/tmp/wiki-restore-$$"

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
        log_warn "Файл .env не найден, используем значения по умолчанию"
        DB_USER="wiki"
        DB_NAME="scoliologic_wiki"
    fi
}

# Показать список бэкапов
list_backups() {
    echo ""
    echo -e "${BLUE}Доступные бэкапы:${NC}"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        log_warn "Директория бэкапов не найдена: $BACKUP_DIR"
        return
    fi
    
    ls -lh "$BACKUP_DIR"/wiki-backup-*.tar.gz 2>/dev/null | while read line; do
        echo "  $line"
    done
    
    echo ""
}

# Распаковка архива
extract_backup() {
    local backup_file=$1
    
    if [ ! -f "$backup_file" ]; then
        log_error "Файл бэкапа не найден: $backup_file"
        exit 1
    fi
    
    log_info "Распаковка архива..."
    
    mkdir -p "$TEMP_DIR"
    tar xzf "$backup_file" -C "$TEMP_DIR"
    
    # Находим директорию с данными
    BACKUP_DATA_DIR=$(find "$TEMP_DIR" -maxdepth 1 -type d -name "20*" | head -1)
    
    if [ -z "$BACKUP_DATA_DIR" ]; then
        log_error "Некорректный формат архива"
        exit 1
    fi
    
    log_success "Архив распакован"
}

# Восстановление базы данных
restore_database() {
    log_info "Восстановление базы данных..."
    
    DB_BACKUP_FILE="$BACKUP_DATA_DIR/database.sql.gz"
    
    if [ ! -f "$DB_BACKUP_FILE" ]; then
        log_warn "Файл бэкапа БД не найден, пропускаем"
        return
    fi
    
    # Останавливаем приложение
    log_info "Останавливаем приложение..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.full.yml stop app 2>/dev/null || true
    
    # Восстанавливаем БД
    log_info "Восстанавливаем данные..."
    
    # Пересоздаём базу
    docker exec wiki-postgres psql -U "${DB_USER:-wiki}" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME:-scoliologic_wiki};"
    docker exec wiki-postgres psql -U "${DB_USER:-wiki}" -d postgres -c "CREATE DATABASE ${DB_NAME:-scoliologic_wiki};"
    
    # Восстанавливаем данные
    gunzip -c "$DB_BACKUP_FILE" | docker exec -i wiki-postgres psql -U "${DB_USER:-wiki}" -d "${DB_NAME:-scoliologic_wiki}"
    
    log_success "База данных восстановлена"
}

# Восстановление файлов MinIO
restore_files() {
    log_info "Восстановление файлов MinIO..."
    
    FILES_BACKUP="$BACKUP_DATA_DIR/files/minio-data.tar.gz"
    
    if [ ! -f "$FILES_BACKUP" ]; then
        log_warn "Файл бэкапа MinIO не найден, пропускаем"
        return
    fi
    
    # Останавливаем MinIO
    log_info "Останавливаем MinIO..."
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.full.yml stop minio 2>/dev/null || true
    
    # Восстанавливаем файлы
    log_info "Восстанавливаем данные..."
    
    docker run --rm \
        --volumes-from wiki-minio \
        -v "$BACKUP_DATA_DIR/files:/backup" \
        alpine \
        sh -c "rm -rf /data/* && tar xzf /backup/minio-data.tar.gz -C /data"
    
    log_success "Файлы MinIO восстановлены"
}

# Восстановление конфигурации
restore_config() {
    log_info "Восстановление конфигурации..."
    
    CONFIG_BACKUP_DIR="$BACKUP_DATA_DIR/config"
    
    if [ ! -d "$CONFIG_BACKUP_DIR" ]; then
        log_warn "Директория конфигурации не найдена, пропускаем"
        return
    fi
    
    # Бэкапим текущую конфигурацию
    if [ -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env" "$INSTALL_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Восстанавливаем .env
    if [ -f "$CONFIG_BACKUP_DIR/.env" ]; then
        cp "$CONFIG_BACKUP_DIR/.env" "$INSTALL_DIR/.env"
        chmod 600 "$INSTALL_DIR/.env"
    fi
    
    log_success "Конфигурация восстановлена"
}

# Запуск сервисов
start_services() {
    log_info "Запуск сервисов..."
    
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.full.yml up -d
    
    log_success "Сервисы запущены"
}

# Очистка временных файлов
cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Вывод справки
show_help() {
    echo "Использование: $0 [ОПЦИИ] <файл_бэкапа>"
    echo ""
    echo "Опции:"
    echo "  --list          Показать доступные бэкапы"
    echo "  --db-only       Восстановить только базу данных"
    echo "  --files-only    Восстановить только файлы MinIO"
    echo "  --config-only   Восстановить только конфигурацию"
    echo "  --no-start      Не запускать сервисы после восстановления"
    echo "  --help          Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 /var/backups/scoliologic-wiki/wiki-backup-20260116_120000.tar.gz"
    echo "  $0 --db-only /var/backups/scoliologic-wiki/wiki-backup-20260116_120000.tar.gz"
    echo "  $0 --list"
}

# Основная функция
main() {
    local db_only=false
    local files_only=false
    local config_only=false
    local no_start=false
    local backup_file=""
    
    # Парсинг аргументов
    while [[ $# -gt 0 ]]; do
        case $1 in
            --list)
                list_backups
                exit 0
                ;;
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
            --no-start)
                no_start=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            -*)
                log_error "Неизвестная опция: $1"
                show_help
                exit 1
                ;;
            *)
                backup_file=$1
                shift
                ;;
        esac
    done
    
    if [ -z "$backup_file" ]; then
        log_error "Не указан файл бэкапа"
        show_help
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}         ${GREEN}Scoliologic Wiki - Восстановление из бэкапа${NC}          ${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Подтверждение
    echo -e "${YELLOW}ВНИМАНИЕ: Это действие перезапишет текущие данные!${NC}"
    echo ""
    read -p "Продолжить? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Отменено"
        exit 0
    fi
    
    # Устанавливаем обработчик очистки
    trap cleanup EXIT
    
    START_TIME=$(date +%s)
    
    load_env
    extract_backup "$backup_file"
    
    # Выполняем восстановление в зависимости от опций
    if [ "$db_only" = true ]; then
        restore_database
    elif [ "$files_only" = true ]; then
        restore_files
    elif [ "$config_only" = true ]; then
        restore_config
    else
        restore_database
        restore_files
        restore_config
    fi
    
    if [ "$no_start" = false ]; then
        start_services
    fi
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    echo ""
    log_success "Восстановление завершено за ${DURATION} секунд"
}

# Запуск
main "$@"
