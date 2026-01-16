#!/bin/bash
set -e

echo "==================================="
echo "Scoliologic Wiki - Pull Agent"
echo "==================================="
echo ""
echo "Configuration:"
echo "  Repository: ${GIT_REPO_URL}"
echo "  Branch: ${GIT_BRANCH}"
echo "  Pull Interval: ${PULL_INTERVAL}s"
echo "  Rollback on Failure: ${ROLLBACK_ON_FAILURE}"
echo ""

# Create necessary directories
mkdir -p /app/data /app/backups /app/logs

# Configure git
git config --global user.email "pull-agent@scoliologic.ru"
git config --global user.name "Pull Agent"
git config --global --add safe.directory /app/repo

# If token provided, configure git credentials
if [ -n "${GIT_TOKEN}" ]; then
    echo "Configuring git credentials..."
    git config --global credential.helper store
    echo "https://${GIT_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials
fi

# Start the agent
echo "Starting Pull Agent..."
exec node /app/agent.js
