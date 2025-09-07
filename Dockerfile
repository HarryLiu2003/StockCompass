# Railway Dockerfile for Django deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Minimal Railway deployment - skip collectstatic to isolate issue
CMD echo "PORT is: $PORT" && echo "Starting Django..." && python manage.py migrate && echo "Migrations done" && echo "Skipping collectstatic for debugging" && echo "Starting Gunicorn on 0.0.0.0:${PORT:-8080}" && gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 120 --log-level debug --access-logfile - --error-logfile - stockcompass.wsgi:application
