# Trackaa: one container serving the website (static Next.js export) and the Laravel API
# from the same origin. Built and run by Render (see render.yaml), works on any Docker host.

# ---- 1. Website: static export of the Next.js app ----
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# Same origin as the API, so the browser calls /api/... directly (no CORS).
ENV NEXT_PUBLIC_API_URL=/api NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 2. API dependencies ----
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction --ignore-platform-reqs
COPY backend/ ./
RUN composer dump-autoload --no-dev --optimize --no-interaction

# ---- 3. Runtime: PHP 8.3 + Apache ----
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev \
 && docker-php-ext-install pdo_pgsql opcache \
 && rm -rf /var/lib/apt/lists/* \
 && a2enmod rewrite headers

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
 && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf
COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-trackaa.ini"
COPY docker/apache.conf /etc/apache2/conf-enabled/zz-trackaa.conf
COPY docker/entrypoint.sh /usr/local/bin/trackaa-entrypoint

WORKDIR /var/www/html
COPY --from=vendor /app ./
# The website's files sit next to Laravel's index.php; Apache serves them directly.
COPY --from=web /web/out ./public
RUN php artisan package:discover --ansi \
 && chown -R www-data:www-data storage bootstrap/cache \
 && chmod +x /usr/local/bin/trackaa-entrypoint

ENV PORT=10000
EXPOSE 10000
CMD ["trackaa-entrypoint"]
