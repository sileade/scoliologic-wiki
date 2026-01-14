#!/bin/bash

# Scoliologic Wiki - Installation Script
# Supports Debian-based systems and Proxmox LXC containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root"
   exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    print_error "Cannot detect OS. This script requires Debian-based systems."
    exit 1
fi

print_info "Detected OS: $OS $VERSION"

# Check if Debian-based
if [[ "$OS" != "debian" && "$OS" != "ubuntu" ]]; then
    print_error "This script requires Debian or Ubuntu. Detected: $OS"
    exit 1
fi

# Configuration
INSTALL_DIR="/opt/scoliologic-wiki"
CONFIG_FILE="$INSTALL_DIR/deploy/config.env"

# ============ MENU ============
echo ""
echo "=========================================="
echo "   Scoliologic Wiki Installation Script"
echo "=========================================="
echo ""
echo "Select deployment option:"
echo ""
echo "  1) Full Stack (New Traefik + Wiki + Ollama)"
echo "  2) Wiki Only (Use existing Traefik)"
echo "  3) Wiki + Ollama (Use existing Traefik)"
echo ""
read -p "Enter choice [1-3]: " DEPLOY_CHOICE

case $DEPLOY_CHOICE in
    1) COMPOSE_FILE="docker-compose.full.yml" ;;
    2) COMPOSE_FILE="docker-compose.yml" ;;
    3) COMPOSE_FILE="docker-compose.yml"; WITH_OLLAMA=true ;;
    *) print_error "Invalid choice"; exit 1 ;;
esac

# Authentik configuration
echo ""
echo "Authentik Configuration:"
echo ""
echo "  1) Use existing Authentik instance"
echo "  2) Deploy new Authentik (not recommended - use separate deployment)"
echo ""
read -p "Enter choice [1-2]: " AUTH_CHOICE

if [[ "$AUTH_CHOICE" == "2" ]]; then
    print_warning "For Authentik deployment, please use the official Authentik installation guide:"
    print_info "https://goauthentik.io/docs/installation/docker-compose"
    print_info "After deploying Authentik, run this script again with option 1."
    exit 0
fi

# ============ INSTALL DEPENDENCIES ============
print_info "Installing dependencies..."

apt-get update
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    htpasswd

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose plugin if not present
if ! docker compose version &> /dev/null; then
    print_info "Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
fi

# ============ NVIDIA DRIVERS (for Ollama with GPU) ============
if [[ "$WITH_OLLAMA" == "true" || "$DEPLOY_CHOICE" == "1" ]]; then
    echo ""
    read -p "Do you have NVIDIA GPU and want to enable GPU support? [y/N]: " GPU_SUPPORT
    
    if [[ "$GPU_SUPPORT" =~ ^[Yy]$ ]]; then
        print_info "Installing NVIDIA Container Toolkit..."
        
        # Add NVIDIA repository
        curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
        curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
        
        apt-get update
        apt-get install -y nvidia-container-toolkit
        nvidia-ctk runtime configure --runtime=docker
        systemctl restart docker
        
        print_success "NVIDIA Container Toolkit installed"
    fi
fi

# ============ CLONE/UPDATE REPOSITORY ============
print_info "Setting up application..."

if [ -d "$INSTALL_DIR" ]; then
    print_info "Updating existing installation..."
    cd "$INSTALL_DIR"
    git pull
else
    print_info "Cloning repository..."
    git clone https://github.com/scoliologic/wiki.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# ============ CONFIGURATION ============
