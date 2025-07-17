/**
 * Backend status management
 * Handles backend connection status and retries
 */

const { ipcRenderer } = require('electron')

class BackendStatus {
  constructor() {
    this.isReady = false
    this.isChecking = false
    this.listeners = []
    this.checkInterval = null
    
    // Listen for backend status from main process
    ipcRenderer.on('backend-ready', () => {
      this.setReady(true)
    })
    
    ipcRenderer.on('backend-error', (event, error) => {
      console.error('Backend error:', error)
      this.setReady(false)
      // Start checking for backend availability
      this.startChecking()
    })
    
    // Start checking immediately
    this.checkBackend()
  }
  
  setReady(ready) {
    if (this.isReady !== ready) {
      this.isReady = ready
      this.notifyListeners(ready)
      
      if (ready && this.checkInterval) {
        clearInterval(this.checkInterval)
        this.checkInterval = null
      }
    }
  }
  
  startChecking() {
    if (this.checkInterval) return
    
    this.checkInterval = setInterval(() => {
      this.checkBackend()
    }, 2000) // Check every 2 seconds
  }
  
  async checkBackend() {
    if (this.isChecking || this.isReady) return
    
    this.isChecking = true
    try {
      const response = await fetch('http://localhost:8080/', {
        method: 'GET',
        timeout: 1000 // 1 second timeout
      })
      
      if (response.ok) {
        this.setReady(true)
      }
    } catch (error) {
      // Backend not ready yet
      if (!this.checkInterval) {
        this.startChecking()
      }
    } finally {
      this.isChecking = false
    }
  }
  
  onStatusChange(callback) {
    this.listeners.push(callback)
    // Immediately call with current status
    callback(this.isReady)
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }
  
  notifyListeners(ready) {
    this.listeners.forEach(listener => {
      try {
        listener(ready)
      } catch (error) {
        console.error('Error in backend status listener:', error)
      }
    })
  }
  
  async waitForBackend(timeout = 30000) {
    if (this.isReady) return true
    
    return new Promise((resolve) => {
      const startTime = Date.now()
      
      const unsubscribe = this.onStatusChange((ready) => {
        if (ready || Date.now() - startTime > timeout) {
          unsubscribe()
          resolve(ready)
        }
      })
    })
  }
}

module.exports = new BackendStatus()