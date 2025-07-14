module.exports = {
  handleEvent
}

const { app } = require('electron')
const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn

const handlers = require('./handlers')

const EXE_NAME = path.basename(process.execPath)
const UPDATE_EXE = path.join(process.execPath, '..', '..', 'Update.exe')

const run = (args, done) => {
  // Check if Update.exe exists before trying to run it
  if (!fs.existsSync(UPDATE_EXE)) {
    console.warn('Update.exe not found, likely running in development mode')
    if (done) done(0)
    return
  }
  
  spawn(UPDATE_EXE, args, { detached: true })
    .on('close', done)
    .on('error', (err) => {
      console.error('Squirrel update error:', err.message)
      if (done) done(1)
    })
}

function handleEvent (cmd) {
  if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    run([`--createShortcut=${EXE_NAME}`], app.quit)
    return true
  }

  if (cmd === '--squirrel-uninstall') {
    // Uninstall .torrent file and magnet link handlers
    handlers.uninstall()

    run([`--removeShortcut=${EXE_NAME}`], app.quit)
    return true
  }

  if (cmd === '--squirrel-obsolete') {
    app.quit()
    return true
  }

  return false
}
