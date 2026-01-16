#!/bin/bash
#
# Scoliologic Wiki - Полностью автоматическая установка
# 
# Одна команда для развёртывания:
#   curl -fsSL https://raw.githubusercontent.com/sileade/scoliologic-wiki/main/deploy/scripts/auto-install.sh | sudo bash
#
# Или с параметрами:
#   curl -fsSL ... | sudo bash -s -- --with-ollama --with-monitoring
#

set -e

# ============================================
# ЦВЕТА И ЛОГИРОВАНИЕ
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ============================================
# КОНФИГУРАЦИЯ
# ============================================
INSTALL_DIR="/opt/scoliologic-wiki"
REPO_URL="https://github.com/sileade/scoliologic-wiki.git"
BRANCH="main"
COMPOSE_FILE="docker-compose.full.yml"

# Опции (по умолчанию)
WITH_OLLAMA=true
WITH_MONITORING=false
WITH_GITOPS=true
WITH_TRAEFIK=false
CLEAN_INSTALL=true

# ============================================
# ОБРАБОТКА АРГУМЕНТОВ
# ============================================
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-ollama) WITH_OLLAMA=true; shift ;;
        --no-ollama) WITH_OLLAMA=false; shift ;;
        --with-monitoring) WITH_MONITORING=true; shift ;;
        --with-gitops) WITH_GITOPS=true; shift ;;
        --no-gitops) WITH_GITOPS=false; shift ;;
        --with-traefik) WITH_TRAEFIK=true; shift ;;
        --update) CLEAN_INSTALL=false; shift ;;
        *) shift ;;
    esac
done

# ============================================
# ФУНКЦИИ
# ============================================

generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32
}

generate_secret() {
    openssl rand -hex 32
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "Запустите скрипт с правами root: sudo bash auto-install.sh"
    fi
}

install_docker() {
    if command -v docker &> /dev/null; then
        success "Docker уже установлен: $(docker --version)"
        return
    fi
    
    log "Установка Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    success "Docker установлен"
}

install_dependencies() {
    log "Установка зависимостей..."
    apt-get update -qq
    apt-get install -y -qq git curl openssl jq > /dev/null
    success "Зависимости установлены"
}

cleanup_old() {
    if [ "$CLEAN_INSTALL" = true ] && [ -d "$INSTALL_DIR" ]; then
        log "Очистка старой установки..."
        
        cd "$INSTALL_DIR" 2>/dev/null || true
        
        # Сохраняем .env если есть
        if [ -f ".env" ]; then
            cp .env /tmp/scoliologic-wiki.env.old
            warn "Старый .env сохранён в /tmp/scoliologic-wiki.env.old"
        fi
        
        # Останавливаем контейнеры
        docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
        docker ps -a --filter "name=wiki-" -q | xargs -r docker rm -f 2>/dev/null || true
        
        # Удаляем volumes
        docker volume ls --filter "name=scoliologic" -q | xargs -r docker volume rm 2>/dev/null || true
        docker volume ls --filter "name=wiki" -q | xargs -r docker volume rm 2>/dev/null || true
        
        # Удаляем образы
        docker images --filter "reference=*wiki*" -q | xargs -r docker rmi -f 2>/dev/null || true
        docker image prune -f > /dev/null 2>&1 || true
        
        # Удаляем директорию
        rm -rf "$INSTALL_DIR"
        
        success "Старая установка удалена"
    fi
}

clone_repo() {
    log "Клонирование репозитория..."
    
    mkdir -p "$INSTALL_DIR"
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" 2>/dev/null
    
    cd "$INSTALL_DIR"
    success "Репозиторий клонирован"
}

generate_env() {
    log "Генерация конфигурации..."
    
    # Генерация всех паролей и секретов
    local POSTGRES_PASSWORD=$(generate_password)
    local JWT_SECRET=$(generate_secret)
    local WEBHOOK_SECRET=$(generate_secret)
    local MINIO_ROOT_PASSWORD=$(generate_password)
    local GRAFANA_PASSWORD=$(generate_password)
    local SERVER_IP=$(hostname -I | awk '{print $1}')
    
    cat > "$INSTALL_DIR/.env" << EOF
# ============================================
# Scoliologic Wiki - Автоматически сгенерировано
# $(date)
# ============================================

# === ОСНОВНЫЕ НАСТРОЙКИ ===
NODE_ENV=production
APP_URL=http://${SERVER_IP}:3000
PORT=3000

# === БАЗА ДАННЫХ (PostgreSQL) ===
POSTGRES_USER=wiki
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=wiki
DATABASE_URL=postgresql://wiki:${POSTGRES_PASSWORD}@postgres:5432/wiki

# === БЕЗОПАСНОСТЬ ===
JWT_SECRET=${JWT_SECRET}

# === REDIS ===
REDIS_URL=redis://redis:6379

# === OLLAMA (AI) ===
OLLAMA_ENABLED=${WITH_OLLAMA}
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2

# === MINIO (S3 Storage) ===
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}
MINIO_ENDPOINT=http://minio:9000
MINIO_BUCKET=wiki

# === GITOPS PULL AGENT ===
GITOPS_ENABLED=${WITH_GITOPS}
GIT_REPO_URL=${REPO_URL}
GIT_BRANCH=${BRANCH}
PULL_INTERVAL=300
WEBHOOK_SECRET=${WEBHOOK_SECRET}
WEBHOOK_ENABLED=true

# === МОНИТОРИНГ ===
MONITORING_ENABLED=${WITH_MONITORING}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}

