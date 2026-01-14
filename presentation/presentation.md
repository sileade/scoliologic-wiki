# Scoliologic Wiki - Corporate Knowledge Base

## Powered by AI

---

## Table of Contents

1. Overview
2. Key Features
3. System Architecture
4. User Interface
5. AI Capabilities
6. Security & Access Control
7. Deployment & Infrastructure
8. Use Cases

---

## 1. Overview

**Scoliologic Wiki** is a modern, self-hosted corporate knowledge management platform designed for the Scoliologic group of companies. It combines the ease-of-use of Notion with enterprise-grade security, local AI capabilities, and powerful search functionality.

### Core Value Proposition

- **Centralized Knowledge**: Single source of truth for all corporate documentation
- **AI-Powered**: Local AI models for intelligent search, writing assistance, and content optimization
- **Easy to Use**: Notion-like interface that requires minimal training
- **Secure**: Enterprise authentication via Authentik with fine-grained access control
- **Self-Hosted**: Complete data sovereignty with Docker-based deployment
- **Collaborative**: Version control, activity tracking, and team collaboration features

---

## 2. Key Features

### 2.1 Rich Text Editor (Notion-like)

- **WYSIWYG Editing**: Intuitive drag-and-drop interface
- **Rich Formatting**: Bold, italic, underline, strikethrough, highlighting, inline code
- **Block Types**: Headings (H1-H6), bullet lists, numbered lists, task lists, quotes, code blocks
- **Tables**: Create and edit tables with ease
- **Media Embedding**: 
  - Images from S3 storage
  - Videos from S3, RuTube, YouTube, and VK Video
  - Links with preview
