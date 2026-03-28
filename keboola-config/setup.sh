#!/bin/bash
set -Eeuo pipefail

echo "=== Installing Python backend dependencies ==="
cd /app && uv sync &

echo "=== Installing Node.js frontend dependencies ==="
cd /app/frontend && npm install --legacy-peer-deps &

wait

echo "=== Building Next.js frontend ==="
cd /app/frontend && npm run build

echo "=== Copying static assets for standalone mode ==="
cp -r /app/frontend/public /app/frontend/.next/standalone/frontend/public 2>/dev/null || true
cp -r /app/frontend/.next/static /app/frontend/.next/standalone/frontend/.next/static 2>/dev/null || true

echo "=== Setup complete ==="
