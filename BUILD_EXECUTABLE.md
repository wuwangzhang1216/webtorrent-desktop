# Building ByteStream Desktop with Python Backend

This guide explains how to build an executable version of ByteStream Desktop that includes the Python backend for movie scraping.

## Prerequisites

1. Node.js and npm installed
2. Python 3.x installed
3. Git

## Build Options

### Option 1: Package with Python Script (Requires Python on end-user machine)

This creates an app bundle that includes `app_online.py`. End users need Python installed.

```bash
# Install dependencies
npm install

# Build and package the app with backend
npm run package-with-backend
```

The packaged app will include `app_online.py` and automatically start the backend server when launched.

### Option 2: Create Standalone Executable (No Python required)

This creates a standalone executable for the backend using PyInstaller.

```bash
# Install Python dependencies (only needed for building)
pip install flask flask-cors requests beautifulsoup4 pyinstaller

# Create standalone backend executable
npm run build-backend

# This creates bytestream-backend (or bytestream-backend.exe on Windows) in the root directory

# Then package the app normally
npm run package
```

The standalone executable is about 13MB and includes all Python dependencies bundled inside.

## How it Works

1. When the Electron app starts, it checks for:
   - First: A standalone backend executable (`bytestream-backend` or `bytestream-backend.exe`)
   - Second: The Python script `app_online.py`

2. The backend server runs on `http://localhost:8080` and provides the movie API

3. The backend is automatically stopped when the app quits

## Distribution

### For Option 1 (Python Script):
Tell users they need:
- Python 3.x installed
- Run: `pip install flask flask-cors requests beautifulsoup4`

### For Option 2 (Standalone):
- No additional requirements for end users
- The backend executable is included in the app bundle

## Development

During development, the backend runs from `backend/app_online.py`. Just run:

```bash
npm start
```

The app will automatically detect and start the backend server.

## Troubleshooting

1. **Backend fails to start**: Check Python is installed and in PATH
2. **Port 8080 already in use**: Close any other servers using that port
3. **Movies don't load**: Check the backend console output for errors

## Files Involved

- `backend/app_online.py` - The Python backend server
- `src/main/backend-manager.js` - Manages starting/stopping the backend
- `src/main/index.js` - Modified to start backend on app launch
- `bin/package-with-backend.js` - Build script for packaging with backend