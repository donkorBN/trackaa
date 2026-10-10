#!/bin/sh
# Container start: adapt to the host (Render or any Docker host), migrate, then serve.
set -e
cd /var/www/html

# Render's generateValue gives plain base64 (256 bits); Laravel expects a "base64:" prefix.
case "$APP_KEY" in
  "") echo "APP_KEY is not set. Generate one with: php artisan key:generate --show" >&2; exit 1 ;;
  base64:*) ;;
  *) export APP_KEY="base64:$APP_KEY" ;;
esac

# Render tells the service its public URL; use it unless set explicitly.
export APP_URL="${APP_URL:-${RENDER_EXTERNAL_URL:-http://localhost:${PORT:-10000}}}"
export FRONTEND_URL="${FRONTEND_URL:-$APP_URL}"

# Listen on the port the host gives us.
PORT="${PORT:-10000}"
sed -ri "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

php artisan config:cache
php artisan route:cache
php artisan migrate --force

exec apache2-foreground
