# Railway Dockerfile for Django deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create startup script
RUN echo '#!/bin/bash\n\
echo "Starting Django migrations..."\n\
python manage.py migrate\n\
echo "Collecting static files..."\n\
python manage.py collectstatic --noinput\n\
echo "Starting Gunicorn on port $PORT..."\n\
gunicorn --bind 0.0.0.0:$PORT --workers 2 --timeout 60 stockcompass.wsgi:application' > /app/start.sh

RUN chmod +x /app/start.sh

# Start command
CMD ["/app/start.sh"]
