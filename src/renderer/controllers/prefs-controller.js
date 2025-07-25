const { dispatch } = require('../lib/dispatcher')
const { ipcRenderer } = require('electron')
const { scrollToTop } = require('../lib/smooth-scroll')

// Controls the Preferences screen
module.exports = class PrefsController {
  constructor (state, config) {
    this.state = state
    this.config = config
  }

  // Goes to the Preferences screen
  show () {
    const state = this.state
    state.location.go({
      url: 'preferences',
      setup (cb) {
        // initialize preferences
        state.window.title = 'Preferences'
        scrollToTop()
        ipcRenderer.send('setAllowNav', false)
        cb()
      },
      destroy: () => {
        ipcRenderer.send('setAllowNav', true)
      }
    })
  }

  // Updates a single property in the saved prefs
  // For example: updatePreferences('isFileHandler', true)
  update (property, value) {
    if (property === 'isFileHandler') ipcRenderer.send('setDefaultFileHandler', value)
    else if (property === 'startup') ipcRenderer.send('setStartup', value)

    this.state.saved.prefs[property] = value
    dispatch('stateSaveImmediate')
    dispatch('checkDownloadPath')
  }
}
