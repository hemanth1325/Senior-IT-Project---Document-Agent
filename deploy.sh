#!/bin/sh
cd /app
git pull origin prod
docker compose up -d --build
docker compose -f docker-compose-langflow.yml up -d --build
chmod +x deploy.sh
