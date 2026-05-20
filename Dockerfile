FROM python:3.10-slim-bullseye

WORKDIR /app

# Install all system dependencies for MediaPipe and OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libopencv-dev \
    ffmpeg \
    libavcodec-extra \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY backend/ ./backend/

WORKDIR /app/backend
EXPOSE 10000

# Start the server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"]
