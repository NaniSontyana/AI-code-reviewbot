# Production Dockerfile for DocuMind AI ML Microservice
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the SentenceTransformer model into the image cache
# This avoids downloading the 120MB model at runtime during boot
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy application source code
COPY . .

# Set environment variables
ENV PORT=5001
ENV PYTHONUNBUFFERED=1

EXPOSE 5001

# Use Gunicorn as the production WSGI server
CMD ["gunicorn", "--workers", "1", "--bind", "0.0.0.0:5001", "--timeout", "120", "app:app"]
