#!/bin/bash
set -Eeuo pipefail

echo "Installing backend dependencies..."
cd /app/backend && /app/.venv/bin/pip install -r requirements.txt

echo "Installing Node.js and frontend dependencies..."
# Install Node.js if not available
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"

cd /app/frontend && npm install --legacy-peer-deps && npm run build

echo "Setup complete."
