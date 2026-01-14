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
