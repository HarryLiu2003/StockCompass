# Railway Dockerfile for Django deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Debug Railway startup issues - minimal command
CMD echo "PORT is: $PORT" && echo "Starting Django..." && python manage.py migrate && echo "Migrations done" && python manage.py collectstatic --noinput && echo "Static files done" && echo "Starting Gunicorn on 0.0.0.0:${PORT:-8080}" && gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 120 --log-level debug --access-logfile - --error-logfile - stockcompass.wsgi:application
