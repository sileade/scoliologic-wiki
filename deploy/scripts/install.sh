#!/bin/bash
#
# Scoliologic Wiki - Автоматическая установка
# 
# Этот скрипт выполняет полную установку системы:
# 1. Проверяет и устанавливает Docker и Docker Compose
# 2. Клонирует репозиторий
# 3. Настраивает переменные окружения
# 4. Запускает все сервисы
#
# Использование:
#   curl -fsSL https://raw.githubusercontent.com/sileade/scoliologic-wiki/main/deploy/scripts/install.sh | bash
#   или
#   wget -qO- https://raw.githubusercontent.com/sileade/scoliologic-wiki/main/deploy/scripts/install.sh | bash
#

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Конфигурация по умолчанию
INSTALL_DIR="${INSTALL_DIR:-/opt/scoliologic-wiki}"
REPO_URL="${REPO_URL:-https://github.com/sileade/scoliologic-wiki.git}"
BRANCH="${BRANCH:-main}"

# Функции вывода
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Баннер
print_banner() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                               ║${NC}"
    echo -e "${BLUE}║${NC}         ${GREEN}Scoliologic Wiki - Автоматическая установка${NC}          ${BLUE}║${NC}"
    echo -e "${BLUE}║                                                               ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Проверка root прав
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Этот скрипт требует права root. Запустите с sudo."
        exit 1
    fi
}

# Определение ОС
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "Не удалось определить операционную систему"
        exit 1
    fi
    
    log_info "Обнаружена ОС: $OS $VERSION"
}

# Установка Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker уже установлен: $(docker --version)"
        return 0
    fi
    
    log_info "Установка Docker..."
    
    case $OS in
        ubuntu|debian)
            apt-get update
            apt-get install -y ca-certificates curl gnupg lsb-release
            
            # Добавляем GPG ключ Docker
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            
            # Добавляем репозиторий
            echo \
                "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
                $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            apt-get update
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        centos|rhel|fedora)
            yum install -y yum-utils
            yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
        *)
            log_error "Неподдерживаемая ОС: $OS"
            exit 1
            ;;
    esac
    
    # Запускаем Docker
    systemctl start docker
    systemctl enable docker
    
    log_success "Docker установлен успешно"
}

# Установка дополнительных зависимостей
install_dependencies() {
    log_info "Установка дополнительных зависимостей..."
    
    case $OS in
        ubuntu|debian)
            apt-get install -y git curl jq htop
            ;;
        centos|rhel|fedora)
            yum install -y git curl jq htop
            ;;
    esac
    
    log_success "Зависимости установлены"
}

# Клонирование репозитория
clone_repository() {
    if [ -d "$INSTALL_DIR" ]; then
        log_warn "Директория $INSTALL_DIR уже существует"
        read -p "Удалить и клонировать заново? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            rm -rf "$INSTALL_DIR"
        else
            log_info "Используем существующую директорию"
            return 0
        fi
    fi
    
    log_info "Клонирование репозитория..."
    git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    
    log_success "Репозиторий клонирован в $INSTALL_DIR"
}

# Генерация случайных паролей
generate_password() {
    openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32
}

