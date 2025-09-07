# Simple Dockerfile for Railway deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Collect static files
RUN python manage.py collectstatic --noinput --clear

# Expose port
EXPOSE $PORT

# Start command
CMD python manage.py migrate && gunicorn --bind 0.0.0.0:$PORT --workers 2 stockcompass.wsgi:application
