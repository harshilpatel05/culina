FROM node:20-bookworm-slim

WORKDIR /app

# Install Python and build tooling required by ML deps (e.g. lightgbm wheels/build)
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Install Python dependencies
COPY requirements.txt ./
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Copy app source
COPY . .

ENV NODE_ENV=production
ENV PYTHON_BIN=python3

EXPOSE 8080
CMD ["node", "index.js"]
