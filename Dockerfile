# Production Dockerfile for Railway deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create staticfiles directory
RUN mkdir -p /app/staticfiles

# Start command for production
CMD python manage.py migrate && \
    python manage.py collectstatic --noinput && \
    gunicorn --bind 0.0.0.0:${PORT:-8080} \
             --workers 2 \
             --timeout 60 \
             --max-requests 1000 \
             --max-requests-jitter 100 \
             stockcompass.wsgi:application