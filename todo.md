# Scoliologic Wiki - Project TODO

## Core Infrastructure
- [x] Database schema for pages, groups, permissions, versions
- [x] User authentication with Manus OAuth
- [x] Guest access mode (read-only for public pages)

## Wiki Pages System
- [x] Hierarchical page structure with parent-child relationships
- [x] Page CRUD operations (create, read, update, delete)
- [x] Tree navigation component for nested pages
- [x] Page versioning with change history
- [x] Rollback capability for page versions

## Notion-like Editor
- [x] WYSIWYG block-based editor integration (TipTap)
- [x] Text formatting (bold, italic, underline, strikethrough)
- [x] Headings (H1, H2, H3)
- [x] Lists (bullet, numbered, checklist)
- [x] Code blocks with syntax highlighting
- [x] Media embedding (images)
- [x] Tables support
- [ ] Drag-and-drop block reordering

## User & Group Management
- [x] User management interface
- [x] Group creation and editing
- [x] Role-based permissions (read, edit, admin)
- [x] User-to-group assignment
- [x] Page-level access control
- [x] Group-level access control

## AI Features
- [x] AI-powered full-text search with semantic understanding
- [x] Vector embeddings integration (LLM API)
- [x] AI writing assistant for articles
- [x] Text generation and auto-completion
- [x] Style improvement suggestions
- [x] Grammar correction

## Admin Panel
- [x] User management dashboard
- [x] Group management dashboard
- [x] System settings configuration
- [x] Access rights overview
- [x] Activity logs

## Notifications
- [ ] Email notifications for new articles
- [ ] Notifications for access requests
- [ ] Critical changes alerts to admins

## File Storage
- [x] S3-compatible storage integration
- [x] Image upload and management
- [ ] Document upload support
- [x] Media file embedding in articles

## Docker Deployment
- [x] Docker Compose configuration
- [x] Traefik reverse proxy setup
- [x] PostgreSQL database container
- [x] Ollama container for AI models
- [x] Environment variables configuration
- [x] Option for existing vs new Traefik instance
- [x] Installation script for Debian-based systems

## UI/UX
- [x] Clean corporate design theme
- [x] Responsive layout
- [ ] Dark/light mode support
- [x] Sidebar navigation
- [x] Search interface
- [x] Loading states and error handling


## Video Support Enhancement
- [x] Add S3 video upload and embedding support
- [x] Add RuTube video embedding support
- [x] Video player component in editor
- [x] Video toolbar button in WikiEditor
- [x] Add YouTube video embedding support
- [x] Add VK Video embedding support


## Extended Video Support
- [x] Add YouTube video embedding support
- [x] Add VK Video embedding support
- [x] Video preview before insertion

## Enhanced Search Features
- [x] Improve full-text search with better ranking
- [x] Add AI-powered semantic search via Ollama
- [x] Search suggestions and autocomplete
- [x] Search filters (by date, author, category)
- [x] Search result highlighting

## AI Writing Assistant Enhancement (Local Ollama)
- [x] AI article generation from topic/outline
- [x] Smart formatting suggestions
- [x] Auto-structure detection and improvement
- [x] Translation assistance
- [x] Content summarization
- [x] SEO optimization suggestions

## Local AI Infrastructure
- [x] Ollama integration for embeddings
- [x] Local LLM for text generation
- [x] Vector database for semantic search
- [x] Embedding caching system

## Docker Compose Deployment
- [x] Complete docker-compose.yml with all services
- [x] Ollama service configuration
- [x] MinIO S3 storage setup
- [x] PostgreSQL database
- [x] Traefik reverse proxy
- [x] Environment configuration
- [x] One-click deployment script


## Export & Templates Features
- [x] Export articles to PDF format
- [x] Export articles to Markdown format
- [x] Batch export functionality
- [x] Page templates system
- [x] Template management (create, edit, delete)
- [x] Template categories
- [x] Quick page creation from templates


## Theme & UI Enhancements
- [x] Dark theme implementation
- [x] System theme detection (prefers-color-scheme)
- [x] Manual theme toggle in UI
- [x] Theme persistence in localStorage
- [x] Smooth theme transitions