# Настройка переменных окружения
configure_environment() {
    log_info "Настройка переменных окружения..."
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        log_warn "Файл .env уже существует"
        read -p "Перезаписать? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            return 0
        fi
    fi
    
    # Интерактивная настройка
    echo ""
    echo -e "${BLUE}=== Настройка системы ===${NC}"
    echo ""
    
    # Домен
    read -p "Введите домен для Wiki (например, wiki.example.com): " WIKI_DOMAIN
    WIKI_DOMAIN=${WIKI_DOMAIN:-wiki.localhost}
    
    # Email для Let's Encrypt
    read -p "Введите email для SSL сертификатов: " LETSENCRYPT_EMAIL
    LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-admin@example.com}
    
    # Пароли
    DB_PASSWORD=$(generate_password)
    JWT_SECRET=$(generate_password)
    MINIO_PASSWORD=$(generate_password)
    GRAFANA_PASSWORD=$(generate_password)
    
    # Ollama
    echo ""
    echo "Настройка AI (Ollama):"
    echo "1) Использовать локальный Ollama (требуется GPU)"
    echo "2) Использовать внешний Ollama сервер"
    read -p "Выберите вариант (1/2): " OLLAMA_CHOICE
    
    if [ "$OLLAMA_CHOICE" = "2" ]; then
        read -p "Введите URL внешнего Ollama (например, http://10.0.0.229:11434): " OLLAMA_BASE_URL
        OLLAMA_PROFILE=""
    else
        OLLAMA_BASE_URL="http://ollama:11434"
        OLLAMA_PROFILE="ollama"
    fi
    
    # Профили
    echo ""
    echo "Дополнительные компоненты:"
    read -p "Включить мониторинг (Prometheus, Grafana)? (y/N): " ENABLE_MONITORING
    read -p "Включить высокую доступность Redis (Sentinel)? (y/N): " ENABLE_HA
    read -p "Включить GitOps Pull Agent? (y/N): " ENABLE_GITOPS
    
    PROFILES=""
    [ "$OLLAMA_PROFILE" = "ollama" ] && PROFILES="$PROFILES ollama"
    [ "$ENABLE_MONITORING" = "y" ] || [ "$ENABLE_MONITORING" = "Y" ] && PROFILES="$PROFILES monitoring"
    [ "$ENABLE_HA" = "y" ] || [ "$ENABLE_HA" = "Y" ] && PROFILES="$PROFILES ha"
    [ "$ENABLE_GITOPS" = "y" ] || [ "$ENABLE_GITOPS" = "Y" ] && PROFILES="$PROFILES gitops"
    
    # GitOps настройки
    if [ "$ENABLE_GITOPS" = "y" ] || [ "$ENABLE_GITOPS" = "Y" ]; then
        read -p "GitHub Token (для приватных репозиториев, опционально): " GIT_TOKEN
        read -p "Интервал проверки обновлений в секундах (по умолчанию 300): " PULL_INTERVAL
        PULL_INTERVAL=${PULL_INTERVAL:-300}
    fi
    
    # Уведомления
    echo ""
    echo "Настройка уведомлений (опционально):"
    read -p "Telegram Bot Token: " TELEGRAM_BOT_TOKEN
    read -p "Telegram Chat ID: " TELEGRAM_CHAT_ID
    read -p "Slack Webhook URL: " SLACK_WEBHOOK_URL
    
    # Создаём .env файл
    cat > "$ENV_FILE" << EOF
# Scoliologic Wiki - Environment Configuration
# Generated: $(date)

# ===========================================
# ОСНОВНЫЕ НАСТРОЙКИ
# ===========================================

# Домен и SSL
WIKI_DOMAIN=${WIKI_DOMAIN}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL}

# Часовой пояс
TZ=Europe/Moscow

# ===========================================
# БАЗА ДАННЫХ (PostgreSQL)
# ===========================================

DB_NAME=scoliologic_wiki
DB_USER=wiki
DB_PASSWORD=${DB_PASSWORD}

# ===========================================
# АУТЕНТИФИКАЦИЯ
# ===========================================

JWT_SECRET=${JWT_SECRET}

# Manus OAuth (заполните после регистрации приложения)
VITE_APP_ID=
VITE_APP_TITLE=Scoliologic Wiki
VITE_APP_LOGO=
OAUTH_SERVER_URL=
VITE_OAUTH_PORTAL_URL=
OWNER_OPEN_ID=
OWNER_NAME=

# ===========================================
# S3 ХРАНИЛИЩЕ (MinIO)
# ===========================================

MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
AWS_S3_BUCKET=wiki-storage
AWS_REGION=us-east-1

