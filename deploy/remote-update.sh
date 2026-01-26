#!/bin/bash
#===============================================================================
# Scoliologic Wiki - Remote Update Script
# Скрипт для запуска обновления на удалённом сервере через SSH
#===============================================================================

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Конфигурация по умолчанию (можно переопределить через переменные окружения)
SSH_USER="${SSH_USER:-root}"
SSH_HOST="${SSH_HOST:-}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-}"
REMOTE_PATH="${REMOTE_PATH:-/opt/scoliologic-wiki}"

# Версия
VERSION="1.0.0"

show_help() {
    echo "
${CYAN}Scoliologic Wiki - Remote Update Script v${VERSION}${NC}

${YELLOW}Описание:${NC}
    Скрипт для запуска обновления на удалённом сервере через SSH.
    Выполняет git pull, установку зависимостей и перезапуск сервисов.

${YELLOW}Использование:${NC}
    $0 [опции] <команда>

${YELLOW}Команды:${NC}
    update      Обновить приложение на сервере
    status      Показать статус сервисов
    logs        Показать логи приложения
    restart     Перезапустить приложение
    backup      Создать резервную копию БД
    shell       Открыть SSH сессию на сервере

${YELLOW}Опции:${NC}
    -h, --host HOST     SSH хост (обязательно)
    -u, --user USER     SSH пользователь (по умолчанию: root)
    -p, --port PORT     SSH порт (по умолчанию: 22)
    -k, --key FILE      Путь к SSH ключу
    -d, --dir PATH      Путь к проекту на сервере (по умолчанию: /opt/scoliologic-wiki)
    --help              Показать эту справку

${YELLOW}Примеры:${NC}
    # Обновление с указанием хоста
    $0 -h wiki.example.com update

    # Обновление с SSH ключом
    $0 -h wiki.example.com -k ~/.ssh/id_rsa update

    # Просмотр логов
    $0 -h wiki.example.com logs

    # Открыть SSH сессию
    $0 -h wiki.example.com shell

${YELLOW}Переменные окружения:${NC}
    SSH_HOST        Хост сервера
    SSH_USER        Пользователь SSH
    SSH_PORT        Порт SSH
    SSH_KEY         Путь к SSH ключу
    REMOTE_PATH     Путь к проекту на сервере

${YELLOW}Настройка для быстрого использования:${NC}
    # Добавьте в ~/.bashrc или ~/.zshrc:
    export SSH_HOST=\"wiki.example.com\"
    export SSH_USER=\"deploy\"
    export SSH_KEY=\"~/.ssh/wiki_deploy\"
    export REMOTE_PATH=\"/opt/scoliologic-wiki\"
    alias wiki-update=\"/path/to/remote-update.sh update\"
    alias wiki-status=\"/path/to/remote-update.sh status\"
    alias wiki-logs=\"/path/to/remote-update.sh logs\"
"
}

# Парсинг аргументов
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--host)
                SSH_HOST="$2"
                shift 2
                ;;
            -u|--user)
                SSH_USER="$2"
                shift 2
                ;;
            -p|--port)
                SSH_PORT="$2"
                shift 2
                ;;
            -k|--key)
                SSH_KEY="$2"
                shift 2
                ;;
            -d|--dir)
                REMOTE_PATH="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            -*)
                echo -e "${RED}Неизвестная опция: $1${NC}"
                show_help
                exit 1
                ;;
            *)
                COMMAND="$1"
                shift
                EXTRA_ARGS="$@"
                break
                ;;
        esac
    done
}

# Проверка конфигурации
validate_config() {
    if [ -z "$SSH_HOST" ]; then
        echo -e "${RED}Ошибка: не указан SSH хост${NC}"
        echo "Используйте опцию -h или установите переменную SSH_HOST"
        exit 1
    fi
}

# Формирование SSH команды
get_ssh_cmd() {
    local ssh_cmd="ssh"
    
    if [ -n "$SSH_KEY" ]; then
        ssh_cmd="$ssh_cmd -i $SSH_KEY"
    fi
    
    ssh_cmd="$ssh_cmd -p $SSH_PORT"
    ssh_cmd="$ssh_cmd -o StrictHostKeyChecking=accept-new"
    ssh_cmd="$ssh_cmd -o ConnectTimeout=10"
    ssh_cmd="$ssh_cmd ${SSH_USER}@${SSH_HOST}"
    
    echo "$ssh_cmd"
}

# Выполнение команды на сервере
run_remote() {
    local cmd="$1"
    local ssh_cmd=$(get_ssh_cmd)
    
    echo -e "${CYAN}▶ Подключение к ${SSH_USER}@${SSH_HOST}:${SSH_PORT}${NC}"
    echo -e "${CYAN}▶ Выполнение: ${cmd}${NC}"
    echo ""
    
    $ssh_cmd "$cmd"
}

# Команда обновления
cmd_update() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║   Scoliologic Wiki - Remote Update         ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    echo ""
    
    run_remote "cd ${REMOTE_PATH} && ./deploy/update.sh update $EXTRA_ARGS"
    
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       ✓ Обновление завершено!              ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

# Команда статуса
cmd_status() {
    run_remote "cd ${REMOTE_PATH} && ./deploy/update.sh status"
}

# Команда логов
cmd_logs() {
    local ssh_cmd=$(get_ssh_cmd)
    echo -e "${CYAN}▶ Подключение к ${SSH_USER}@${SSH_HOST}:${SSH_PORT}${NC}"
    echo -e "${CYAN}▶ Логи приложения (Ctrl+C для выхода)${NC}"
    echo ""
    
    $ssh_cmd "cd ${REMOTE_PATH} && docker-compose logs -f --tail=100 app"
}

# Команда перезапуска
cmd_restart() {
    run_remote "cd ${REMOTE_PATH} && ./deploy/update.sh restart"
}

# Команда бэкапа
cmd_backup() {
    run_remote "cd ${REMOTE_PATH} && ./deploy/update.sh backup"
}

# Открыть SSH сессию
cmd_shell() {
    local ssh_cmd=$(get_ssh_cmd)
    echo -e "${CYAN}▶ Открытие SSH сессии на ${SSH_USER}@${SSH_HOST}:${SSH_PORT}${NC}"
    echo -e "${CYAN}▶ Рабочая директория: ${REMOTE_PATH}${NC}"
    echo ""
    
    $ssh_cmd -t "cd ${REMOTE_PATH} && exec \$SHELL -l"
}

# Быстрая команда (одна строка)
cmd_quick() {
    local quick_cmd="cd ${REMOTE_PATH} && git pull && pnpm install && docker-compose restart app"
    run_remote "$quick_cmd"
}

# Основная функция
main() {
    parse_args "$@"
    
    if [ -z "$COMMAND" ]; then
        show_help
        exit 0
    fi
    
    validate_config
    
    case $COMMAND in
        update)     cmd_update ;;
        status)     cmd_status ;;
        logs)       cmd_logs ;;
        restart)    cmd_restart ;;
        backup)     cmd_backup ;;
        shell)      cmd_shell ;;
        quick)      cmd_quick ;;
        *)
            echo -e "${RED}Неизвестная команда: $COMMAND${NC}"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
