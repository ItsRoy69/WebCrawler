#!/usr/bin/env bash
# Quick build script for the frontend
# Usage: ./build_frontend.sh

set -e

echo "Building WebCrawler frontend..."
cd "$(dirname "$0")/frontend"

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Building..."
npm run build

echo "✅ Frontend built successfully!"
echo "Output: webcrawler/static/dist/"
echo ""
echo "Run 'webcrawler serve' to start the backend and open http://localhost:8000"
