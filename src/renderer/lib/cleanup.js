// Cleanup manager for intervals and event listeners to prevent memory leaks
const cleanupTasks = new Set()

// Track all intervals
const originalSetInterval = window.setInterval
const activeIntervals = new Set()

window.setInterval = function(callback, delay, ...args) {
  const intervalId = originalSetInterval(callback, delay, ...args)
  activeIntervals.add(intervalId)
  return intervalId
}

const originalClearInterval = window.clearInterval
window.clearInterval = function(intervalId) {
  activeIntervals.delete(intervalId)
  return originalClearInterval(intervalId)
}

// Register cleanup task
function registerCleanup(cleanupFn) {
  cleanupTasks.add(cleanupFn)
}

// Clear all intervals
function clearAllIntervals() {
  activeIntervals.forEach(intervalId => {
    clearInterval(intervalId)
  })
  activeIntervals.clear()
}

// Run all cleanup tasks
function cleanup() {
  console.log('Running cleanup tasks...')
  
  // Clear all intervals
  clearAllIntervals()
  
  // Run all registered cleanup tasks
  cleanupTasks.forEach(task => {
    try {
      task()
    } catch (err) {
      console.error('Cleanup task failed:', err)
    }
  })
  
  cleanupTasks.clear()
}

// Cleanup on window unload
window.addEventListener('beforeunload', cleanup)

module.exports = {
  registerCleanup,
  cleanup,
  clearAllIntervals
}