# Scoliologic Wiki

Корпоративная wiki-система для группы компаний Scoliologic с Notion-подобным интерфейсом, AI-поиском и управлением доступом.

## Возможности

### Редактор контента
- **WYSIWYG редактор** на базе TipTap с интерфейсом в стиле Notion
- Форматирование текста: жирный, курсив, подчёркивание, зачёркивание
- Заголовки трёх уровней (H1, H2, H3)
- Списки: маркированные, нумерованные, чек-листы
- Блоки кода с подсветкой синтаксиса
- Таблицы с редактированием
- Вставка изображений и медиафайлов
- Цитаты и разделители

### Организация контента
- Иерархическая структура страниц с неограниченной вложенностью
- Древовидная навигация с раскрывающимися секциями
- Версионирование страниц с историей изменений
- Возможность отката к предыдущим версиям

### AI-функционал
- **Интеллектуальный поиск** с семантическим пониманием запросов
- Векторные эмбеддинги для точного поиска по смыслу
- **AI-помощник** для написания статей:
  - Генерация текста по теме
  - Улучшение стиля написания
  - Автодополнение текста
  - Исправление грамматики
  - Перевод на другие языки
  - Создание резюме

### Управление доступом
- Авторизация через OAuth (Authentik)
- **Гостевой доступ** для чтения публичных страниц
- Система групп с ролями: member, editor, admin
- Права доступа на уровне страниц и групп
- Запросы на доступ с одобрением администратором

### Администрирование
- Панель управления пользователями
- Управление группами и их членами
- Настройки системы
- Журнал активности
- Статистика использования

## Требования

- Docker и Docker Compose
- NVIDIA GPU (опционально, для AI-функций)
- Authentik сервер для авторизации
- S3-совместимое хранилище для медиафайлов

## Быстрая установка

### Автоматическая установка (Debian/Ubuntu)

```bash
curl -fsSL https://raw.githubusercontent.com/scoliologic/wiki/main/deploy/install.sh | sudo bash
```

Скрипт предложит выбор:
1. **Full Stack** — новый Traefik + Wiki + Ollama
2. **Wiki Only** — использовать существующий Traefik
3. **Wiki + Ollama** — использовать существующий Traefik с AI

### Ручная установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/scoliologic/wiki.git /opt/scoliologic-wiki
cd /opt/scoliologic-wiki/deploy
```

2. Создайте конфигурацию:
```bash
cp config.example.env config.env
nano config.env
```

3. Запустите сервисы:
```bash
# Для полного стека (с Traefik):
docker compose -f docker-compose.full.yml up -d

# Для использования существующего Traefik:
docker compose up -d
```

## Конфигурация

### Основные параметры

| Параметр | Описание | Пример |
|----------|----------|--------|
| `WIKI_DOMAIN` | Домен wiki | `wiki.scoliologic.ru` |
| `AUTHENTIK_URL` | URL Authentik сервера | `https://auth.scoliologic.ru` |
| `AUTHENTIK_CLIENT_ID` | ID OAuth приложения | `wiki-app` |
| `AUTHENTIK_CLIENT_SECRET` | Секрет OAuth приложения | `...` |

### Настройка Authentik

1. Создайте OAuth2/OpenID Provider в Authentik
2. Укажите Redirect URI: `https://wiki.scoliologic.ru/api/oauth/callback`
3. Скопируйте Client ID и Client Secret в конфигурацию

### AI-модели (Ollama)

После запуска загрузите модели:
```bash
docker exec wiki-ollama ollama pull llama3.2
docker exec wiki-ollama ollama pull nomic-embed-text
```

## Структура проекта

```
scoliologic-wiki/
├── client/                 # Frontend (React + Vite)
│   ├── src/
│   │   ├── components/     # UI компоненты
│   │   ├── pages/          # Страницы приложения
│   │   └── lib/            # Утилиты и хуки
├── server/                 # Backend (Express + tRPC)
│   ├── routers.ts          # API роутеры
│   └── db.ts               # Функции работы с БД
├── drizzle/                # Схема базы данных
├── deploy/                 # Docker конфигурация
│   ├── docker-compose.yml      # Базовая конфигурация
│   ├── docker-compose.full.yml # Полный стек с Traefik
│   ├── Dockerfile              # Сборка приложения
│   └── install.sh              # Скрипт установки
└── shared/                 # Общие типы и константы
```

## API

Wiki использует tRPC для типобезопасного API. Основные эндпоинты:

### Страницы
- `pages.list` — список доступных страниц
- `pages.getById` — получение страницы по ID
- `pages.create` — создание страницы
- `pages.update` — обновление страницы
- `pages.delete` — удаление страницы

### Группы
- `groups.list` — список групп
- `groups.create` — создание группы
- `groups.addMember` — добавление участника

### AI
- `ai.search` — семантический поиск
- `ai.assist` — AI-помощник для текста
- `ai.autocomplete` — автодополнение

## Резервное копирование

Для автоматического бэкапа базы данных добавьте профиль backup:

```bash
docker compose -f docker-compose.full.yml --profile backup up -d
```

Бэкапы сохраняются в volume `backup-data` с ротацией:
- Ежедневные: 7 дней
- Еженедельные: 4 недели
- Ежемесячные: 6 месяцев

## Обновление

```bash
cd /opt/scoliologic-wiki
git pull
docker compose -f docker-compose.full.yml build
docker compose -f docker-compose.full.yml up -d
```

## Разработка

### Локальный запуск

```bash
pnpm install
pnpm dev
```

### Тестирование

```bash
pnpm test
```

### Сборка

```bash
pnpm build
```

## Лицензия

MIT License

## Поддержка

- Документация: https://wiki.scoliologic.ru/docs
- Issues: https://github.com/scoliologic/wiki/issues
- Email: support@scoliologic.ru
