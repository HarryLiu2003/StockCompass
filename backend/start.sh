#!/bin/bash

# Railway Production Start Script for Django

set -e  # Exit on any error

echo "🚀 Starting StockCompass Backend..."

# Run migrations
echo "📊 Running database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "📦 Collecting static files..."
python manage.py collectstatic --noinput

# Start gunicorn server
echo "🌐 Starting Gunicorn server..."
exec gunicorn \
    --bind 0.0.0.0:${PORT:-8080} \
    --workers 2 \
    --timeout 60 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    stockcompass.wsgi:application
