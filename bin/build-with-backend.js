#!/usr/bin/env node

/**
 * Builds app binaries with Python backend included
 */

const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const config = require('../src/config')

console.log('Building WebTorrent with Backend...')

// 1. First, build the regular app
console.log('Step 1: Building regular app...')
cp.execSync('npm run build', { stdio: 'inherit' })

// 2. Create a post-build script to bundle Python
const postBuildScript = `
const fs = require('fs')
const path = require('path')

// Copy backend files
const backendSrc = path.join(__dirname, '..', '..', '..', 'backend')
const backendDest = path.join(__dirname, '..', 'backend')

// Create backend directory if it doesn't exist
if (!fs.existsSync(backendDest)) {
  fs.mkdirSync(backendDest, { recursive: true })
}

// Copy Python files
const filesToCopy = ['app_online.py', 'requirements.txt']
filesToCopy.forEach(file => {
  const src = path.join(backendSrc, file)
  const dest = path.join(backendDest, file)
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest)
    console.log(\`Copied \${file}\`)
  }
})
`

// 3. Save post-build script
const postBuildPath = path.join(__dirname, 'post-build.js')
fs.writeFileSync(postBuildPath, postBuildScript)

// 4. Update package.json to include backend files
const packageJsonPath = path.join(config.ROOT_PATH, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// Add backend files to the files array if not already there
if (!packageJson.files) {
  packageJson.files = []
}
if (!packageJson.files.includes('backend/')) {
  packageJson.files.push('backend/')
}

// Save updated package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

console.log('Step 2: Running package script...')
cp.execSync('npm run package', { stdio: 'inherit' })

console.log('Build complete!')
console.log('Note: Users will need Python 3.x installed to run the app.')
console.log('Consider using PyInstaller to bundle the Python backend as an executable.')