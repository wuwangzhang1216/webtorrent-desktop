const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

let backendProcess = null

// Find Python executable
function getPythonCommand() {
  // Try different Python commands
  const pythonCommands = ['python3', 'python']
  
  for (const cmd of pythonCommands) {
    try {
      const result = require('child_process').execSync(`${cmd} --version`, { encoding: 'utf8' })
      if (result.includes('Python')) {
        return cmd
      }
    } catch (e) {
      // Continue to next command
    }
  }
  
  throw new Error('Python not found. Please install Python 3.x')
}

// Start the backend server
function startBackend() {
  return new Promise((resolve, reject) => {
    // Check if backend is already running
    isBackendRunning().then(running => {
      if (running) {
        console.log('Backend already running on port 8080')
        resolve()
        return
      }
      
      // First check for standalone executable
      const execName = process.platform === 'win32' ? 'bytestream-backend.exe' : 'bytestream-backend'
      
      // Check multiple locations for the executable
      const possiblePaths = [
        // In packaged app Resources directory (macOS)
        path.join(process.resourcesPath, execName),
        // In packaged app root (Windows/Linux)
        path.join(path.dirname(process.execPath), execName),
        // Development path
        path.join(__dirname, '..', '..', execName)
      ]
      
      let execPath = null
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          execPath = p
          break
        }
      }
      
      if (execPath) {
        // Use standalone executable
        console.log('Starting backend server (standalone executable)...')
        console.log('Executable path:', execPath)
        
        backendProcess = spawn(execPath, [], {
          cwd: path.dirname(execPath),
          env: { ...process.env }
        })
      } else {
        // Fall back to Python script
        const pythonCmd = getPythonCommand()
        
        // Try start_optimized.py first for better performance
        let scriptPath = path.join(__dirname, '..', '..', 'backend', 'start_optimized.py')
        if (!fs.existsSync(scriptPath)) {
          // Fall back to app_online.py
          scriptPath = path.join(__dirname, '..', '..', 'backend', 'app_online.py')
        }
        
        console.log('Starting backend server (Python script)...')
        console.log('Python command:', pythonCmd)
        console.log('Script path:', scriptPath)
        
        // Check if script exists
        if (!fs.existsSync(scriptPath)) {
          reject(new Error(`Backend not found. Neither standalone executable nor backend Python scripts found`))
          return
        }
        
        backendProcess = spawn(pythonCmd, [scriptPath], {
          cwd: path.dirname(scriptPath),
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        })
      }
    
      backendProcess.stdout.on('data', (data) => {
        console.log(`Backend: ${data}`)
        // Check if server is ready
        if (data.toString().includes('Running on') || data.toString().includes('127.0.0.1:8080')) {
          // Wait a brief moment for server to fully initialize
          setTimeout(() => {
            isBackendRunning().then(running => {
              if (running) resolve()
            })
          }, 100)
        }
      })
    
      backendProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`)
      })
      
      backendProcess.on('error', (error) => {
        console.error('Failed to start backend:', error)
        reject(error)
      })
      
      backendProcess.on('close', (code) => {
        console.log(`Backend process exited with code ${code}`)
        backendProcess = null
      })
      
      // Set a shorter timeout for server startup
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          resolve() // Assume it's running if process is still alive
        } else {
          reject(new Error('Backend failed to start within timeout'))
        }
      }, 3000) // 3 second timeout - much faster
    }).catch(reject)
  })
}

// Stop the backend server
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend server...')
    backendProcess.kill()
    backendProcess = null
  }
}

// Check if backend is running
async function isBackendRunning() {
  try {
    const response = await fetch('http://localhost:8080/')
    return response.ok
  } catch (e) {
    return false
  }
}

module.exports = {
  startBackend,
  stopBackend,
  isBackendRunning
}