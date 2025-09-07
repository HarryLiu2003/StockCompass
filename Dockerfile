# Railway Dockerfile for Django deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create a proper startup script
COPY <<EOF /app/start.sh
#!/bin/bash
set -e

echo "=== Railway Django Startup Debug ==="
echo "PORT: \$PORT"
echo "DATABASE_URL: \${DATABASE_URL:0:50}..."
echo "DEBUG: \$DEBUG"

echo "Running migrations..."
python manage.py migrate

echo "Testing Django import..."
python -c "import stockcompass.wsgi; print('WSGI import successful')"

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:\${PORT:-8080} --workers 1 --timeout 120 --log-level info stockcompass.wsgi:application
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
