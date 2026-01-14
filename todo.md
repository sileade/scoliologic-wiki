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
