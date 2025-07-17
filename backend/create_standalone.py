#!/usr/bin/env python3
"""
Create a standalone executable of app_online.py using PyInstaller
"""

import os
import sys
import subprocess

def install_pyinstaller():
    """Install PyInstaller if not already installed"""
    try:
        import PyInstaller
    except ImportError:
        print("Installing PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

def create_standalone():
    """Create standalone executable"""
    print("Creating standalone backend executable...")
    
    # PyInstaller command
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",  # Single file executable
        "--name", "bytestream-backend",
        "--distpath", "..",  # Output to parent directory
        "--workpath", "build",
        "--specpath", "build",
        "--noconfirm",
        "--console",  # Keep console for backend server
        "--hidden-import", "flask",
        "--hidden-import", "flask_cors",
        "--hidden-import", "requests",
        "--hidden-import", "bs4",
        "--hidden-import", "beautifulsoup4",
        "app_online.py"
    ]
    
    # Run PyInstaller
    subprocess.check_call(cmd)
    
    print("\nStandalone executable created successfully!")
    print("Executable location: ../bytestream-backend" + (".exe" if sys.platform == "win32" else ""))

if __name__ == "__main__":
    install_pyinstaller()
    create_standalone()