#!/bin/sh
cd /app
git pull origin prod
docker compose up -d --build
chmod +x deploy.sh