- **Auto-Formatting**: Markdown shortcuts (# for headings, - for lists, etc.)
- **Smart Text Replacement**: Automatic conversion of arrows, dashes, and special characters

### 2.2 Hierarchical Page Structure

- **Tree Navigation**: Organized page hierarchy with parent-child relationships
- **Nested Pages**: Create sub-pages within pages for better organization
- **Breadcrumb Navigation**: Easy navigation through page hierarchy
- **Drag-and-Drop**: Reorder pages and change hierarchy

### 2.3 Intelligent Search

- **Full-Text Search**: Exact keyword matching in titles and content
- **AI-Powered Search**: Semantic understanding using local embeddings
- **Search Filters**: Filter by date, author, category, and access level
- **Search Analytics**: Track popular search queries
- **Auto-Complete**: Suggestions as you type
- **Result Highlighting**: Matched text highlighted in results

### 2.4 AI Writing Assistant

**Local AI Models (Ollama-based)**:

- **Text Generation**: Generate articles from outlines or topics
- **Content Expansion**: Expand short notes into full articles
- **Content Condensation**: Summarize long articles
- **Tone Adjustment**: Change writing tone (formal, casual, technical)
- **Grammar Checking**: Automatic grammar and spelling corrections
- **Auto-Formatting Correction**: Fix formatting issues
- **Keyword Extraction**: Extract important keywords from content
- **SEO Optimization**: Get suggestions for better search visibility
- **Outline Generation**: Create article outlines from content

### 2.5 Access Control & Permissions

- **OAuth2 via Authentik**: Enterprise authentication
- **Guest Access**: Read-only access to public pages
- **Group-Based Permissions**: 
  - Admin: Full access to all pages and settings
  - Editor: Can create and edit pages
  - Viewer: Read-only access to assigned pages
- **Page-Level Access**: Set permissions for individual pages
- **Group Management**: Create and manage user groups with specific rights

### 2.6 Version Control & History

- **Page Versioning**: Track all changes to pages
- **Change History**: View who changed what and when
- **Rollback**: Restore previous versions of pages
- **Author Attribution**: See who made each change

### 2.7 Templates & Quick Creation

- **Page Templates**: Pre-designed templates for common page types
- **Template Categories**: Organize templates by category
- **Quick Creation**: Create new pages from templates with one click
- **Template Management**: Create, edit, and delete templates

### 2.8 Export & Integration

- **PDF Export**: Export pages to PDF format
- **Markdown Export**: Export pages as Markdown files
- **Batch Export**: Export multiple pages at once
- **S3 Storage**: Integrated file storage for media and documents

### 2.9 Analytics & Metrics

- **Page View Tracking**: Track how many times each page is viewed
- **User Activity**: Monitor user actions (create, edit, delete)
- **Popular Pages**: Identify most-read articles
- **Search Analytics**: Track search queries and patterns
- **User Engagement**: Measure time spent on pages
- **Activity Dashboard**: Visual representation of wiki activity

### 2.10 Theme Support

- **Dark Mode**: Full dark theme support
- **System Detection**: Automatically detect system theme preference
- **Manual Toggle**: Switch between light and dark themes
- **Theme Persistence**: Remember user's theme choice

---

## 3. System Architecture

### 3.1 Technology Stack

**Frontend**:
- React 19 with TypeScript
- TailwindCSS 4 for styling
- TipTap editor for rich text editing
- tRPC for type-safe API calls
- Recharts for analytics visualization

**Backend**:
- Express.js with TypeScript
- tRPC for API procedures
- PostgreSQL for data storage
- Drizzle ORM for database queries
- Ollama for local AI models

**Infrastructure**:
- Docker Compose for orchestration
- Traefik for reverse proxy and load balancing
- MinIO for S3-compatible storage
- PostgreSQL for persistent data
- Ollama for AI embeddings and generation

### 3.2 Database Schema

**Core Tables**:
- `users`: User accounts with roles and authentication info
- `pages`: Wiki pages with content, metadata, and access control
- `groups`: User groups for permission management
- `page_versions`: Version history for pages
- `page_access`: Fine-grained access control per page
- `templates`: Page templates for quick creation
- `analytics`: Activity logs and metrics
- `page_views`: Track page view statistics

### 3.3 API Architecture

All APIs are implemented as tRPC procedures with full type safety:

- **Wiki Management**: Create, read, update, delete pages
- **Search**: Full-text and AI-powered semantic search
- **AI Services**: Text generation, optimization, analysis
- **Access Control**: User and group management
- **Analytics**: Metrics and activity tracking
- **Templates**: Template management and creation
- **Authentik Integration**: OAuth and group synchronization

---

## 4. User Interface

### 4.1 Home Page

- Welcome message and platform overview
- Quick access buttons (Browse Wiki, Search, Admin)
- Key features showcase
- Call-to-action buttons

### 4.2 Wiki Editor

- Left sidebar with page tree navigation
- Main editor area with TipTap editor
- Toolbar with formatting options
- AI assistant panel on the right
- Page properties and access control

### 4.3 Search Page

- Search input with auto-complete
- Toggle between Text and AI search modes
- Search tips and best practices
- Results display with highlighting
- Filter options

### 4.4 Admin Panel

- Dashboard with key metrics
- Users management tab
- Groups management tab
- Access requests tab
- Activity log tab
- Analytics dashboard

### 4.5 Navigation

- Top navigation bar with Wiki, Search, Admin links
- User profile menu with logout
- Theme toggle
- Breadcrumb navigation in editor

---

## 5. AI Capabilities

### 5.1 Local AI Infrastructure

All AI features run locally using Ollama:

- **Embedding Model**: For semantic search and similarity
- **LLM Model**: For text generation and analysis
- **Vector Database**: For storing and searching embeddings

### 5.2 AI Features

1. **Semantic Search**: Understand meaning, not just keywords
2. **Content Generation**: Create articles from outlines
3. **Text Improvement**: Enhance writing quality
4. **Grammar Checking**: Automatic error detection
5. **Tone Adjustment**: Match desired writing style
6. **Content Summarization**: Create concise summaries
7. **Keyword Extraction**: Identify important terms
8. **SEO Optimization**: Improve search visibility

### 5.3 Privacy & Security

- All AI processing happens on your servers
- No data sent to external services
- Complete data privacy and compliance
- GDPR-compliant processing

---

## 6. Security & Access Control

### 6.1 Authentication

- **OAuth2 via Authentik**: Enterprise-grade authentication
- **Session Management**: Secure session handling with JWT
- **User Roles**: Admin, Editor, Viewer roles
- **Guest Access**: Optional read-only guest access

### 6.2 Authorization

- **Page-Level Access**: Set permissions per page
- **Group-Based Access**: Control access by group membership
- **Role-Based Access**: Different permissions for different roles
- **Authentik Integration**: Sync groups from Authentik

### 6.3 Data Protection

- **Encrypted Storage**: Sensitive data encrypted at rest
- **HTTPS**: All traffic encrypted in transit
- **Database Security**: PostgreSQL with strong authentication
- **Audit Logging**: Track all user actions

---

## 7. Deployment & Infrastructure

### 7.1 Docker Compose Setup

Complete containerized deployment with:

- **Wiki Application**: Main web application
- **PostgreSQL**: Database server
- **Ollama**: AI model server with GPU support
- **MinIO**: S3-compatible storage
- **Traefik**: Reverse proxy and SSL/TLS termination

### 7.2 Configuration Options

- **New Traefik**: Deploy with new Traefik instance
- **Existing Traefik**: Integrate with existing Traefik setup
- **Environment Variables**: Flexible configuration
- **GPU Support**: NVIDIA GPU acceleration for Ollama

### 7.3 Quick Deployment

One-click deployment script with:

- Automatic configuration
- Database initialization
- Model downloading
- Health checks

### 7.4 Requirements

- Docker and Docker Compose
- 8GB+ RAM (16GB+ recommended)
- 20GB+ disk space
- GPU (optional, for faster AI processing)
- Authentik server (for OAuth)

---

## 8. Use Cases

### 8.1 Technical Documentation

- API documentation with code examples
- System architecture diagrams
- Deployment procedures
- Troubleshooting guides

### 8.2 Internal Procedures

- Company policies and guidelines
- Process documentation
- Training materials
- Standard operating procedures

### 8.3 Knowledge Management

- Best practices and lessons learned
- Project documentation
- Research findings
- Meeting notes and decisions

### 8.4 Collaboration

- Team wikis for projects
- Knowledge sharing across departments
- Onboarding documentation
- FAQ and knowledge base

---

## Key Differentiators

✅ **Local AI**: All AI processing on your servers - no external API calls

✅ **Notion-like UX**: Familiar interface reduces learning curve

✅ **Enterprise Security**: Authentik integration, fine-grained access control

✅ **Self-Hosted**: Complete data sovereignty and compliance

✅ **Easy Deployment**: Docker Compose with one-click setup

✅ **Rich Features**: Comprehensive wiki platform with modern capabilities

✅ **Extensible**: Built with TypeScript and tRPC for easy customization

---

## Getting Started

### Prerequisites

1. Docker and Docker Compose installed
2. Authentik server configured
3. Domain name (for production)
4. GPU (optional, for faster AI)

### Installation Steps

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Run `docker-compose up -d`
4. Access the wiki at `https://wiki.your-domain.com`
5. Configure Authentik OAuth
6. Download AI models in Ollama

### First Steps

1. Create your first wiki page
2. Set up user groups
3. Configure access permissions
4. Start writing documentation

---

## Support & Documentation

- Full API documentation
- Deployment guides
- Troubleshooting guides
- Video tutorials
- Community forums

---

## License & Terms

Scoliologic Wiki is provided as a self-hosted solution for the Scoliologic group of companies.

---

**Scoliologic Wiki - Empowering Knowledge Management with AI**

*Built with ❤️ for the Scoliologic group of companies*
