#!/bin/bash
set -Eeuo pipefail

echo "=== Installing Python backend dependencies ==="
cd /app && uv sync &

echo "=== Installing Node.js frontend dependencies ==="
cd /app/frontend && npm install --legacy-peer-deps &

wait

echo "=== Building Next.js frontend ==="
cd /app/frontend && npm run build

echo "=== Setup complete ==="
