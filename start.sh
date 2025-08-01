#!/usr/bin/env bash
# start.sh — launch React frontend + Uvicorn backend on Linux/macOS

set -e

# Start backend
echo "Starting Uvicorn backend..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
echo $! > .backend.pid

# Start frontend
echo "Starting React frontend..."
cd frontend
npm start

# When the frontend stops, shut down the backend
echo "Shutting down backend..."
kill "$(cat ../.backend.pid)"
rm ../.backend.pid