# ===========================================
# AI (Ollama)
# ===========================================

OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=llama3.1:70b

# ===========================================
# МОНИТОРИНГ
# ===========================================

GRAFANA_USER=admin
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}
GRAFANA_ROOT_URL=http://grafana.${WIKI_DOMAIN}

# ===========================================
# GITOPS
# ===========================================

GIT_REPO_URL=${REPO_URL}
GIT_BRANCH=${BRANCH}
GIT_TOKEN=${GIT_TOKEN}
PULL_INTERVAL=${PULL_INTERVAL:-300}
ROLLBACK_ON_FAILURE=true
KEEP_BACKUPS=5

# ===========================================
# УВЕДОМЛЕНИЯ
# ===========================================

TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}

# ===========================================
# ПРОФИЛИ DOCKER COMPOSE
# ===========================================

COMPOSE_PROFILES=${PROFILES}
EOF

    chmod 600 "$ENV_FILE"
    
    log_success "Файл .env создан"
    
    # Показываем важные пароли
    echo ""
    echo -e "${YELLOW}=== ВАЖНО: Сохраните эти пароли! ===${NC}"
    echo ""
    echo "База данных:"
    echo "  Пользователь: wiki"
    echo "  Пароль: ${DB_PASSWORD}"
    echo ""
    echo "MinIO S3:"
    echo "  Пользователь: minioadmin"
    echo "  Пароль: ${MINIO_PASSWORD}"
    echo ""
    echo "Grafana:"
    echo "  Пользователь: admin"
    echo "  Пароль: ${GRAFANA_PASSWORD}"
    echo ""
}

# Создание необходимых директорий
create_directories() {
    log_info "Создание директорий..."
    
    mkdir -p "$INSTALL_DIR/deploy/traefik/dynamic"
    mkdir -p "$INSTALL_DIR/deploy/grafana/provisioning/datasources"
    mkdir -p "$INSTALL_DIR/deploy/grafana/provisioning/dashboards"
    mkdir -p "$INSTALL_DIR/deploy/grafana/dashboards"
    mkdir -p "$INSTALL_DIR/deploy/prometheus"
    mkdir -p "$INSTALL_DIR/deploy/alertmanager"
    mkdir -p "$INSTALL_DIR/deploy/redis"
    
    log_success "Директории созданы"
}

