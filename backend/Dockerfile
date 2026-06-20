FROM python:3.14-slim

# Prevent python cache files
ENV PYTHONDONTWRITEBYTECODE=1

# Enable immediate logging
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# System packages
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies first
COPY requirements.txt .

RUN pip install --upgrade pip

RUN pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
