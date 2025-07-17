#!/usr/bin/env node

/**
 * Package the app with Python backend
 */

const fs = require('fs')
const path = require('path')
const cp = require('child_process')

console.log('Packaging ByteStream with Backend...')

// 1. Build the app
console.log('Step 1: Building app...')
cp.execSync('npm run build', { stdio: 'inherit' })

// 2. Copy backend files to the root directory for packaging
const backendSrc = path.join(__dirname, '..', 'backend', 'app_online.py')
const backendDest = path.join(__dirname, '..', 'app_online.py')
const executableSrc = path.join(__dirname, '..', 'bytestream-backend')
const executableDest = path.join(__dirname, '..', 'bytestream-backend-temp')

// Copy app_online.py
if (fs.existsSync(backendSrc)) {
  fs.copyFileSync(backendSrc, backendDest)
  console.log('Copied app_online.py to root directory')
} else {
  console.error('Error: app_online.py not found in backend directory!')
  process.exit(1)
}

// Copy executable if it exists
if (fs.existsSync(executableSrc)) {
  fs.copyFileSync(executableSrc, executableDest)
  console.log('Copied bytestream-backend executable to root directory')
}

// 3. Run the regular package script
console.log('Step 2: Packaging app...')
cp.execSync('npm run package', { stdio: 'inherit' })

// 4. Clean up - remove temporary files from root
fs.unlinkSync(backendDest)
if (fs.existsSync(executableDest)) {
  fs.unlinkSync(executableDest)
}
console.log('Cleaned up temporary files')

console.log('\nPackaging complete!')
console.log('\nIMPORTANT: End users will need:')
console.log('1. Python 3.x installed')
console.log('2. Required Python packages: flask, flask-cors, requests, beautifulsoup4')
console.log('\nTo install Python packages:')
console.log('pip install flask flask-cors requests beautifulsoup4')