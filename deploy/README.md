# Scoliologic Wiki - Deployment Guide

## Quick Start

### Option 1: Automated One-Click Deployment (Recommended)

```bash
cd deploy
chmod +x deploy.sh
./deploy.sh
```

The script will guide you through:
1. Selecting deployment mode (new or existing Traefik)
2. Choosing Authentik configuration
3. Setting up database and storage credentials
4. Pulling AI models
5. Configuring the domain

### Option 2: Manual Docker Compose Deployment

#### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM (for Ollama AI models)
- GPU support (recommended for better AI performance)
- NVIDIA Docker runtime (if using GPU)

#### Step 1: Clone and Configure

```bash
git clone https://github.com/scoliologic/wiki.git
cd wiki
cp deploy/.env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DB_PASSWORD=your_secure_password

# MinIO Storage
MINIO_ROOT_PASSWORD=your_secure_password

# Application
VITE_APP_TITLE=Your Company Wiki
JWT_SECRET=your_jwt_secret

# Authentik OAuth
VITE_APP_ID=your_oauth_app_id
OAUTH_SERVER_URL=https://authentik.example.com
OWNER_OPEN_ID=your_owner_id
OWNER_NAME=Administrator

# Domain
WIKI_DOMAIN=wiki.example.com
LETSENCRYPT_EMAIL=admin@example.com
```

#### Step 2: Start Services

**With new Traefik (recommended):**
```bash
docker-compose -f docker-compose.yml up -d
```

**With existing Traefik:**
```bash
docker-compose -f docker-compose.existing-traefik.yml up -d
```

#### Step 3: Pull AI Models

```bash
# Pull embedding model (used for semantic search)
docker-compose exec ollama ollama pull nomic-embed-text

# Pull LLM model (used for text generation and AI assistance)
docker-compose exec ollama ollama pull mistral
```

Or use larger models for better quality:
```bash
docker-compose exec ollama ollama pull neural-chat
docker-compose exec ollama ollama pull llama2
```

#### Step 4: Initialize Database

```bash
docker-compose exec app pnpm db:push
```

#### Step 5: Create S3 Bucket

```bash
docker-compose exec minio mc alias set local http://localhost:9000 minioadmin your_password
docker-compose exec minio mc mb local/wiki-storage
```

## Architecture

### Services

| Service | Port | Purpose | GPU Support |
|---------|------|---------|-------------|
| Wiki App | 3000 | Main application | No |
| PostgreSQL | 5432 | Database | No |
| MinIO | 9000/9001 | S3 Storage | No |
| Ollama | 11434 | AI Models | Yes (NVIDIA) |
| Traefik | 80/443/8080 | Reverse Proxy | No |

### Data Flow

```
User Browser
    ↓
Traefik (Reverse Proxy)
    ↓
Wiki App (Node.js/React)
    ↓
├─ PostgreSQL (Data)
├─ MinIO (Files)
└─ Ollama (AI)
```

## Configuration

### Environment Variables

#### Core Application
- `NODE_ENV`: `production` or `development`
- `JWT_SECRET`: Session signing key (generate with `openssl rand -base64 32`)
- `DATABASE_URL`: PostgreSQL connection string

#### OAuth (Authentik)
- `VITE_APP_ID`: OAuth application ID
- `OAUTH_SERVER_URL`: Authentik server URL
- `VITE_OAUTH_PORTAL_URL`: Authentik OAuth endpoint
- `OWNER_OPEN_ID`: Admin user's OpenID
- `OWNER_NAME`: Admin user's display name

#### Storage (MinIO)
- `AWS_ACCESS_KEY_ID`: MinIO access key
- `AWS_SECRET_ACCESS_KEY`: MinIO secret key
- `AWS_S3_ENDPOINT`: MinIO endpoint (http://minio:9000)
- `AWS_S3_BUCKET`: Bucket name (wiki-storage)

#### AI (Ollama)
- `OLLAMA_BASE_URL`: Ollama API endpoint (http://ollama:11434)
- `EMBEDDING_MODEL`: Model for embeddings (nomic-embed-text)
- `LLM_MODEL`: Model for text generation (mistral)

### Ollama Models

Popular models for different use cases:

**Embeddings (for semantic search):**
- `nomic-embed-text` (275MB) - Fast, recommended
- `all-minilm` (67MB) - Very fast, lower quality

**Text Generation (for AI assistance):**
- `mistral` (4GB) - Fast, good quality, recommended
- `neural-chat` (4GB) - Optimized for chat
- `llama2` (3.8GB) - Larger context window
- `dolphin-mixtral` (26GB) - High quality, requires GPU

Pull additional models:
```bash
docker-compose exec ollama ollama pull model_name
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f ollama
docker-compose logs -f postgres
```

### Health Checks

```bash
# Check all services
docker-compose ps

# Check database
docker-compose exec postgres pg_isready

# Check Ollama
curl http://localhost:11434/api/tags

# Check MinIO
curl http://localhost:9000/minio/health/live
```

### Performance Monitoring

**CPU/Memory Usage:**
```bash
docker stats
```

**Database Queries:**
```bash
docker-compose exec postgres psql -U wiki -d scoliologic_wiki
```

## Backup & Restore

### Backup Database

```bash
docker-compose exec postgres pg_dump -U wiki scoliologic_wiki > backup.sql
```

### Restore Database

```bash
docker-compose exec -T postgres psql -U wiki scoliologic_wiki < backup.sql
```

### Backup MinIO Data

```bash
docker-compose exec minio mc mirror local/wiki-storage ./backup/
```

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs

# Restart services
docker-compose restart

# Full rebuild
docker-compose down
docker-compose up -d
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
docker-compose exec postgres pg_isready -U wiki
```

### Ollama models not loading

```bash
# Check Ollama status
docker-compose logs ollama

# Manually pull model
docker-compose exec ollama ollama pull mistral

# Check available models
curl http://localhost:11434/api/tags
```

### Out of memory errors

Reduce Ollama model size or allocate more resources:

```yaml
# In docker-compose.yml
ollama:
  deploy:
    resources:
      limits:
        memory: 16G  # Increase as needed
```

### S3 bucket not accessible

```bash
# Check MinIO
docker-compose logs minio

# Recreate bucket
docker-compose exec minio mc mb local/wiki-storage --ignore-existing
```

## Scaling

### Horizontal Scaling

For multiple wiki instances behind a load balancer:

```bash
# Scale app service
docker-compose up -d --scale app=3
```

### Vertical Scaling

Increase resources for better performance:

```yaml
# In docker-compose.yml
app:
  deploy:
    resources:
      limits:
        cpus: '4'
        memory: 8G
```

## Security

### Enable HTTPS

Traefik automatically handles HTTPS with Let's Encrypt:

```env
LETSENCRYPT_EMAIL=admin@example.com
WIKI_DOMAIN=wiki.example.com
```

### Change Default Credentials

```bash
# MinIO
export MINIO_ROOT_USER=your_username
export MINIO_ROOT_PASSWORD=your_password

# Database
export DB_PASSWORD=your_password

# JWT Secret
export JWT_SECRET=$(openssl rand -base64 32)
```

### Network Security

The deployment uses an isolated Docker network. To restrict access:

```yaml
# In docker-compose.yml
services:
  app:
    ports:
      - "127.0.0.1:3000:3000"  # Only localhost
```

## Updates

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build app
```

### Update Models

```bash
# Pull latest model version
docker-compose exec ollama ollama pull mistral:latest
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/scoliologic/wiki/issues
- Documentation: https://wiki.scoliologic.ru/docs
- Email: support@scoliologic.ru
