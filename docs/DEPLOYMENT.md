# Scoliologic Wiki — Руководство по развёртыванию

**Версия:** 1.0.0  
**Дата:** 14 января 2026  
**Автор:** Manus AI

---

## Содержание

1. [Требования к системе](#требования-к-системе)
2. [Переменные окружения](#переменные-окружения)
3. [Развёртывание через Manus Platform](#развёртывание-через-manus-platform)
4. [Развёртывание на Debian/Ubuntu](#развёртывание-на-debianubuntu)
5. [Развёртывание в Proxmox LXC](#развёртывание-в-proxmox-lxc)
6. [Развёртывание в Docker](#развёртывание-в-docker)
7. [Настройка базы данных](#настройка-базы-данных)
8. [Настройка обратного прокси](#настройка-обратного-прокси)
9. [Мониторинг и логирование](#мониторинг-и-логирование)
10. [Обновление системы](#обновление-системы)

---

## Требования к системе

### Минимальные требования

| Компонент | Требование |
|-----------|------------|
| ОС | Debian 11+, Ubuntu 22.04+ |
| Node.js | 22.x LTS |
| RAM | 2 GB |
| Диск | 10 GB SSD |
| CPU | 2 vCPU |

### Рекомендуемые требования

| Компонент | Требование |
|-----------|------------|
| ОС | Debian 12, Ubuntu 24.04 |
| Node.js | 22.x LTS |
| RAM | 4 GB |
| Диск | 20 GB SSD |
| CPU | 4 vCPU |

---

## Переменные окружения

### Обязательные переменные

| Переменная | Описание | Пример |
|------------|----------|--------|
| `DATABASE_URL` | Строка подключения к MySQL/TiDB | `mysql://user:pass@host:3306/db` |
| `JWT_SECRET` | Секрет для подписи JWT токенов | `your-secret-key-min-32-chars` |
| `VITE_APP_ID` | ID приложения Manus OAuth | `app_xxxxx` |
| `OAUTH_SERVER_URL` | URL сервера OAuth | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | URL портала авторизации | `https://auth.manus.im` |

### Опциональные переменные

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт сервера | `3000` |
| `NODE_ENV` | Окружение | `production` |
| `VITE_APP_TITLE` | Название приложения | `Scoliologic Wiki` |
| `VITE_APP_LOGO` | URL логотипа | - |

### Переменные Manus Forge API

| Переменная | Описание |
|------------|----------|
| `BUILT_IN_FORGE_API_URL` | URL Manus Forge API |
| `BUILT_IN_FORGE_API_KEY` | API ключ (серверный) |
| `VITE_FRONTEND_FORGE_API_KEY` | API ключ (клиентский) |
| `VITE_FRONTEND_FORGE_API_URL` | URL API для фронтенда |

---

## Развёртывание через Manus Platform

Рекомендуемый способ развёртывания для пользователей Manus Platform.

### Шаги развёртывания

1. Откройте проект в Manus Platform
2. Нажмите кнопку **Publish** в правом верхнем углу
3. Выберите домен или настройте собственный
4. Дождитесь завершения деплоя

Все переменные окружения настраиваются автоматически.

---

## Развёртывание на Debian/Ubuntu

### Подготовка системы

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Установка pnpm
npm install -g pnpm

# Установка PM2 для управления процессами
npm install -g pm2
```

### Клонирование и сборка

```bash
# Клонирование репозитория
git clone https://github.com/sileade/scoliologic-wiki.git
cd scoliologic-wiki

# Установка зависимостей
pnpm install

# Создание файла окружения
cp .env.example .env
nano .env  # Настройте переменные

# Сборка проекта
pnpm build

# Применение миграций БД
pnpm db:push
```

### Запуск через PM2

```bash
# Запуск приложения
pm2 start dist/index.js --name scoliologic-wiki

# Автозапуск при перезагрузке
pm2 startup
pm2 save

# Просмотр логов
pm2 logs scoliologic-wiki
```

---

## Развёртывание в Proxmox LXC

### Создание контейнера

```bash
# Создание LXC контейнера (на хосте Proxmox)
pct create 100 local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst \
  --hostname scoliologic-wiki \
  --memory 2048 \
  --cores 2 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --storage local-lvm \
  --rootfs local-lvm:10

# Запуск контейнера
pct start 100

# Вход в контейнер
pct enter 100
```

### Установка в контейнере

```bash
# Выполните шаги из раздела "Развёртывание на Debian/Ubuntu"
```

---

## Развёртывание в Docker

### Dockerfile

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Установка pnpm
RUN npm install -g pnpm

# Копирование файлов
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    restart: unless-stopped

  db:
    image: mysql:8
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
      - MYSQL_DATABASE=scoliologic_wiki
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  db_data:
```

### Запуск

```bash
docker-compose up -d
```

---

## Настройка базы данных

### MySQL 8.x

```sql
-- Создание базы данных
CREATE DATABASE scoliologic_wiki CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Создание пользователя
CREATE USER 'scoliologic'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON scoliologic_wiki.* TO 'scoliologic'@'%';
FLUSH PRIVILEGES;
```

### TiDB (рекомендуется для масштабирования)

Используйте TiDB Cloud или self-hosted TiDB. Строка подключения аналогична MySQL.

### Миграции

```bash
# Применение миграций
pnpm db:push

# Генерация миграций (при изменении схемы)
pnpm db:generate
```

---

## Настройка обратного прокси

### Nginx

```nginx
server {
    listen 80;
    server_name wiki.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wiki.example.com;

    ssl_certificate /etc/letsencrypt/live/wiki.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wiki.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```caddyfile
wiki.example.com {
    reverse_proxy localhost:3000
}
```

---

## Мониторинг и логирование

### PM2 мониторинг

```bash
# Статус процессов
pm2 status

# Мониторинг в реальном времени
pm2 monit

# Логи
pm2 logs scoliologic-wiki --lines 100
```

### Интеграция с Sentry

Проект включает Sentry SDK. Для активации добавьте:

```env
SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## Обновление системы

### Быстрое обновление

```bash
cd /path/to/scoliologic-wiki

# Получение обновлений
git pull origin main

# Установка новых зависимостей
pnpm install

# Пересборка
pnpm build

# Применение миграций (если есть)
pnpm db:push

# Перезапуск
pm2 restart scoliologic-wiki
```

### Скрипт автоматического обновления

Создайте файл `update.sh`:

```bash
#!/bin/bash
set -e

cd /path/to/scoliologic-wiki

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
pnpm install

echo "Building..."
pnpm build

echo "Running migrations..."
pnpm db:push

echo "Restarting application..."
pm2 restart scoliologic-wiki

echo "Update complete!"
```

---

## Поддержка

При возникновении проблем:

1. Проверьте логи: `pm2 logs scoliologic-wiki`
2. Проверьте статус БД: `pnpm db:studio`
3. Создайте issue на GitHub: https://github.com/sileade/scoliologic-wiki/issues

---

*Документация создана автоматически на основе анализа проекта.*
