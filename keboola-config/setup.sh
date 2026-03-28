#!/bin/bash
set -Eeuo pipefail

echo "=== Environment info ==="
echo "Python: $(which python3 || which python)"
echo "Pip: $(which pip3 || which pip || echo 'not found')"
echo "Node: $(which node || echo 'not found')"
echo "NPM: $(which npm || echo 'not found')"
echo "PWD: $(pwd)"
echo "Contents of /app: $(ls /app/)"
echo "Looking for venv..."
find / -name "pip" -type f 2>/dev/null | head -5 || true

echo "=== Installing backend dependencies ==="
cd /app/backend
pip3 install -r requirements.txt || pip install -r requirements.txt

echo "=== Installing Node.js ==="
if ! command -v node &> /dev/null; then
    echo "Node.js not found, installing..."
    apt-get update -qq && apt-get install -y -qq curl
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
fi
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"

echo "=== Building frontend ==="
cd /app/frontend
npm install --legacy-peer-deps
npm run build

echo "=== Setup complete ==="
