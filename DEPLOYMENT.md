# Scoliologic Wiki — Руководство по развёртыванию

Данное руководство описывает процесс развёртывания Scoliologic Wiki на собственном сервере с использованием Docker, Traefik и MinIO (S3-совместимое хранилище).

## Быстрая автоматическая установка

```bash
curl -fsSL https://raw.githubusercontent.com/sileade/scoliologic-wiki/main/deploy/scripts/install.sh | sudo bash
```

Скрипт автоматически установит Docker, клонирует репозиторий, настроит переменные окружения и запустит все сервисы.

## Требования к серверу

Минимальные требования для комфортной работы приложения представлены в таблице ниже.

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| CPU | 2 ядра | 4 ядра |
| RAM | 4 GB | 8 GB |
| Диск | 20 GB SSD | 50 GB SSD |
| ОС | Debian 11+ / Ubuntu 22.04+ | Debian 12 |
| Docker | 24.0+ | Последняя версия |
| Docker Compose | 2.20+ | Последняя версия |

Для использования AI-функций (Ollama) рекомендуется наличие NVIDIA GPU с минимум 8 GB VRAM.

## Ручная установка

Процесс развёртывания состоит из нескольких простых шагов. Сначала клонируйте репозиторий на сервер и перейдите в директорию проекта.

```bash
git clone https://github.com/sileade/scoliologic-wiki.git
cd scoliologic-wiki
```

Скопируйте файл с примером переменных окружения и отредактируйте его, указав ваш домен и пароли.

```bash
cp .env.example .env
nano .env
```

Запустите сервисы с нужными профилями.

```bash
# Базовый запуск
docker compose -f docker-compose.full.yml up -d

# С мониторингом
docker compose -f docker-compose.full.yml --profile monitoring up -d

# С GitOps и мониторингом
docker compose -f docker-compose.full.yml --profile gitops --profile monitoring up -d

# Всё включено
docker compose -f docker-compose.full.yml --profile all up -d
```

После завершения приложение будет доступно по адресу `https://ваш-домен`.

## Профили Docker Compose

Система использует профили для модульного запуска компонентов.

| Профиль | Компоненты | Описание |
|---------|------------|----------|
| (default) | app, postgres, redis, minio | Базовые сервисы |
| `ollama` | ollama, ollama-init | Локальный AI (требуется GPU) |
| `traefik` | traefik | Reverse proxy с SSL |
| `monitoring` | prometheus, grafana, alertmanager, redis-exporter | Мониторинг |
| `ha` | redis-replica-*, redis-sentinel-* | Высокая доступность Redis |
| `gitops` | pull-agent | Автоматическое обновление из GitHub |
| `backup` | backup | Автоматическое резервное копирование |
| `all` | Все компоненты | Полная установка |

## Структура сервисов

Развёртывание включает следующие компоненты, каждый из которых выполняет определённую роль в системе.

| Сервис | Порт | Описание |
|--------|------|----------|
| wiki-app | 3000 | Основное приложение |
| wiki-mysql | 3306 | База данных MySQL 8.0 |
| wiki-minio | 9000/9001 | S3 хранилище (API/Console) |
| wiki-traefik | 80/443/8080 | Reverse proxy с SSL |
| wiki-ollama | 11434 | AI модели (опционально) |

## Настройка переменных окружения

Файл `.env` содержит все необходимые настройки для работы приложения. Обязательные параметры, которые необходимо изменить перед запуском, включают домен, email для SSL-сертификатов и пароли для базы данных и хранилища.

```bash
# Домен и SSL
DOMAIN=wiki.example.com
ACME_EMAIL=admin@example.com

# База данных
MYSQL_ROOT_PASSWORD=сильный-пароль-root
MYSQL_PASSWORD=сильный-пароль-пользователя

# S3 хранилище
MINIO_ROOT_PASSWORD=сильный-пароль-minio

# JWT секрет (сгенерируйте командой: openssl rand -base64 32)
JWT_SECRET=ваш-секретный-ключ
```

## Настройка DNS

Для корректной работы SSL-сертификатов необходимо настроить DNS-записи для вашего домена. Создайте следующие A-записи, указывающие на IP-адрес вашего сервера.