# Создание init-extensions.sql для PostgreSQL
create_init_files() {
    log_info "Создание файлов инициализации..."
    
    # PostgreSQL extensions
    cat > "$INSTALL_DIR/deploy/init-extensions.sql" << 'EOF'
-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
EOF

    # Redis Sentinel config
    cat > "$INSTALL_DIR/deploy/redis/sentinel.conf" << 'EOF'
sentinel monitor mymaster redis 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
EOF

    # Prometheus config
    cat > "$INSTALL_DIR/deploy/prometheus/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

rule_files:
  - /etc/prometheus/alerts.yml

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'traefik'
    static_configs:
      - targets: ['traefik:8080']

  - job_name: 'wiki-app'
    static_configs:
      - targets: ['app:3000']
    metrics_path: /api/metrics
EOF

    # Prometheus alerts
    cat > "$INSTALL_DIR/deploy/prometheus/alerts.yml" << 'EOF'
groups:
  - name: wiki-alerts
    rules:
      - alert: AppDown
        expr: up{job="wiki-app"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Wiki application is down"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes{job="wiki-app"} > 1073741824
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"

      - alert: RedisDown
        expr: up{job="redis"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis is down"

      - alert: HighRedisCacheMiss
        expr: redis_keyspace_hits_total / (redis_keyspace_hits_total + redis_keyspace_misses_total) < 0.5
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Redis cache hit ratio is below 50%"
EOF

    # Alertmanager config
    cat > "$INSTALL_DIR/deploy/alertmanager/alertmanager.yml" << 'EOF'
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'

receivers:
  - name: 'default'
    # Configure your notification channels here
EOF

    # Grafana datasources
    cat > "$INSTALL_DIR/deploy/grafana/provisioning/datasources/datasources.yml" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Redis
    type: redis-datasource
    access: proxy
    url: redis://redis:6379
EOF

    # Grafana dashboard provisioning
    cat > "$INSTALL_DIR/deploy/grafana/provisioning/dashboards/dashboards.yml" << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
EOF

    log_success "Файлы инициализации созданы"
}

# Запуск сервисов
start_services() {
    log_info "Запуск сервисов..."
    
    cd "$INSTALL_DIR"
    
    # Загружаем переменные окружения
    set -a
    source .env
    set +a
    
    # Собираем и запускаем
    docker compose -f docker-compose.full.yml build
    docker compose -f docker-compose.full.yml up -d
    
    log_success "Сервисы запущены"
}

# Проверка здоровья сервисов
check_health() {
    log_info "Проверка здоровья сервисов..."
    
    echo ""
    echo "Ожидание запуска сервисов (это может занять несколько минут)..."
    
    # Ждём до 5 минут
    for i in {1..60}; do
        if docker compose -f "$INSTALL_DIR/docker-compose.full.yml" ps | grep -q "healthy"; then
            break
        fi
        echo -n "."
        sleep 5
    done
    echo ""
    
    # Показываем статус
    cd "$INSTALL_DIR"
    docker compose -f docker-compose.full.yml ps
    
    log_success "Проверка завершена"
}

# Вывод информации после установки
print_summary() {
    # Загружаем переменные
    source "$INSTALL_DIR/.env"
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}║${NC}              ${BLUE}Установка завершена успешно!${NC}                   ${GREEN}║${NC}"
    echo -e "${GREEN}║                                                               ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Доступные сервисы:${NC}"
    echo ""
    echo "  Wiki:        https://${WIKI_DOMAIN}"
    echo "  MinIO:       https://${WIKI_DOMAIN}:9001"
    
    if [[ "$COMPOSE_PROFILES" == *"monitoring"* ]]; then
        echo "  Grafana:     https://grafana.${WIKI_DOMAIN}"
        echo "  Prometheus:  https://prometheus.${WIKI_DOMAIN}"
    fi
    
    if [[ "$COMPOSE_PROFILES" == *"gitops"* ]]; then
        echo "  Pull Agent:  http://localhost:8080"
    fi
    
    echo ""
    echo -e "${BLUE}Полезные команды:${NC}"
    echo ""
    echo "  cd $INSTALL_DIR"
    echo "  docker compose -f docker-compose.full.yml logs -f app     # Логи приложения"
    echo "  docker compose -f docker-compose.full.yml ps              # Статус сервисов"
    echo "  docker compose -f docker-compose.full.yml restart app     # Перезапуск"
    echo "  docker compose -f docker-compose.full.yml down            # Остановка"
    echo ""
    echo -e "${YELLOW}Следующие шаги:${NC}"
    echo ""
    echo "  1. Настройте DNS записи для домена ${WIKI_DOMAIN}"
    echo "  2. Зарегистрируйте OAuth приложение и обновите .env"
    echo "  3. Перезапустите сервисы: docker compose -f docker-compose.full.yml up -d"
    echo ""
}

# Создание systemd сервиса
create_systemd_service() {
    log_info "Создание systemd сервиса..."
    
    cat > /etc/systemd/system/scoliologic-wiki.service << EOF
[Unit]
Description=Scoliologic Wiki
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.full.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.full.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable scoliologic-wiki.service
    
    log_success "Systemd сервис создан и включён"
}

# Основная функция
main() {
    print_banner
    check_root
    detect_os
    install_docker
    install_dependencies
    clone_repository
    create_directories
    create_init_files
    configure_environment
    start_services
    create_systemd_service
    check_health
    print_summary
}

# Запуск
main "$@"
