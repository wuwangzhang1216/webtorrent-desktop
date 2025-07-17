#!/bin/bash

# Run the packaged ByteStream app with standalone backend

echo "Starting ByteStream with standalone backend..."
echo "The backend server will start automatically."
echo ""

# Run the packaged app
./dist/ByteStream-darwin-x64/ByteStream.app/Contents/MacOS/ByteStream

echo "ByteStream closed."