## Advanced Text Formatting (Notion-like)
- [x] Auto-formatting on text input (markdown shortcuts)
- [x] Smart list detection and conversion
- [x] Auto-heading detection (# syntax)
- [x] Auto-quote formatting (> syntax)
- [x] Auto-code block formatting (``` syntax)
- [x] Smart text replacement (arrows, dashes, etc.)
- [ ] Drag-and-drop block reordering
- [x] Block type conversion menu

## Enhanced AI Tools
- [x] Auto-format correction via AI
- [x] Grammar and spelling check
- [x] Tone adjustment (formal, casual, technical)
- [x] Content expansion/condensation
- [x] Outline generation from content
- [x] Article generation from outline
- [x] SEO optimization suggestions
- [ ] Plagiarism check integration


## Authentik Integration
- [x] Authentik API client setup
- [x] Group synchronization from Authentik
- [x] Automatic group sync on schedule
- [x] User group membership sync
- [x] Permission mapping from Authentik roles
- [x] Sync status monitoring
## Analytics & Metrics System
- [x] Page view tracking
- [x] User activity logging
- [x] Article popularity metrics
- [x] Search analytics
- [x] User engagement tracking
- [x] Time spent on pages
- [x] Analytics dashboard in admin panel
- [ ] Export analytics reports


## GitHub Repository Tasks
- [x] Create private GitHub repository for Scoliologic Wiki
- [x] Prepare project files for upload
- [x] Upload project to GitHub
- [x] Write detailed README.md with screenshots
- [x] Add screenshots to repository


## Code Quality Improvements (5-Star Target)
- [x] Optimize N+1 queries in permission checks (batch query)
- [x] Refactor routers.ts into separate modules (pages, users, groups, ai, admin)
- [x] Add rate limiting for API endpoints
- [x] Optimize AI embedding generation (parallel processing)
- [x] Add more unit tests for db.ts functions
- [x] Add integration tests for permission system
- [x] Add input sanitization utilities
- [x] Improve error handling consistency


## Advanced Features (Phase 2)
- [x] Add Redis caching for sessions and permissions
- [x] Integrate Sentry for error monitoring
- [x] Add Playwright E2E tests for UI flows
- [x] Update README with new features
- [x] Push changes to GitHub


## Advanced Features (Phase 3)
- [x] Setup CI/CD with GitHub Actions for automatic test runs
- [x] Implement WebSocket notifications for real-time page updates
- [x] Implement PDF export for wiki pages
- [x] Update README with new features
- [x] Push changes to GitHub


## Notification System for Page Changes
- [x] Create notifications table in database schema
- [x] Add notification preferences to user settings
- [x] Implement backend API for notifications (create, list, mark as read)
- [x] Create notification bell UI component with badge
- [x] Create notifications dropdown/panel
- [x] Integrate notifications into page update flow
- [x] Add real-time notifications via WebSocket
- [x] Update README with notification system documentation
- [x] Push changes to GitHub


## Favorites and Markdown Export
- [x] Create favorites table in database schema
- [x] Add favorites functions to db.ts
- [x] Implement favorites API (add, remove, list)
- [x] Create FavoriteButton UI component
- [x] Add favorites section to sidebar
- [x] Implement Markdown export for single page
- [x] Implement Markdown export for multiple pages
- [x] Add export button to page actions
- [x] Update README with new features
- [x] Push changes to GitHub


## Markdown Import and Tags System
- [x] Create Markdown to TipTap JSON converter
- [x] Implement import API endpoint
- [x] Add import UI (file upload dialog)
- [x] Create tags table in database schema
- [x] Create page_tags junction table
- [x] Add tags functions to db.ts
- [x] Implement tags API (create, list, assign, remove)
- [x] Create TagInput UI component
- [x] Add tags display to page header
- [x] Add tags filter to search
- [x] Update README with new features
- [ ] Push changes to GitHub


## Русская локализация (i18n)
- [x] Установить i18next и react-i18next
- [x] Создать конфигурацию i18n
- [x] Создать файлы переводов (ru.json, en.json)
- [x] Создать компонент переключателя языка
- [x] Локализовать Home.tsx
- [x] Локализовать Search.tsx
- [x] Локализовать NotificationBell.tsx
- [x] Локализовать Wiki.tsx
- [x] Локализовать Admin.tsx
- [x] Добавить переключатель языка в навигацию


## Расширенная локализация (Phase 2)
- [x] Локализовать тултипы панели инструментов редактора Wiki
- [x] Добавить автоопределение языка браузера (navigator.language)
- [x] Локализовать toast-уведомления
- [x] Локализовать сообщения об ошибках


## Обновление репозитория
- [x] Создать скриншоты интерфейса
- [x] Обновить README.md с описанием локализации
- [x] Провести code review
- [x] Запустить тесты
- [x] Сделать коммит и push в GitHub


## Unit-тесты i18n и локализация ошибок
- [x] Создать unit-тесты для проверки синхронизации ключей i18n
- [x] Локализовать серверные ошибки tRPC на клиентской стороне
- [x] Добавить ключи ошибок в ru.json и en.json
- [x] Запустить тесты и проверить работоспособность


## CI Pipeline
- [x] Создать GitHub Actions workflow для тестов
- [x] Настроить запуск при push и pull request
- [x] Добавить проверку TypeScript
- [x] Добавить проверку ESLint (включена в TypeScript check)
- [x] Коммит и push в GitHub (требуется workflows permission)


## Code Review (полный анализ)
- [x] Анализ структуры проекта и зависимостей
- [x] Анализ серверного кода (routers, db, безопасность)
- [x] Анализ клиентского кода (React, компоненты)
- [x] Проверка тестов и покрытия
- [x] Составление отчёта code review


## Production Readiness
- [x] Локализовать ErrorBoundary
- [x] Исправить потенциально непереведённый ключ nav.wiki (проверено - корректно)
- [x] Добавить production environment variables документацию
- [x] Проверить build для production (успешно, 1.79MB JS)
- [x] Создать DEPLOYMENT.md с инструкциями
- [x] Финальное тестирование всех функций (143 теста passed)
- [x] Обновить README с production информацией (уже содержит)


## Улучшение поиска
- [x] Создать тестовые страницы для демонстрации (5 страниц о сколиозе)
- [x] Добавить fuzzy matching в поиск (ранжирование, частичные совпадения)
- [x] Проверить и исправить AI-поиск (гибридный поиск + fallback)
- [x] Протестировать все виды поиска (полнотекстовый, AI, fuzzy - все работают)


## Интеграция с Authentik
- [x] OAuth2 авторизация через Authentik
- [x] Синхронизация пользователей из Authentik
- [x] Синхронизация групп из Authentik
- [x] API для синхронизации в админ-панели
- [x] Автоматическая синхронизация групп при входе

## OAuth2 + синхронизация)
- [ ] Добавить переменные окружения для Authentik (URL, CLIENT_ID, CLIENT_SECRET)
- [ ] Реализовать OAuth2/OIDC авторизацию через Authentik
- [ ] Реализовать синхронизацию пользователей из Authentik
- [ ] Реализовать синхронизацию групп из Authentik
- [ ] Добавить UI для настройки синхронизации в админ-панели
- [ ] Написать тесты для интеграции
- [ ] Обновить документацию


## Режим просмотра/редактирования страниц
- [x] Реализовать режим просмотра страниц по умолчанию (read-only)
- [x] Добавить кнопку "Редактировать" только для пользователей с правами
- [x] Проверка прав на редактирование через API
- [x] Скрыть редактор для пользователей без прав


## Автоматическая синхронизация с Authentik
- [x] Автозапуск синхронизации при старте сервера
- [x] Периодическая синхронизация (каждый час)
- [x] UI для синхронизации в админ-панели


## Настройка Authentik и управление правами
- [x] Форма настройки Authentik в админ-панели (URL, Client ID, Secret, API Token)
- [x] Сохранение настроек Authentik в базе данных
- [x] Раздел управления правами доступа к страницам для групп
- [x] UI для назначения прав группам на страницы


## AI-интеграция и самообучающаяся система
- [ ] Анализ текущих AI-компонентов wiki
- [ ] Проектирование самообучающейся системы мониторинга
- [ ] Настройка интеграции с удалённой Ollama
- [ ] Система автоматического исправления ошибок
- [ ] Интеграция с балансировщиком нагрузки
- [ ] Документация по AI-архитектуре


## Ollama и система мониторинга
- [x] Настройка удалённой Ollama в админ-панели
- [x] Health-check endpoint для Ollama
- [x] Уведомления администратору о недоступности Ollama
- [x] Система мониторинга логов
- [x] Автоматическое исправление ошибок
- [x] Интеграция с балансировщиком нагрузки
- [x] Обновление README


## Улучшение панели управления и AI-агент
- [x] Расширить панель управления на полную ширину с прокруткой
- [x] Добавить настройки AI-агента для непрерывного мониторинга
- [x] Настройка модели для анализа ошибок
- [x] Порог эскалации к администратору
- [x] Интеграция с балансировщиком нагрузки
- [x] Протестировать автоисправление при отключении Ollama


## Прокрутка панели вкладок
- [x] Видимый скроллбар для панели вкладок
- [x] Поддержка горизонтальной прокрутки жестами тачпада (macOS/Windows)


## Настройки AI-агента, дашборд метрик, Traefik и MinIO
- [x] API для сохранения/загрузки настроек AI-агента в БД
- [x] Дашборд с графиками метрик (Chart.js)
- [x] Настройка интеграции с Traefik (URL, API)
- [x] Настройка MinIO S3 хранилища (endpoint, access key, secret key, bucket)
- [x] UI для всех настроек в админ-панели


## Расширенные настройки Traefik
- [x] Настройка подключения к удалённому Traefik (IP/hostname)
- [x] Проверка соединения с Traefik API
- [x] Получение информации о роутерах и сервисах
- [x] Отображение статуса подключения


## Управление роутерами Traefik
- [x] UI для просмотра списка роутеров Traefik
- [x] UI для просмотра списка сервисов Traefik
- [x] Отображение статуса каждого роутера/сервиса
- [x] Генерация конфигурации роутера для wiki-страниц
- [x] Мониторинг трафика Traefik в дашборде
- [x] Здоровье сервисов Traefik в метриках


## Расширенная интеграция Traefik
- [x] Экспорт YAML-конфигурации в файл для Traefik file provider
- [x] UI для скачивания сгенерированной конфигурации
- [x] Автоматическое обновление конфигурации через Docker API
- [x] Настройки Docker API в админ-панели
- [x] Интеграция с Prometheus metrics от Traefik
- [x] Графики трафика по сервисам (запросы/сек, latency)
- [x] Графики ошибок по сервисам (4xx, 5xx)
- [ ] Исторические данные метрик (требует внешнего хранилища)

## Исторические метрики и алерты Traefik
- [x] Таблица для хранения исторических метрик в БД
- [x] Сбор метрик по запросу (кнопка в UI)
- [x] API для получения исторических данных
- [x] API для трендов за период (час, день, неделя)
- [x] Управление конфигурационными файлами Traefik
- [x] Применение конфигурации через file provider
- [x] Таблица для настроек алертов
- [x] Проверка порогов ошибок и латентности
- [x] Уведомления при превышении порогов (email + webhook)
- [x] UI для настройки алертов в админ-панели
- [x] UI для управления конфигурациями Traefik

## Дашборд и ревью кода
- [x] Дашборд с графиками исторических трендов на главной админки
- [x] Ревью серверного кода (routers.ts, db.ts, traefik.ts)
- [x] Ревью клиентского кода и компонентов
- [x] Ревью интерфейса и UX
- [x] Исправление IPv6 rate limiting

## Интеграция Telegram/Slack для алертов
- [x] Модуль отправки уведомлений в Telegram
- [x] Модуль отправки уведомлений в Slack
- [x] Таблица для хранения настроек интеграций
- [x] API для управления настройками интеграций
- [x] UI панель настройки Telegram в админке
- [x] UI панель настройки Slack в админке
- [x] Тестовая отправка уведомлений
- [x] Интеграция с системой алертов Traefik
- [x] Журнал отправленных уведомлений

## Полное ревью и подготовка к запуску
- [x] Ревью серверного кода (routers.ts, db.ts, traefik.ts, notifications.ts)
- [x] Ревью клиентского кода и компонентов
- [x] Ревью интерфейса и UX
- [x] Исправление найденных проблем (локализация вкладок)
- [x] Обновление README.md (добавлены разделы Traefik и Telegram/Slack)
- [x] Создание CODE_REVIEW_FINAL.md с подробным ревью
- [x] Финальное тестирование (190 тестов, TypeScript OK)
- [x] Подготовка отчёта о ревью

## Production деплой на свой сервер
- [x] docker-compose.production.yml для production
- [x] Dockerfile для приложения
- [x] Конфигурация Traefik с SSL (Let's Encrypt)
- [x] Настройка S3 хранилища (MinIO)
- [x] .env.production.example с переменными окружения
- [x] DEPLOYMENT.md с инструкциями
- [x] deploy.sh - скрипт быстрого развёртывания
- [x] storage-s3.ts - модуль для MinIO/S3