if [ ! -f "$CONFIG_FILE" ]; then
    print_info "Creating configuration file..."
    cp "$INSTALL_DIR/deploy/config.example.env" "$CONFIG_FILE"
    
    echo ""
    print_warning "Please configure your installation:"
    echo ""
    
    # Domain
    read -p "Enter wiki domain (e.g., wiki.scoliologic.ru): " WIKI_DOMAIN
    sed -i "s/WIKI_DOMAIN=.*/WIKI_DOMAIN=$WIKI_DOMAIN/" "$CONFIG_FILE"
    
    # Base domain (for full stack)
    if [[ "$DEPLOY_CHOICE" == "1" ]]; then
        BASE_DOMAIN=$(echo "$WIKI_DOMAIN" | sed 's/^[^.]*\.//')
        read -p "Enter base domain [$BASE_DOMAIN]: " INPUT_BASE_DOMAIN
        BASE_DOMAIN=${INPUT_BASE_DOMAIN:-$BASE_DOMAIN}
        sed -i "s/BASE_DOMAIN=.*/BASE_DOMAIN=$BASE_DOMAIN/" "$CONFIG_FILE"
        
        read -p "Enter email for Let's Encrypt: " ACME_EMAIL
        sed -i "s/ACME_EMAIL=.*/ACME_EMAIL=$ACME_EMAIL/" "$CONFIG_FILE"
        
        # Generate Traefik auth
        read -p "Enter Traefik dashboard username [admin]: " TRAEFIK_USER
        TRAEFIK_USER=${TRAEFIK_USER:-admin}
        read -s -p "Enter Traefik dashboard password: " TRAEFIK_PASS
        echo ""
        TRAEFIK_AUTH=$(htpasswd -nb "$TRAEFIK_USER" "$TRAEFIK_PASS" | sed 's/\$/\$\$/g')
        sed -i "s|TRAEFIK_DASHBOARD_AUTH=.*|TRAEFIK_DASHBOARD_AUTH=$TRAEFIK_AUTH|" "$CONFIG_FILE"
    fi
    
    # Database
    POSTGRES_PASSWORD=$(openssl rand -hex 16)
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" "$CONFIG_FILE"
    
    # JWT Secret
    JWT_SECRET=$(openssl rand -hex 32)
    sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" "$CONFIG_FILE"
    
    # Authentik
    echo ""
    read -p "Enter Authentik URL (e.g., https://auth.scoliologic.ru): " AUTHENTIK_URL
    sed -i "s|AUTHENTIK_URL=.*|AUTHENTIK_URL=$AUTHENTIK_URL|" "$CONFIG_FILE"
    
    read -p "Enter Authentik Client ID: " AUTHENTIK_CLIENT_ID
    sed -i "s/AUTHENTIK_CLIENT_ID=.*/AUTHENTIK_CLIENT_ID=$AUTHENTIK_CLIENT_ID/" "$CONFIG_FILE"
    
    read -s -p "Enter Authentik Client Secret: " AUTHENTIK_CLIENT_SECRET
    echo ""
    sed -i "s/AUTHENTIK_CLIENT_SECRET=.*/AUTHENTIK_CLIENT_SECRET=$AUTHENTIK_CLIENT_SECRET/" "$CONFIG_FILE"
    
    # S3 Storage
    echo ""
    print_info "S3 Storage Configuration (for media files)"
    read -p "Enter S3 Endpoint (e.g., https://s3.example.com): " S3_ENDPOINT
    sed -i "s|S3_ENDPOINT=.*|S3_ENDPOINT=$S3_ENDPOINT|" "$CONFIG_FILE"
    
    read -p "Enter S3 Bucket name: " S3_BUCKET
    sed -i "s/S3_BUCKET=.*/S3_BUCKET=$S3_BUCKET/" "$CONFIG_FILE"
    
    read -p "Enter S3 Access Key: " S3_ACCESS_KEY
    sed -i "s/S3_ACCESS_KEY=.*/S3_ACCESS_KEY=$S3_ACCESS_KEY/" "$CONFIG_FILE"
    
    read -s -p "Enter S3 Secret Key: " S3_SECRET_KEY
    echo ""
    sed -i "s/S3_SECRET_KEY=.*/S3_SECRET_KEY=$S3_SECRET_KEY/" "$CONFIG_FILE"
    
    print_success "Configuration saved to $CONFIG_FILE"
else
    print_info "Using existing configuration from $CONFIG_FILE"
fi

# ============ CREATE NETWORKS ============
print_info "Creating Docker networks..."

if [[ "$DEPLOY_CHOICE" == "1" ]]; then
    docker network create traefik-public 2>/dev/null || true
else
    # Check if traefik-public exists
    if ! docker network ls | grep -q traefik-public; then
        print_error "Network 'traefik-public' not found. Please create it or use Full Stack deployment."
        exit 1
    fi
fi

# ============ START SERVICES ============
print_info "Starting services..."

cd "$INSTALL_DIR/deploy"

# Load environment
set -a
source "$CONFIG_FILE"
set +a

# Start with appropriate compose file
if [[ "$WITH_OLLAMA" == "true" ]]; then
    docker compose -f "$COMPOSE_FILE" --profile ai up -d
else
    docker compose -f "$COMPOSE_FILE" up -d
fi

# ============ PULL OLLAMA MODELS ============
if [[ "$WITH_OLLAMA" == "true" || "$DEPLOY_CHOICE" == "1" ]]; then
    print_info "Pulling Ollama models (this may take a while)..."
    
    # Wait for Ollama to be ready
    sleep 10
    
    # Pull default models
    docker exec wiki-ollama ollama pull llama3.2 || true
    docker exec wiki-ollama ollama pull nomic-embed-text || true
    
    print_success "Ollama models pulled"
fi

# ============ COMPLETE ============
echo ""
echo "=========================================="
print_success "Installation Complete!"
echo "=========================================="
echo ""
echo "Your Scoliologic Wiki is now running at:"
echo "  https://$WIKI_DOMAIN"
echo ""
echo "Configuration file: $CONFIG_FILE"
echo ""
echo "Useful commands:"
echo "  cd $INSTALL_DIR/deploy"
echo "  docker compose -f $COMPOSE_FILE logs -f    # View logs"
echo "  docker compose -f $COMPOSE_FILE restart    # Restart services"
echo "  docker compose -f $COMPOSE_FILE down       # Stop services"
echo ""
if [[ "$DEPLOY_CHOICE" == "1" ]]; then
    echo "Traefik Dashboard: https://traefik.$BASE_DOMAIN"
fi
echo ""
print_info "Don't forget to configure your Authentik OAuth application!"
print_info "Redirect URI: https://$WIKI_DOMAIN/api/oauth/callback"
echo ""
