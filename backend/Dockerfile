FROM python:3.12-slim

# System dependencies: libpq for psycopg2, libgdal for GeoAlchemy2/PostGIS,
# poppler-utils for PDF processing, build tools for native extensions.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libgdal-dev \
    poppler-utils \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies before copying application code so that Docker
# can cache the layer and avoid reinstalling on code-only changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY pyproject.toml .

# Non-root user for runtime security
RUN useradd --create-home --shell /bin/bash nwis \
    && mkdir -p /app/storage/uploads \
    && chown -R nwis:nwis /app
USER nwis

EXPOSE 8000

# Gunicorn with UvicornWorker: 2 workers per CPU core as a starting point.
# Override CMD via docker-compose for Celery workers.
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "2", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