| Запись | Тип | Значение |
|--------|-----|----------|
| wiki.example.com | A | IP сервера |
| traefik.wiki.example.com | A | IP сервера |
| minio.wiki.example.com | A | IP сервера |
| s3.wiki.example.com | A | IP сервера |

## Управление сервисами

После развёртывания доступны стандартные команды Docker Compose для управления сервисами. Для просмотра логов в реальном времени используйте команду с флагом `-f`.

```bash
# Просмотр логов
docker compose -f docker-compose.production.yml logs -f

# Статус сервисов
docker compose -f docker-compose.production.yml ps

# Перезапуск
docker compose -f docker-compose.production.yml restart

# Остановка
docker compose -f docker-compose.production.yml down

# Обновление
git pull
docker compose -f docker-compose.production.yml build app
docker compose -f docker-compose.production.yml up -d
```

## Резервное копирование

Регулярное резервное копирование критически важно для сохранности данных.

### Автоматическое резервное копирование

Включите профиль `backup` для автоматического бэкапа по расписанию:

```bash
docker compose -f docker-compose.full.yml --profile backup up -d
```

### Ручное резервное копирование

```bash
# Полный бэкап
./deploy/scripts/backup.sh

# Только база данных
./deploy/scripts/backup.sh --db-only

# Только файлы
./deploy/scripts/backup.sh --files-only
```

### Восстановление из бэкапа

```bash
# Показать доступные бэкапы
./deploy/scripts/restore.sh --list

# Восстановить
./deploy/scripts/restore.sh /var/backups/scoliologic-wiki/wiki-backup-20260116_120000.tar.gz
```

## GitOps Pull Agent

Pull Agent автоматически обновляет приложение при изменениях в GitHub репозитории.

### Включение

```bash
docker compose -f docker-compose.full.yml --profile gitops up -d
```

### Настройка в .env

```env
GIT_REPO_URL=https://github.com/sileade/scoliologic-wiki.git
GIT_BRANCH=main
GIT_TOKEN=ghp_xxx  # для приватных репозиториев
PULL_INTERVAL=300  # секунды
ROLLBACK_ON_FAILURE=true
```

### Веб-интерфейс

Pull Agent предоставляет веб-интерфейс на порту 8080 с информацией о статусе и истории деплоев.

Подробнее: [GITOPS.md](GITOPS.md)

## Мониторинг

Traefik предоставляет встроенные метрики в формате Prometheus, доступные по адресу `http://localhost:8080/metrics`. Для полноценного мониторинга рекомендуется интеграция с Prometheus и Grafana.

Панель управления Traefik доступна по адресу `https://traefik.ваш-домен` и предоставляет информацию о маршрутах, сервисах и сертификатах.

## Развёртывание в Proxmox LXC

Для быстрого развёртывания в Proxmox LXC контейнере выполните следующие шаги. Создайте контейнер на базе Debian 12 с минимум 4 GB RAM и 20 GB диска.

```bash
# В Proxmox создайте LXC контейнер
pct create 100 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname wiki \
  --memory 4096 \
  --cores 2 \
  --rootfs local-lvm:20 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --features nesting=1

# Запустите контейнер
pct start 100

# Войдите в контейнер
pct enter 100

# Установите Docker
curl -fsSL https://get.docker.com | sh

# Клонируйте и разверните
git clone https://github.com/your-org/scoliologic-wiki.git
cd scoliologic-wiki
cp .env.production.example .env
nano .env
./deploy.sh
```

## Устранение неполадок

При возникновении проблем проверьте логи соответствующего сервиса. Наиболее частые проблемы связаны с неправильной настройкой DNS или недостаточными правами доступа.

| Проблема | Решение |
|----------|---------|
| SSL сертификат не выдаётся | Проверьте DNS записи и доступность порта 80 |
| Ошибка подключения к БД | Проверьте пароли в .env и статус mysql контейнера |
| MinIO недоступен | Проверьте права доступа к volume minio_data |
| Ollama не запускается | Убедитесь в наличии NVIDIA драйверов и nvidia-container-toolkit |

## Безопасность

Для production-окружения рекомендуется выполнить дополнительные меры безопасности. Измените все пароли по умолчанию, настройте файрвол для ограничения доступа к портам 3306 и 9000, и регулярно обновляйте Docker образы.

---

*Документация подготовлена для Scoliologic Wiki v1.0*
