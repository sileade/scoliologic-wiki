# Scoliologic Wiki — Руководство по развёртыванию

Данное руководство описывает процесс развёртывания Scoliologic Wiki на собственном сервере с использованием Docker, Traefik и MinIO (S3-совместимое хранилище).

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

## Быстрый старт

Процесс развёртывания состоит из нескольких простых шагов. Сначала клонируйте репозиторий на сервер и перейдите в директорию проекта.

```bash
git clone https://github.com/your-org/scoliologic-wiki.git
cd scoliologic-wiki
```

Скопируйте файл с примером переменных окружения и отредактируйте его, указав ваш домен и пароли.

```bash
cp .env.production.example .env
nano .env
```

Запустите скрипт развёртывания, который автоматически соберёт образы и запустит все сервисы.

```bash
./deploy.sh
```

После завершения скрипта приложение будет доступно по адресу `https://ваш-домен`.

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

Регулярное резервное копирование критически важно для сохранности данных. Рекомендуется создавать резервные копии базы данных и S3 хранилища ежедневно.

```bash
# Резервная копия базы данных
docker compose -f docker-compose.production.yml exec mysql \
  mysqldump -u wiki -p scoliologic_wiki > backup-$(date +%Y%m%d).sql

# Резервная копия S3 данных
docker compose -f docker-compose.production.yml exec minio \
  mc mirror /data /backup
```

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