# === TRAEFIK ===
TRAEFIK_ENABLED=${WITH_TRAEFIK}
DOMAIN=wiki.local
EOF

    success "Конфигурация сгенерирована"
    
    # Сохраняем credentials в отдельный файл
    cat > "$INSTALL_DIR/CREDENTIALS.txt" << EOF
╔══════════════════════════════════════════════════════════════╗
║           SCOLIOLOGIC WIKI - УЧЁТНЫЕ ДАННЫЕ                  ║
║                  СОХРАНИТЕ ЭТОТ ФАЙЛ!                        ║
╚══════════════════════════════════════════════════════════════╝

Дата установки: $(date)
Сервер: ${SERVER_IP}

=== ДОСТУП К ПРИЛОЖЕНИЮ ===
URL: http://${SERVER_IP}:3000

=== БАЗА ДАННЫХ (PostgreSQL) ===
Host: ${SERVER_IP}:5432
User: wiki
Password: ${POSTGRES_PASSWORD}
Database: wiki
Connection: postgresql://wiki:${POSTGRES_PASSWORD}@${SERVER_IP}:5432/wiki

=== MINIO (S3 Storage) ===
Console: http://${SERVER_IP}:9001
User: admin
Password: ${MINIO_ROOT_PASSWORD}

=== GITOPS PULL AGENT ===
Dashboard: http://${SERVER_IP}:8080
Webhook URL: http://${SERVER_IP}:8080/webhook
Webhook Secret: ${WEBHOOK_SECRET}

EOF

    if [ "$WITH_MONITORING" = true ]; then
        cat >> "$INSTALL_DIR/CREDENTIALS.txt" << EOF
=== МОНИТОРИНГ ===
Grafana: http://${SERVER_IP}:3001
User: admin
Password: ${GRAFANA_PASSWORD}
Prometheus: http://${SERVER_IP}:9090

EOF
    fi

    cat >> "$INSTALL_DIR/CREDENTIALS.txt" << EOF
=== СЕКРЕТЫ ===
JWT Secret: ${JWT_SECRET}

╔══════════════════════════════════════════════════════════════╗
║  ВНИМАНИЕ: Этот файл содержит конфиденциальные данные!       ║
║  Храните его в безопасном месте и удалите после сохранения.  ║
╚══════════════════════════════════════════════════════════════╝
EOF

    chmod 600 "$INSTALL_DIR/CREDENTIALS.txt"
    success "Учётные данные сохранены в CREDENTIALS.txt"
}

start_services() {
    log "Запуск сервисов..."
    
    cd "$INSTALL_DIR"
    
    # Формируем список профилей
    PROFILES="--profile default"
    
    if [ "$WITH_OLLAMA" = true ]; then
        PROFILES="$PROFILES --profile ollama"
    fi
    
    if [ "$WITH_MONITORING" = true ]; then
        PROFILES="$PROFILES --profile monitoring"
    fi
    
    if [ "$WITH_GITOPS" = true ]; then
        PROFILES="$PROFILES --profile gitops"
    fi
    
    if [ "$WITH_TRAEFIK" = true ]; then
        PROFILES="$PROFILES --profile traefik"
    fi
    
    log "Профили: $PROFILES"
    
    # Запуск
    docker compose -f "$COMPOSE_FILE" $PROFILES pull 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" $PROFILES up -d --build
    
    success "Сервисы запущены"
}

wait_for_health() {
    log "Ожидание готовности сервисов..."
    
    local SERVER_IP=$(hostname -I | awk '{print $1}')
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://localhost:3000" > /dev/null 2>&1; then
            success "Приложение готово!"
            return 0
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    warn "Приложение ещё запускается. Проверьте логи: docker compose logs -f"
}

show_summary() {
    local SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         SCOLIOLOGIC WIKI - УСТАНОВКА ЗАВЕРШЕНА!              ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}Приложение:${NC}     http://${SERVER_IP}:3000"
    echo -e "${GREEN}Pull Agent:${NC}     http://${SERVER_IP}:8080"
    
    if [ "$WITH_MONITORING" = true ]; then
        echo -e "${GREEN}Grafana:${NC}        http://${SERVER_IP}:3001"
    fi
    
    echo ""
    echo -e "${YELLOW}Учётные данные сохранены в:${NC}"
    echo "  $INSTALL_DIR/CREDENTIALS.txt"
    echo ""
    echo -e "${BLUE}Полезные команды:${NC}"
    echo "  cd $INSTALL_DIR"
    echo "  docker compose -f $COMPOSE_FILE ps          # Статус"
    echo "  docker compose -f $COMPOSE_FILE logs -f     # Логи"
    echo "  docker compose -f $COMPOSE_FILE restart     # Перезапуск"
    echo ""
    
    if [ "$WITH_GITOPS" = true ]; then
        echo -e "${BLUE}GitHub Webhook:${NC}"
        echo "  URL: http://${SERVER_IP}:8080/webhook"
        echo "  Secret: см. CREDENTIALS.txt"
        echo ""
    fi
}

# ============================================
# MAIN
# ============================================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     SCOLIOLOGIC WIKI - АВТОМАТИЧЕСКАЯ УСТАНОВКА              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Конфигурация:"
echo "  - Ollama (AI):    $WITH_OLLAMA"
echo "  - Мониторинг:     $WITH_MONITORING"
echo "  - GitOps Agent:   $WITH_GITOPS"
echo "  - Traefik:        $WITH_TRAEFIK"
echo "  - Чистая установка: $CLEAN_INSTALL"
echo ""

check_root
install_dependencies
install_docker
cleanup_old
clone_repo
generate_env
start_services
wait_for_health
show_summary

echo -e "${GREEN}Готово!${NC}"
