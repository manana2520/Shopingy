#!/bin/bash
set -Eeuo pipefail

echo "Installing backend dependencies..."
cd /app/backend && pip install -r requirements.txt

echo "Installing frontend dependencies and building..."
cd /app/frontend && npm install && npm run build

echo "Setup complete."
