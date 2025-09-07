# Railway Dockerfile for Django deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Railway optimized start command with PORT fallback
CMD python manage.py migrate && python manage.py collectstatic --noinput && gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 1 --timeout 120 --log-level debug stockcompass.wsgi:application
