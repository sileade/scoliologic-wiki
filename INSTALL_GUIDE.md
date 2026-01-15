# Scoliologic Wiki — Пошаговая установка на Debian 13

Данное руководство описывает установку Scoliologic Wiki на чистый Debian 13 с подключением к существующим сервисам MinIO, Traefik и Ollama.

## Исходные данные

| Параметр | Значение |
|----------|----------|
| Домен | wiki.sclg.io |
| Email для SSL | admin@scoliologic.ru |
| IP сервера | 45.144.43.92 |
| MinIO | существующий |
| Traefik | существующий |
| Ollama | существующий |
| Авторизация | отключена |

---

## Шаг 1: Подготовка сервера

Подключитесь к серверу по SSH и выполните обновление системы.

```bash
ssh root@45.144.43.92
```

```bash
apt update && apt upgrade -y
```

**Проверка версии Debian:**
```bash
cat /etc/os-release | grep VERSION
```
Ожидаемый результат: `VERSION="13 (trixie)"` или аналогичный.

---

## Шаг 2: Установка Docker

Установите Docker и Docker Compose, если они ещё не установлены.

```bash
# Проверка наличия Docker
docker --version
```

Если Docker не установлен:
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

**Проверка работы Docker:**
```bash
docker run hello-world
```

---

## Шаг 3: Проверка существующих сервисов

### 3.1 Проверка Traefik

Выполните команду для поиска контейнера Traefik:
```bash
docker ps | grep -i traefik
```

Запишите **название контейнера** и **network**:
```bash
docker inspect <traefik_container_name> --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

**Проверка API Traefik:**
```bash
curl -s http://localhost:8080/api/overview | head -20
```

Если API недоступен, проверьте порт:
```bash
docker port <traefik_container_name>
```

**Запишите данные:**
- Traefik API URL: `http://localhost:8080` или `http://<container_ip>:8080`
- Docker network: _______________

---

### 3.2 Проверка MinIO

Найдите контейнер MinIO:
```bash
docker ps | grep -i minio
```

**Проверка доступности MinIO API:**
```bash
curl -s http://localhost:9000/minio/health/live
```
Ожидаемый ответ: пустой ответ с кодом 200.

**Получение данных доступа MinIO:**
```bash
docker inspect <minio_container_name> --format='{{range .Config.Env}}{{println .}}{{end}}' | grep -E "MINIO_ROOT"
```

Это покажет `MINIO_ROOT_USER` и `MINIO_ROOT_PASSWORD`.

**Проверка существующих buckets:**
```bash
# Если установлен mc (MinIO Client)
mc alias set myminio http://localhost:9000 <access_key> <secret_key>
mc ls myminio
```

Или через Docker:
```bash
docker exec <minio_container_name> mc ls local
```

**Запишите данные:**
- MinIO Endpoint: `http://localhost:9000` или `http://<container_ip>:9000`
- Access Key: _______________
- Secret Key: _______________
- Bucket (создадим новый): `scoliologic-wiki`

---

### 3.3 Проверка Ollama

Найдите контейнер Ollama:
```bash
docker ps | grep -i ollama
```

**Проверка API Ollama:**
```bash
curl -s http://localhost:11434/api/tags | jq .
```

Это покажет список установленных моделей.

**Проверка конкретных моделей:**
```bash
# Для embeddings
curl -s http://localhost:11434/api/tags | jq '.models[].name' | grep -E "nomic|embed"

# Для LLM
curl -s http://localhost:11434/api/tags | jq '.models[].name' | grep -E "mistral|llama|gemma"
```

**Запишите данные:**
- Ollama URL: `http://localhost:11434` или `http://<container_ip>:11434`
- Embedding модель: _______________
- LLM модель: _______________

---

## Шаг 4: Проверка Docker networks

Посмотрите все Docker networks:
```bash
docker network ls
```

Найдите network, в которой работают Traefik, MinIO и Ollama:
```bash
docker network inspect <network_name> --format='{{range .Containers}}{{.Name}} {{end}}'
```

**Важно:** Wiki должна быть в той же network, что и остальные сервисы.

---

## Шаг 5: Создание bucket в MinIO

Создайте bucket для Wiki:
```bash
# Через mc
mc mb myminio/scoliologic-wiki
mc anonymous set public myminio/scoliologic-wiki
```

