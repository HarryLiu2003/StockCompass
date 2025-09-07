# Railway Dockerfile for Django deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Simple, direct start command (Railway best practice)
CMD python manage.py migrate && python manage.py collectstatic --noinput && gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 --log-level debug stockcompass.wsgi:application
