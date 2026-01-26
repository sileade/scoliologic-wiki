# Scoliologic Wiki - Руководство по развертыванию

Данное руководство описывает процесс автоматического развертывания и обновления приложения Scoliologic Wiki.

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Скрипты развертывания](#скрипты-развертывания)
3. [Удалённое обновление через SSH](#удалённое-обновление-через-ssh)
4. [Автоматизация через Cron](#автоматизация-через-cron)
5. [Уведомления](#уведомления)
6. [Резервное копирование](#резервное-копирование)
7. [Откат изменений](#откат-изменений)
8. [Troubleshooting](#troubleshooting)

---

## Быстрый старт

### Обновление на сервере (одна команда)

```bash
ssh user@server "cd /opt/scoliologic-wiki && git pull && pnpm install && docker-compose restart app"
```

### Использование скрипта обновления

```bash
# На сервере
./deploy/update.sh update

# Удалённо
./deploy/remote-update.sh -h wiki.example.com update
```

---

## Скрипты развертывания

### deploy.sh - Первоначальное развертывание

Интерактивный скрипт для первоначальной установки приложения.

```bash
./deploy/deploy.sh
```

Скрипт запросит:
- Режим развертывания (новый Traefik или существующий)
- Конфигурацию Authentik
- Домен и email для Let's Encrypt
- Пароли для базы данных и MinIO

### update.sh - Обновление приложения

Скрипт для обновления работающего приложения с минимальным даунтаймом.

```bash
# Стандартное обновление
./deploy/update.sh update

# Принудительный перезапуск
./deploy/update.sh update --force

# Обновление без резервной копии
./deploy/update.sh update --no-backup

# Показать статус
./deploy/update.sh status

# Просмотр логов
./deploy/update.sh logs -f

# Перезапуск сервисов
./deploy/update.sh restart

# Создание резервной копии
./deploy/update.sh backup

# Откат к коммиту
./deploy/update.sh rollback abc1234
```

**Что делает update.sh:**

1. Создаёт резервную копию базы данных
2. Получает изменения из Git (`git pull`)
3. Устанавливает зависимости (если изменились)
4. Пересобирает Docker образ приложения
5. Перезапускает контейнер с минимальным даунтаймом
6. Выполняет миграции БД (если есть изменения в схеме)
7. Проверяет работоспособность приложения
8. При ошибке — автоматический откат

---

## Удалённое обновление через SSH

### remote-update.sh

Скрипт для запуска обновления на удалённом сервере.

```bash
# Обновление
./deploy/remote-update.sh -h wiki.example.com update

# С SSH ключом
./deploy/remote-update.sh -h wiki.example.com -k ~/.ssh/id_rsa update

# Другой пользователь и порт
./deploy/remote-update.sh -h wiki.example.com -u deploy -p 2222 update

# Просмотр статуса
./deploy/remote-update.sh -h wiki.example.com status

# Просмотр логов (в реальном времени)
./deploy/remote-update.sh -h wiki.example.com logs

# Открыть SSH сессию
./deploy/remote-update.sh -h wiki.example.com shell
```

### Настройка для быстрого использования

Добавьте в `~/.bashrc` или `~/.zshrc`:

```bash
# Конфигурация
export SSH_HOST="wiki.example.com"
export SSH_USER="deploy"
export SSH_KEY="~/.ssh/wiki_deploy"
export REMOTE_PATH="/opt/scoliologic-wiki"

# Алиасы
alias wiki-update="/path/to/remote-update.sh update"
alias wiki-status="/path/to/remote-update.sh status"
alias wiki-logs="/path/to/remote-update.sh logs"
alias wiki-restart="/path/to/remote-update.sh restart"
```

После этого можно использовать:

```bash
wiki-update    # Обновить приложение
wiki-status    # Показать статус
wiki-logs      # Просмотр логов
wiki-restart   # Перезапустить
```

---

## Автоматизация через Cron

### Автоматическая проверка обновлений

```bash
# Редактировать crontab
crontab -e

# Проверка обновлений каждые 5 минут
*/5 * * * * /opt/scoliologic-wiki/deploy/update.sh update >> /var/log/wiki-update.log 2>&1

# Ежедневное резервное копирование в 3:00
0 3 * * * /opt/scoliologic-wiki/deploy/update.sh backup >> /var/log/wiki-backup.log 2>&1

# Еженедельная очистка старых ресурсов (воскресенье в 4:00)
0 4 * * 0 docker system prune -f >> /var/log/docker-cleanup.log 2>&1
```

### Systemd Timer (альтернатива cron)

Создайте файл `/etc/systemd/system/wiki-update.service`:

```ini
[Unit]
Description=Scoliologic Wiki Auto Update
After=network.target docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/scoliologic-wiki
ExecStart=/opt/scoliologic-wiki/deploy/update.sh update
User=root

[Install]
WantedBy=multi-user.target
```

Создайте файл `/etc/systemd/system/wiki-update.timer`:

```ini
[Unit]
Description=Run Wiki Update every 5 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

Активируйте:

```bash
sudo systemctl daemon-reload
sudo systemctl enable wiki-update.timer
sudo systemctl start wiki-update.timer
```

---

## Уведомления

### Telegram

Установите переменные окружения:

```bash
export TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="-1001234567890"
```

Или добавьте в `.env` файл проекта.

### Slack

```bash
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
```

---

## Резервное копирование

### Автоматическое резервное копирование

Скрипт автоматически создаёт резервную копию БД перед каждым обновлением.

Резервные копии хранятся в: `./backups/`

Формат имени: `db_YYYYMMDD_HHMMSS.sql.gz`

### Ручное резервное копирование

```bash
# Через скрипт
./deploy/update.sh backup

# Напрямую через Docker
docker exec wiki-postgres pg_dump -U wiki scoliologic_wiki > backup.sql
gzip backup.sql
```

### Восстановление из резервной копии

```bash
# Распаковать
gunzip backup.sql.gz

# Восстановить
docker exec -i wiki-postgres psql -U wiki scoliologic_wiki < backup.sql
```

### Ротация резервных копий

Скрипт автоматически удаляет резервные копии старше 7 дней.

Для изменения количества хранимых копий, отредактируйте `update.sh`:

```bash
# Оставить последние 14 копий вместо 7
ls -t "${BACKUP_DIR}"/db_*.sql.gz | tail -n +15 | xargs -r rm
```

---

## Откат изменений

### Автоматический откат

При ошибке обновления скрипт автоматически откатывается к предыдущей версии.

### Ручной откат

```bash
# Откат к конкретному коммиту
./deploy/update.sh rollback abc1234

# Или вручную
cd /opt/scoliologic-wiki
git checkout abc1234
pnpm install
docker-compose restart app
```

### Просмотр истории коммитов

```bash
git log --oneline -20
```

---

## Troubleshooting

### Приложение не запускается после обновления

```bash
# Проверить логи
docker-compose logs app

# Проверить статус контейнеров
docker-compose ps

# Перезапустить все сервисы
docker-compose down && docker-compose up -d
```

### Ошибка подключения к базе данных

```bash
# Проверить статус PostgreSQL
docker exec wiki-postgres pg_isready -U wiki

# Проверить логи PostgreSQL
docker-compose logs postgres
```

### Недостаточно места на диске

```bash
# Очистить неиспользуемые Docker ресурсы
docker system prune -a -f

# Проверить использование диска
df -h
du -sh /var/lib/docker/
```

### Конфликты при git pull

```bash
# Сбросить локальные изменения
git reset --hard origin/main

# Или сохранить изменения
git stash
git pull
git stash pop
```

### Проблемы с SSL сертификатами

```bash
# Проверить статус Traefik
docker-compose logs traefik

# Проверить сертификаты
docker exec wiki-traefik cat /letsencrypt/acme.json | jq '.Certificates'
```

---

## Структура файлов

```
deploy/
├── deploy.sh           # Первоначальное развертывание
├── update.sh           # Обновление приложения
├── remote-update.sh    # Удалённое обновление через SSH
├── DEPLOYMENT.md       # Эта документация
├── Dockerfile          # Docker образ приложения
├── init-db.sql         # Инициализация базы данных
└── README.md           # Краткое описание
```

---

## Контакты и поддержка

При возникновении проблем:

1. Проверьте логи: `./deploy/update.sh logs`
2. Проверьте статус: `./deploy/update.sh status`
3. Создайте issue в репозитории с описанием проблемы и логами
