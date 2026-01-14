#!/bin/bash

# ============================================
# Scoliologic Wiki - One-Click Deployment
# ============================================

set -e

echo "🚀 Scoliologic Wiki Deployment Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Determine deployment mode
echo "Choose deployment mode:"
echo "1) New Traefik (recommended for new installations)"
echo "2) Existing Traefik (integrate with existing reverse proxy)"
read -p "Enter your choice (1 or 2): " DEPLOY_MODE

if [ "$DEPLOY_MODE" != "1" ] && [ "$DEPLOY_MODE" != "2" ]; then
    echo -e "${RED}❌ Invalid choice. Please enter 1 or 2.${NC}"
    exit 1
fi

# Determine Authentik mode
echo ""
echo "Choose Authentik configuration:"
echo "1) Use existing Authentik instance"
echo "2) Deploy new Authentik (requires additional setup)"
read -p "Enter your choice (1 or 2): " AUTHENTIK_MODE

if [ "$AUTHENTIK_MODE" != "1" ] && [ "$AUTHENTIK_MODE" != "2" ]; then
    echo -e "${RED}❌ Invalid choice. Please enter 1 or 2.${NC}"
    exit 1
fi

# Get configuration from user
echo ""
echo -e "${YELLOW}📝 Configuration${NC}"
echo ""

read -p "Wiki domain (e.g., wiki.example.com): " WIKI_DOMAIN
read -p "Admin email (for Let's Encrypt): " ADMIN_EMAIL
read -sp "Database password (will not be displayed): " DB_PASSWORD
echo ""
read -sp "MinIO password (will not be displayed): " MINIO_PASSWORD
echo ""
read -p "JWT Secret (leave empty to generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "Generated JWT Secret: $JWT_SECRET"
fi

if [ "$AUTHENTIK_MODE" = "1" ]; then
    echo ""
    echo -e "${YELLOW}📝 Authentik Configuration${NC}"
    read -p "Authentik URL (e.g., https://authentik.example.com): " AUTHENTIK_URL
    read -p "OAuth App ID: " OAUTH_APP_ID
    read -p "Owner Open ID: " OWNER_OPEN_ID
    read -p "Owner Name: " OWNER_NAME
fi

# Create .env file
echo ""
echo -e "${YELLOW}🔧 Creating configuration files...${NC}"

cat > .env << EOF
# Database
DB_NAME=scoliologic_wiki
DB_USER=wiki
DB_PASSWORD=${DB_PASSWORD}

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
AWS_S3_BUCKET=wiki-storage

# Ollama
OLLAMA_BASE_URL=http://ollama:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=mistral

# Application
VITE_APP_TITLE=Scoliologic Wiki
JWT_SECRET=${JWT_SECRET}

# Domain
WIKI_DOMAIN=${WIKI_DOMAIN}
LETSENCRYPT_EMAIL=${ADMIN_EMAIL}

# Node
NODE_ENV=production
EOF

if [ "$AUTHENTIK_MODE" = "1" ]; then
    cat >> .env << EOF

# Authentik
VITE_APP_ID=${OAUTH_APP_ID}
OAUTH_SERVER_URL=${AUTHENTIK_URL}
VITE_OAUTH_PORTAL_URL=${AUTHENTIK_URL}/application/o/authorize/
OWNER_OPEN_ID=${OWNER_OPEN_ID}
OWNER_NAME=${OWNER_NAME}
EOF
fi

echo -e "${GREEN}✓ Configuration file created${NC}"

# Choose Docker Compose file
if [ "$DEPLOY_MODE" = "1" ]; then
    COMPOSE_FILE="docker-compose.yml"
    echo -e "${GREEN}✓ Using new Traefik setup${NC}"
else
    COMPOSE_FILE="docker-compose.existing-traefik.yml"
    if [ ! -f "$COMPOSE_FILE" ]; then
        echo -e "${RED}❌ File $COMPOSE_FILE not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Using existing Traefik setup${NC}"
fi

# Build and start services
echo ""
echo -e "${YELLOW}🐳 Starting Docker services...${NC}"

docker-compose -f "$COMPOSE_FILE" up -d

echo -e "${GREEN}✓ Services started${NC}"

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"

sleep 10

# Check service health
RETRIES=30
while [ $RETRIES -gt 0 ]; do
    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U wiki > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    RETRIES=$((RETRIES - 1))
    sleep 2
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
fi

# Pull Ollama models
echo ""
echo -e "${YELLOW}🤖 Pulling Ollama AI models...${NC}"
echo "This may take a few minutes on first run..."

docker-compose -f "$COMPOSE_FILE" exec -T ollama ollama pull nomic-embed-text
docker-compose -f "$COMPOSE_FILE" exec -T ollama ollama pull mistral

echo -e "${GREEN}✓ Ollama models ready${NC}"

# Create S3 bucket
echo ""
echo -e "${YELLOW}📦 Setting up MinIO storage...${NC}"

docker-compose -f "$COMPOSE_FILE" exec -T minio mc alias set local http://localhost:9000 minioadmin ${MINIO_PASSWORD} || true
docker-compose -f "$COMPOSE_FILE" exec -T minio mc mb local/wiki-storage || true

echo -e "${GREEN}✓ MinIO storage configured${NC}"

# Display summary
echo ""
echo -e "${GREEN}======================================"
echo "✅ Deployment Complete!"
echo "======================================${NC}"
echo ""
echo "📍 Access your wiki:"
if [ "$DEPLOY_MODE" = "1" ]; then
    echo "   https://${WIKI_DOMAIN}"
else
    echo "   http://localhost:3000"
fi
echo ""
echo "📊 Services:"
echo "   Wiki App: http://localhost:3000"
echo "   MinIO Console: http://localhost:9001"
echo "   Ollama API: http://localhost:11434"
echo "   Traefik Dashboard: http://localhost:8080"
echo ""
echo "🔐 Credentials:"
echo "   MinIO: minioadmin / ${MINIO_PASSWORD}"
echo ""
echo "📝 Next steps:"
echo "   1. Configure Authentik OAuth settings"
echo "   2. Upload your company logo"
echo "   3. Create initial wiki pages"
echo "   4. Invite team members"
echo ""
echo "📚 Documentation:"
echo "   - README.md: Full setup guide"
echo "   - deploy/README.md: Deployment details"
echo ""
echo "🆘 Troubleshooting:"
echo "   View logs: docker-compose logs -f app"
echo "   Restart: docker-compose restart"
echo ""
