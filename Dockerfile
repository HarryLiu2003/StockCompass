# Production Dockerfile for Railway deployment
FROM python:3.11-slim

WORKDIR /app

# Copy backend files
COPY backend/ .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Create staticfiles directory
RUN mkdir -p /app/staticfiles

# Make start.sh executable
RUN chmod +x /app/start.sh

# Use start.sh as entrypoint
CMD ["/app/start.sh"]
