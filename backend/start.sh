#!/bin/bash

# Start Celery worker in the background
celery -A neela_backend worker --loglevel=info --concurrency=2 &

# Start Gunicorn
gunicorn neela_backend.wsgi:application --bind 0.0.0.0:$PORT

