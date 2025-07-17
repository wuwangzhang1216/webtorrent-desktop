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

// 2. Copy app_online.py to the root directory for packaging
const backendSrc = path.join(__dirname, '..', 'backend', 'app_online.py')
const backendDest = path.join(__dirname, '..', 'app_online.py')

if (fs.existsSync(backendSrc)) {
  fs.copyFileSync(backendSrc, backendDest)
  console.log('Copied app_online.py to root directory')
} else {
  console.error('Error: app_online.py not found in backend directory!')
  process.exit(1)
}

// 3. Run the regular package script
console.log('Step 2: Packaging app...')
cp.execSync('npm run package', { stdio: 'inherit' })

// 4. Clean up - remove app_online.py from root
fs.unlinkSync(backendDest)
console.log('Cleaned up temporary files')

console.log('\nPackaging complete!')
console.log('\nIMPORTANT: End users will need:')
console.log('1. Python 3.x installed')
console.log('2. Required Python packages: flask, flask-cors, requests, beautifulsoup4')
console.log('\nTo install Python packages:')
console.log('pip install flask flask-cors requests beautifulsoup4')