#!/usr/bin/env python3
"""
Optimized startup script for ByteStream backend
Uses waitress for production-ready performance
"""

import sys
import os

# Print startup message immediately
print("Starting ByteStream backend server...", flush=True)

try:
    # Try to use waitress for better performance
    from waitress import serve
    USE_WAITRESS = True
except ImportError:
    USE_WAITRESS = False
    print("Waitress not installed, falling back to Flask development server", flush=True)

# Import the app
from app_online import app

if __name__ == '__main__':
    port = 8080
    host = '0.0.0.0'
    
    if USE_WAITRESS:
        # Use waitress for production - much faster startup
        print(f"Running on http://127.0.0.1:{port}", flush=True)
        serve(app, host=host, port=port, threads=4)
    else:
        # Fall back to Flask development server
        print(f"Running on http://127.0.0.1:{port} (Flask dev server)", flush=True)
        app.run(debug=False, port=port, host=host)