Или через Docker:
```bash
docker run --rm --network=<minio_network> minio/mc \
  sh -c "mc alias set myminio http://<minio_container>:9000 <access_key> <secret_key> && \
         mc mb myminio/scoliologic-wiki --ignore-existing && \
         mc anonymous set public myminio/scoliologic-wiki"
```

**Проверка:**
```bash
mc ls myminio/scoliologic-wiki
```

---

## Шаг 6: Клонирование репозитория

```bash
cd /opt
git clone https://github.com/your-org/scoliologic-wiki.git
cd scoliologic-wiki
```

---

## Шаг 7: Создание конфигурации

Создайте файл `.env` с полученными данными:

```bash
cat > .env << 'EOF'
# Домен и SSL
DOMAIN=wiki.sclg.io
ACME_EMAIL=admin@scoliologic.ru

# База данных MySQL (новая)
MYSQL_ROOT_PASSWORD=<сгенерированный_пароль>
MYSQL_DATABASE=scoliologic_wiki
MYSQL_USER=wiki
MYSQL_PASSWORD=<сгенерированный_пароль>

# MinIO (существующий)
S3_ENDPOINT=http://<minio_container>:9000
S3_ACCESS_KEY=<ваш_access_key>
S3_SECRET_KEY=<ваш_secret_key>
S3_BUCKET=scoliologic-wiki
S3_REGION=us-east-1
S3_PUBLIC_URL=https://s3.sclg.io

# Traefik (существующий)
TRAEFIK_API_URL=http://<traefik_container>:8080

# Ollama (существующий)
OLLAMA_BASE_URL=http://<ollama_container>:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=mistral

# JWT
JWT_SECRET=$(openssl rand -base64 32)

# Приложение
VITE_APP_TITLE=Scoliologic Wiki
DISABLE_AUTH=true
EOF
```

**Генерация паролей:**
```bash
# Пароль для MySQL root
openssl rand -base64 24

# Пароль для MySQL user
openssl rand -base64 24

# JWT Secret
openssl rand -base64 32
```

---

## Шаг 8: Настройка docker-compose для существующих сервисов

Используйте специальный docker-compose файл:

```bash
cat > docker-compose.external.yml << 'EOF'
version: '3.8'

services:
  # MySQL Database (новый)
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
    networks:
      - <existing_network>
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Wiki Application
  app:
    build:
      context: .
      dockerfile: ./deploy/Dockerfile
    container_name: wiki-app
    restart: unless-stopped
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
    depends_on:
      mysql:
        condition: service_healthy
    networks:
      - <existing_network>
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.wiki.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.wiki.entrypoints=websecure"
      - "traefik.http.routers.wiki.tls.certresolver=letsencrypt"
      - "traefik.http.services.wiki.loadbalancer.server.port=3000"

networks:
  <existing_network>:
    external: true

volumes:
  mysql_data:
EOF
```

**Замените `<existing_network>` на реальное название network!**

---

## Шаг 9: Сборка и запуск

```bash
# Сборка образа
docker compose -f docker-compose.external.yml build app

# Запуск
docker compose -f docker-compose.external.yml up -d

# Проверка логов
docker compose -f docker-compose.external.yml logs -f
```

---

## Шаг 10: Проверка работы

**Проверка контейнеров:**
```bash
docker compose -f docker-compose.external.yml ps
```

**Проверка доступности:**
```bash
curl -I https://wiki.sclg.io
```

**Проверка в браузере:**
Откройте https://wiki.sclg.io

---

## Устранение неполадок

| Проблема | Команда диагностики | Решение |
|----------|---------------------|---------|
| Контейнер не запускается | `docker logs wiki-app` | Проверьте переменные окружения |
| Нет доступа к MinIO | `curl http://<minio>:9000/minio/health/live` | Проверьте network и endpoint |
| Traefik не видит сервис | `curl http://localhost:8080/api/http/routers` | Проверьте labels и network |
| Ошибка БД | `docker logs wiki-mysql` | Проверьте пароли |

---

## Следующий шаг

После успешной установки сообщите мне результаты проверок из Шагов 3.1-3.3, и я создам готовый `.env` файл с вашими данными.
