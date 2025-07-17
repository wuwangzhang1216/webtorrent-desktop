const React = require('react')
const prettyBytes = require('prettier-bytes')

const LinearProgress = require('material-ui/LinearProgress').default
const { clipboard } = require('electron')

const TorrentSummary = require('../lib/torrent-summary')
const TorrentPlayer = require('../lib/torrent-player')
const { dispatcher } = require('../lib/dispatcher')
const { calculateEta } = require('../lib/time')
const { isMagnetLink } = require('../lib/torrent-player')

module.exports = class TorrentList extends React.Component {
  render () {
    const state = this.props.state
    const viewMode = state.saved.prefs.viewMode || 'grid'

    const contents = []
    if (state.downloadPathStatus === 'missing') {
      contents.push(
        <div key='torrent-missing-path' className='torrent-missing-path'>
          <div className='missing-path-icon'>⚠️</div>
          <h3>Download Path Missing</h3>
          <p>Download path missing: {state.saved.prefs.downloadPath}</p>
          <p>Check that all drives are connected?</p>
          <p>Alternatively, choose a new download path in <a href='#' onClick={dispatcher('preferences')}>Preferences</a></p>
        </div>
      )
    }
    
    const torrentElems = state.saved.torrents.map(
      (torrentSummary) => this.renderTorrent(torrentSummary, viewMode)
    )
    contents.push(...torrentElems)

    // Show empty state if no torrents
    if (contents.length === 0) {
      contents.push(
        <div key='torrent-list-empty' className='torrent-list-empty'>
          <div className='empty-icon'>📁</div>
          <h3>No downloads yet</h3>
          <p>Your downloads will appear here. Add a torrent file or magnet link to get started.</p>
          <div className='empty-actions'>
            <button 
              className='add-torrent-btn' 
              onClick={dispatcher('openFiles')}
            >
              <i className='icon'>add</i>
              Add Torrent File
            </button>
            <button 
              className='add-magnet-btn' 
              onClick={dispatcher('openTorrentAddress')}
            >
              <i className='icon'>link</i>
              Add Magnet Link
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className='torrent-list-page'>
        {this.renderToolbar(viewMode)}
        <div
          key='torrent-list'
          className={`torrent-list ${viewMode}-view`}
          onContextMenu={dispatcher('openTorrentListContextMenu')}
        >
          {contents}
        </div>
      </div>
    )
  }

  renderToolbar (viewMode) {
    return (
      <div className='apple-torrent-toolbar'>
        <div className='toolbar-section'>
          <AppleAddButton />
          <div className='toolbar-divider' />
          <button
            className='apple-toolbar-button'
            onClick={dispatcher('toggleViewMode')}
            title={viewMode === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              {viewMode === 'grid' ? (
                <path d="M3 5v14h18V5H3zm2 2h14v10H5V7zm2 2v2h10V9H7zm0 4v2h10v-2H7z"/>
              ) : (
                <path d="M3 3v8h8V3H3zm6 6H5V5h4v4zm4-6v8h8V3h-8zm6 6h-4V5h4v4zM3 13v8h8v-8H3zm6 6H5v-4h4v4zm4-6v8h8v-8h-8zm6 6h-4v-4h4v4z"/>
              )}
            </svg>
            <span>{viewMode === 'grid' ? 'List' : 'Grid'}</span>
          </button>
        </div>
        
        <div className='toolbar-section'>
          <div className='toolbar-stats'>
            <span className='stat-item'>
              {this.props.state.saved.torrents.length} torrent{this.props.state.saved.torrents.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    )
  }

  renderTorrent (torrentSummary, viewMode) {
    const state = this.props.state
    const infoHash = torrentSummary.infoHash
    const isSelected = infoHash && state.selectedInfoHash === infoHash

    // Background image: show some nice visuals, like a frame from the movie, if possible
    const style = {}
    if (torrentSummary.posterFileName) {
      const gradient = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.4) 100%)'
      const posterPath = TorrentSummary.getPosterPath(torrentSummary)
      style.backgroundImage = `${gradient}, url('${posterPath}')`
    }

    // Foreground: name of the torrent, basic info like size, play button,
    // cast buttons if available, and delete
    const classes = ['torrent', `torrent-${viewMode}`]
    if (isSelected) classes.push('selected')
    if (!infoHash) classes.push('disabled')
    if (!torrentSummary.torrentKey) throw new Error('Missing torrentKey')
    return (
      <div
        id={torrentSummary.testID && ('torrent-' + torrentSummary.testID)}
        key={torrentSummary.torrentKey}
        style={style}
        className={classes.join(' ')}
        onContextMenu={infoHash && dispatcher('openTorrentContextMenu', infoHash)}
      >
        {this.renderTorrentMetadata(torrentSummary)}
        {infoHash ? this.renderTorrentButtons(torrentSummary) : null}
        {isSelected ? this.renderTorrentDetails(torrentSummary) : null}
        <hr />
      </div>
    )
  }

  // Show name, download status, % complete
  renderTorrentMetadata (torrentSummary) {
    const name = torrentSummary.name || 'Loading torrent...'
    const elements = [(
      <div key='name' className='name ellipsis'>{name}</div>
    )]

    // If it's downloading/seeding then show progress info
    const prog = torrentSummary.progress
    let progElems
    if (torrentSummary.error) {
      progElems = [getErrorMessage(torrentSummary)]
    } else if (torrentSummary.status !== 'paused' && prog) {
      progElems = [
        renderTorrentStatus(),
        renderProgressBar(),
        renderPercentProgress(),
        renderTotalProgress(),
        renderPeers(),
        renderSpeeds(),
        renderEta()
      ]
    } else {
      progElems = [
        renderTorrentStatus()
      ]
    }
    elements.push(
      <div key='progress-info' className='ellipsis'>
        {progElems}
      </div>
    )

    return (<div key='metadata' className='metadata'>{elements}</div>)

    function renderProgressBar () {
      const progress = Math.floor(100 * prog.progress)
      const styles = {
        wrapper: {
          display: 'inline-block',
          marginRight: 8
        },
        progress: {
          height: 8,
          width: 30
        }
      }
      return (
        <div key='progress-bar' style={styles.wrapper}>
          <LinearProgress style={styles.progress} mode='determinate' value={progress} />
        </div>
      )
    }

    function renderPercentProgress () {
      const progress = Math.floor(100 * prog.progress)
      return (<span key='percent-progress'>{progress}%</span>)
    }

    function renderTotalProgress () {
      const downloaded = prettyBytes(prog.downloaded)
      const total = prettyBytes(prog.length || 0)
      if (downloaded === total) {
        return (<span key='total-progress'>{downloaded}</span>)
      } else {
        return (<span key='total-progress'>{downloaded} / {total}</span>)
      }
    }

    function renderPeers () {
      if (prog.numPeers === 0) return
      const count = prog.numPeers === 1 ? 'peer' : 'peers'
      return (<span key='peers'>{prog.numPeers} {count}</span>)
    }

    function renderSpeeds () {
      let str = ''
      if (prog.downloadSpeed > 0) str += ' ↓ ' + prettyBytes(prog.downloadSpeed) + '/s'
      if (prog.uploadSpeed > 0) str += ' ↑ ' + prettyBytes(prog.uploadSpeed) + '/s'
      if (str === '') return
      return (<span key='download'>{str}</span>)
    }

    function renderEta () {
      const downloaded = prog.downloaded
      const total = prog.length || 0
      const missing = total - downloaded
      const downloadSpeed = prog.downloadSpeed
      if (downloadSpeed === 0 || missing === 0) return

      const etaStr = calculateEta(missing, downloadSpeed)

      return (<span key='eta'>{etaStr}</span>)
    }

    function renderTorrentStatus () {
      const { status } = torrentSummary
      let statusText, statusClass
      
      // Check if download is complete (100%)
      const isComplete = prog && prog.progress >= 1
      
      switch (status) {
        case 'downloading':
          statusText = 'Downloading'
          statusClass = 'status-downloading'
          break
        case 'seeding':
          // Show "Completed" instead of "Seeding" when progress is 100%
          statusText = isComplete ? 'Completed' : 'Seeding'
          statusClass = isComplete ? 'status-completed' : 'status-seeding'
          break
        case 'paused':
          statusText = 'Paused'
          statusClass = 'status-paused'
          break
        case 'new':
          statusText = 'Ready'
          statusClass = 'status-ready'
          break
        default:
          statusText = 'Loading...'
          statusClass = 'status-loading'
      }
      
      return (
        <span key='torrent-status' className={`torrent-status ${statusClass}`}>
          {statusText}
        </span>
      )
    }
  }

  // Download button toggles between torrenting (DL/seed) and paused
  // Play button starts streaming the torrent immediately, unpausing if needed
  renderTorrentButtons (torrentSummary) {
    const infoHash = torrentSummary.infoHash
    const isActive = ['downloading', 'seeding'].includes(torrentSummary.status)
    const isPaused = torrentSummary.status === 'paused'
    const isCompleted = torrentSummary.status === 'seeding'

    // Download/Pause button - hide when completed
    const prog = torrentSummary.progress
    const isFullyComplete = prog && prog.progress >= 1 && torrentSummary.status === 'seeding'
    
    let downloadButton = null
    if (!isFullyComplete) {
      // Only show download/pause button if not completed
      downloadButton = (
        <i
          key='download-button'
          title={isActive ? 'Downloading - Click to pause' : 'Start download'}
          className={`icon download-control ${torrentSummary.status}`}
          onClick={dispatcher('toggleTorrent', infoHash)}
        >
          {isActive ? 'pause' : 'play_arrow'}
        </i>
      )
    } else {
      // Show a completed checkmark icon instead
      downloadButton = (
        <i
          key='completed-icon'
          title='Download completed'
          className='icon completed'
          style={{ color: '#4CAF50', cursor: 'default' }}
        >
          check_circle
        </i>
      )
    }

    // Only show the stream button for torrents that contain playable media
    let streamButton
    if (!torrentSummary.error && TorrentPlayer.isPlayableTorrentSummary(torrentSummary)) {
      streamButton = (
        <i
          key='stream-button'
          title='Start streaming'
          className='icon stream'
          onClick={dispatcher('playFile', infoHash)}
        >
          play_circle_outline
        </i>
      )
    }

    return (
      <div className='torrent-controls'>
        {downloadButton}
        {streamButton}
        <i
          key='delete-button'
          className='icon delete'
          title='Remove torrent and files'
          onClick={dispatcher('confirmDeleteTorrent', infoHash, true)}
        >
          close
        </i>
      </div>
    )
  }

  // Show files, per-file download status and play buttons, and so on
  renderTorrentDetails (torrentSummary) {
    let filesElement
    if (torrentSummary.error || !torrentSummary.files) {
      let message = ''
      if (torrentSummary.error === 'path-missing') {
        // Special case error: this torrent's download dir or file is missing
        message = 'Missing path: ' + TorrentSummary.getFileOrFolder(torrentSummary)
      } else if (torrentSummary.error) {
        // General error for this torrent: just show the message
        message = torrentSummary.error.message || torrentSummary.error
      } else if (torrentSummary.status === 'paused') {
        // No file info, no infohash, and we're not trying to download from the DHT
        message = 'Failed to load torrent info. Click the download button to try again...'
      } else {
        // No file info, no infohash, trying to load from the DHT
        message = 'Downloading torrent info...'
      }
      filesElement = (
        <div key='files' className='files warning'>
          {message}
        </div>
      )
    } else {
      // We do know the files. List them and show download stats for each one
      const sortByName = this.props.state.saved.prefs.sortByName
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
      let fileRows = torrentSummary.files
        .filter((file) => !file.path.includes('/.____padding_file/'))
        .map((file, index) => ({ file, index }))

      if (sortByName) {
        fileRows = fileRows.sort((a, b) => collator.compare(a.file.name, b.file.name))
      }

      fileRows = fileRows.map((obj) => this.renderFileRow(torrentSummary, obj.file, obj.index))

      filesElement = (
        <div key='files' className='files'>
          <table>
            <tbody>
              {fileRows}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div key='details' className='torrent-details'>
        {filesElement}
      </div>
    )
  }

  // Show a single torrentSummary file in the details view for a single torrent
  renderFileRow (torrentSummary, file, index) {
    // First, find out how much of the file we've downloaded
    // Are we even torrenting it?
    const isSelected = torrentSummary.selections && torrentSummary.selections[index]
    let isDone = false // Are we finished torrenting it?
    let progress = ''
    if (torrentSummary.progress && torrentSummary.progress.files &&
        torrentSummary.progress.files[index]) {
      const fileProg = torrentSummary.progress.files[index]
      isDone = fileProg.numPiecesPresent === fileProg.numPieces
      progress = Math.floor(100 * fileProg.numPiecesPresent / fileProg.numPieces) + '%'
    }

    // Second, for media files where we saved our position, show how far we got
    let positionElem
    if (file.currentTime) {
      // Radial progress bar. 0% = start from 0:00, 270% = 3/4 of the way thru
      positionElem = this.renderRadialProgressBar(file.currentTime / file.duration)
    }

    // Finally, render the file as a table row
    const isPlayable = TorrentPlayer.isPlayable(file)
    const infoHash = torrentSummary.infoHash
    let icon
    let handleClick
    if (isPlayable) {
      icon = 'play_arrow' /* playable? add option to play */
      handleClick = dispatcher('playFile', infoHash, index)
    } else {
      icon = 'description' /* file icon, opens in OS default app */
      handleClick = isDone
        ? dispatcher('openPath', infoHash, index)
        : (e) => e.stopPropagation() // noop if file is not ready
    }
    // TODO: add a css 'disabled' class to indicate that a file cannot be opened/streamed
    let rowClass = ''
    if (!isSelected) rowClass = 'disabled' // File deselected, not being torrented
    if (!isDone && !isPlayable) rowClass = 'disabled' // Can't open yet, can't stream
    return (
      <tr key={index} onClick={handleClick}>
        <td className={'col-icon ' + rowClass}>
          {positionElem}
          <i className='icon'>{icon}</i>
        </td>
        <td className={'col-name ' + rowClass}>
          {file.name}
        </td>
        <td className={'col-progress ' + rowClass}>
          {isSelected ? progress : ''}
        </td>
        <td className={'col-size ' + rowClass}>
          {prettyBytes(file.length)}
        </td>
        <td
          className='col-select'
          onClick={dispatcher('toggleTorrentFile', infoHash, index)}
        >
          <i className='icon deselect-file'>{isSelected ? 'close' : 'add'}</i>
        </td>
      </tr>
    )
  }

  renderRadialProgressBar (fraction, cssClass) {
    const rotation = 360 * fraction
    const transformFill = { transform: 'rotate(' + (rotation / 2) + 'deg)' }
    const transformFix = { transform: 'rotate(' + rotation + 'deg)' }

    return (
      <div key='radial-progress' className={'radial-progress ' + cssClass}>
        <div className='circle'>
          <div className='mask full' style={transformFill}>
            <div className='fill' style={transformFill} />
          </div>
          <div className='mask half'>
            <div className='fill' style={transformFill} />
            <div className='fill fix' style={transformFix} />
          </div>
        </div>
        <div className='inset' />
      </div>
    )
  }
}

function stopPropagation (e) {
  e.stopPropagation()
}

function getErrorMessage (torrentSummary) {
  if (torrentSummary.error.message) {
    return torrentSummary.error.message
  }
  return torrentSummary.error
}

// Apple-style Add button for toolbar
class AppleAddButton extends React.Component {
  constructor(props) {
    super(props)
    this.state = { showMenu: false }
    this.menuRef = React.createRef()
    this.buttonRef = React.createRef()
  }

  componentDidMount() {
    document.addEventListener('click', this.handleClickOutside)
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
  }

  handleClickOutside = (event) => {
    if (this.menuRef.current && !this.menuRef.current.contains(event.target) &&
        this.buttonRef.current && !this.buttonRef.current.contains(event.target)) {
      this.setState({ showMenu: false })
    }
  }

  toggleMenu = () => {
    this.setState(prev => ({ showMenu: !prev.showMenu }))
  }

  handleUpload = () => {
    this.setState({ showMenu: false })
    require('../lib/dispatcher').dispatch('openFiles')
  }

  handleMagnet = () => {
    this.setState({ showMenu: false })
    require('../lib/dispatcher').dispatch('openTorrentAddress')
  }

  render() {
    const { showMenu } = this.state

    return (
      <div className='apple-add-wrapper'>
        <button
          ref={this.buttonRef}
          className='apple-toolbar-button primary'
          onClick={this.toggleMenu}
          aria-label='Add Torrent'
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <span>Add</span>
        </button>
        
        {showMenu && (
          <div ref={this.menuRef} className='apple-toolbar-dropdown'>
            <button className='dropdown-item' onClick={this.handleUpload}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
              </svg>
              <span>Upload Torrent File</span>
            </button>
            <div className='dropdown-divider' />
            <button className='dropdown-item' onClick={this.handleMagnet}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
              </svg>
              <span>Enter Magnet Link</span>
            </button>
          </div>
        )}
      </div>
    )
  }
}
