/* globals MediaMetadata */

const React = require('react')
const BitField = require('bitfield').default
const prettyBytes = require('prettier-bytes')

const TorrentSummary = require('../lib/torrent-summary')
const Playlist = require('../lib/playlist')
const { dispatch, dispatcher } = require('../lib/dispatcher')
const config = require('../../config')
const { calculateEta } = require('../lib/time')

// Shows a streaming video player. Standard features + Chromecast + Airplay
module.exports = class Player extends React.Component {
  render () {
    // Show the video as large as will fit in the window, play immediately
    // If the video is on Chromecast or Airplay, show a title screen instead
    const state = this.props.state
    const showVideo = state.playing.location === 'local'
    const showControls = state.playing.location !== 'external'
    
    return (
      <div
        className='player'
        onWheel={handleVolumeWheel}
        onMouseMove={dispatcher('mediaMouseMoved')}
      >
        <div
          className='player-home-button'
          onClick={dispatcher('backToList')}
          role='button'
          aria-label='Back to home'
          title='Back to torrent list'
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {showVideo ? renderMedia(state) : renderCastScreen(state)}
        {showControls ? renderPlayerControls(state) : null}
      </div>
    )
  }

  onComponentWillUnmount () {
    // Unload the media element so that Chromium stops trying to fetch data
    const tag = document.querySelector('audio,video')
    if (!tag) return
    tag.pause()
    tag.src = ''
    tag.load()
    navigator.mediaSession.metadata = null
  }
}

// Handles volume change by wheel
function handleVolumeWheel (e) {
  dispatch('changeVolume', (-e.deltaY | e.deltaX) / 500)
}

function renderMedia (state) {
  if (!state.server || !state.playing.isReady) {
    // Show loading animation while video is loading
    return (
      <div className='letterbox'>
        <div className='video-loading-overlay'>
          <div className='video-loading-spinner' />
        </div>
      </div>
    )
  }

  // Unfortunately, play/pause can't be done just by modifying HTML.
  // Instead, grab the DOM node and play/pause it if necessary
  // Get the <video> or <audio> tag
  const mediaElement = document.querySelector(state.playing.type)
  if (mediaElement !== null) {
    if (navigator.mediaSession.metadata === null && mediaElement.played.length !== 0) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: state.playing.fileName
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        dispatch('playPause')
      })
      navigator.mediaSession.setActionHandler('play', () => {
        dispatch('playPause')
      })
      if (Playlist.hasNext(state)) {
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          dispatch('nextTrack')
        })
      }
      if (Playlist.hasPrevious(state)) {
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          dispatch('previousTrack')
        })
      }
    }

    if (state.playing.isPaused && !mediaElement.paused) {
      mediaElement.pause()
    } else if (!state.playing.isPaused && mediaElement.paused) {
      mediaElement.play()
    }
    // When the user clicks or drags on the progress bar, jump to that position
    if (state.playing.jumpToTime != null) {
      mediaElement.currentTime = state.playing.jumpToTime
      state.playing.jumpToTime = null
    }
    if (state.playing.playbackRate !== mediaElement.playbackRate) {
      mediaElement.playbackRate = state.playing.playbackRate
    }
    // Recover previous volume
    if (state.previousVolume !== null && isFinite(state.previousVolume)) {
      mediaElement.volume = state.previousVolume
      state.previousVolume = null
    }

    // Set volume
    if (state.playing.setVolume !== null && isFinite(state.playing.setVolume)) {
      mediaElement.volume = state.playing.setVolume
      state.playing.setVolume = null
    }

    // Switch to the newly added subtitle track, if available
    const tracks = mediaElement.textTracks || []
    for (let j = 0; j < tracks.length; j++) {
      const isSelectedTrack = j === state.playing.subtitles.selectedIndex
      tracks[j].mode = isSelectedTrack ? 'showing' : 'hidden'
    }

    // Save video position
    const file = state.getPlayingFileSummary()
    file.currentTime = state.playing.currentTime = mediaElement.currentTime
    file.duration = state.playing.duration = mediaElement.duration

    // Save selected subtitle
    if (state.playing.subtitles.selectedIndex !== -1) {
      const index = state.playing.subtitles.selectedIndex
      file.selectedSubtitle = state.playing.subtitles.tracks[index].filePath
    } else if (file.selectedSubtitle != null) {
      delete file.selectedSubtitle
    }

    // Switch to selected audio track
    const audioTracks = mediaElement.audioTracks || []
    for (let j = 0; j < audioTracks.length; j++) {
      const isSelectedTrack = j === state.playing.audioTracks.selectedIndex
      audioTracks[j].enabled = isSelectedTrack
    }

    state.playing.volume = mediaElement.volume
  }

  // Add subtitles to the <video> tag
  const trackTags = []
  if (state.playing.subtitles.selectedIndex >= 0) {
    state.playing.subtitles.tracks.forEach((track, i) => {
      const isSelected = state.playing.subtitles.selectedIndex === i
      trackTags.push(
        <track
          key={i}
          default={isSelected}
          label={track.label}
          kind='subtitles'
          src={track.buffer}
        />
      )
    })
  }

  // Create the <audio> or <video> tag
  const MediaTagName = state.playing.type
  const mediaURL = Playlist.getCurrentLocalURL(state)
  
  // Check if video is buffering
  const showLoadingOverlay = state.playing.isStalled || 
    (state.playing.location === 'local' && !state.playing.isReady)
  
  const mediaTag = (
    <MediaTagName
      src={mediaURL}
      autoPlay
      onDoubleClick={dispatcher('toggleFullScreen')}
      onClick={dispatcher('playPause')}
      onLoadedMetadata={onLoadedMetadata}
      onEnded={onEnded}
      onLoadStart={dispatcher('mediaLoadStart')}
      onCanPlay={dispatcher('mediaCanPlay')}
      onWaiting={dispatcher('mediaStalled')}
      onPlaying={dispatcher('mediaPlaying')}
      onStalled={dispatcher('mediaStalled')}
      onError={(e) => {
        console.error('Media error event:', e)
        console.error('Media element error:', e.target.error)
        dispatcher('mediaError')(e)
      }}
      onTimeUpdate={dispatcher('mediaTimeUpdate')}
      onEncrypted={dispatcher('mediaEncrypted')}
    >
      {trackTags}
    </MediaTagName>
  )

  // Show the media.
  return (
    <div
      key='letterbox'
      className='letterbox'
      onMouseMove={dispatcher('mediaMouseMoved')}
    >
      {mediaTag}
      {showLoadingOverlay && (
        <div className='video-loading-overlay'>
          <div className='video-loading-spinner' />
        </div>
      )}
      {renderOverlay(state)}
    </div>
  )

  function onLoadedMetadata (e) {
    const mediaElement = e.target

    // check if we can decode video and audio track
    if (state.playing.type === 'video') {
      if (mediaElement.videoTracks.length === 0) {
        dispatch('mediaError', 'Video codec unsupported')
      }

      if (mediaElement.audioTracks.length === 0) {
        dispatch('mediaError', 'Audio codec unsupported')
      }

      dispatch('mediaSuccess')

      const dimensions = {
        width: mediaElement.videoWidth,
        height: mediaElement.videoHeight
      }

      // As soon as we know the video dimensions, resize the window
      dispatch('setDimensions', dimensions)

      // set audioTracks
      const tracks = []
      for (let i = 0; i < mediaElement.audioTracks.length; i++) {
        tracks.push({
          label: mediaElement.audioTracks[i].label || `Track ${i + 1}`,
          language: mediaElement.audioTracks[i].language
        })
      }

      state.playing.audioTracks.tracks = tracks
      state.playing.audioTracks.selectedIndex = 0
    }

    // check if we can decode audio track
    if (state.playing.type === 'audio') {
      if (mediaElement.audioTracks.length === 0) {
        dispatch('mediaError', 'Audio codec unsupported')
      }

      dispatch('mediaSuccess')
    }
  }

  function onEnded () {
    if (Playlist.hasNext(state)) {
      dispatch('nextTrack')
    } else {
      // When the last video completes, pause the video instead of looping
      state.playing.isPaused = true
      if (state.window.isFullScreen) dispatch('toggleFullScreen')
    }
  }
}

function renderOverlay (state) {
  const elems = []
  const audioMetadataElem = renderAudioMetadata(state)
  // Removed loading spinner - we don't want any loading indicators on the left
  if (audioMetadataElem) elems.push(audioMetadataElem)

  // Video fills the window, centered with black bars if necessary
  // Audio gets a static poster image and a summary of the file metadata.
  let style
  if (state.playing.type === 'audio') {
    style = { backgroundImage: cssBackgroundImagePoster(state) }
  } else if (elems.length !== 0) {
    style = { backgroundImage: cssBackgroundImageDarkGradient() }
  } else {
    // Video playing, so no spinner. No overlay needed
    return
  }

  return (
    <div key='overlay' className='media-overlay-background' style={style}>
      <div className='media-overlay'>{elems}</div>
    </div>
  )
}

/**
 * Render track or disk number string
 * @param common metadata.common part
 * @param key should be either 'track' or 'disk'
 * @return track or disk number metadata as JSX block
 */
function renderTrack (common, key) {
  // Audio metadata: track-number
  if (common[key] && common[key].no) {
    let str = `${common[key].no}`
    if (common[key].of) {
      str += ` of ${common[key].of}`
    }
    const style = { textTransform: 'capitalize' }
    return (
      <div className={`audio-${key}`}>
        <label style={style}>{key}</label> {str}
      </div>
    )
  }
}

function renderAudioMetadata (state) {
  const fileSummary = state.getPlayingFileSummary()
  if (!fileSummary.audioInfo) return
  const common = fileSummary.audioInfo.common || {}

  // Get audio track info
  const title = common.title ? common.title : fileSummary.name

  // Show a small info box in the middle of the screen with title/album/etc
  const elems = []

  // Audio metadata: artist(s)
  const artist = common.artist || common.albumartist
  if (artist) {
    elems.push((
      <div key='artist' className='audio-artist'>
        <label>Artist</label>{artist}
      </div>
    ))
  }

  // Audio metadata: disk & track-number
  const count = ['track', 'disk']
  count.forEach(key => {
    const nrElem = renderTrack(common, key)
    if (nrElem) {
      elems.push(nrElem)
    }
  })

  // Audio metadata: album
  if (common.album) {
    elems.push((
      <div key='album' className='audio-album'>
        <label>Album</label>{common.album}
      </div>
    ))
  }

  // Audio metadata: year
  if (common.year) {
    elems.push((
      <div key='year' className='audio-year'>
        <label>Year</label>{common.year}
      </div>
    ))
  }

  // Audio metadata: release information (label & catalog-number)
  if (common.label || common.catalognumber) {
    const releaseInfo = []
    if (common.label && common.catalognumber &&
      common.label.length === common.catalognumber.length) {
      // Assume labels & catalog-numbers are pairs
      for (let n = 0; n < common.label.length; ++n) {
        releaseInfo.push(common.label[0] + ' / ' + common.catalognumber[n])
      }
    } else {
      if (common.label) {
        releaseInfo.push(...common.label)
      }
      if (common.catalognumber) {
        releaseInfo.push(...common.catalognumber)
      }
    }
    elems.push((
      <div key='release' className='audio-release'>
        <label>Release</label>{releaseInfo.join(', ')}
      </div>
    ))
  }

  // Audio metadata: format
  const format = []
  fileSummary.audioInfo.format = fileSummary.audioInfo.format || ''
  if (fileSummary.audioInfo.format.container) {
    format.push(fileSummary.audioInfo.format.container)
  }
  if (fileSummary.audioInfo.format.codec &&
    fileSummary.audioInfo.format.container !== fileSummary.audioInfo.format.codec) {
    format.push(fileSummary.audioInfo.format.codec)
  }
  if (fileSummary.audioInfo.format.bitrate) {
    format.push(Math.round(fileSummary.audioInfo.format.bitrate / 1000) + ' kbit/s') // 128 kbit/s
  }
  if (fileSummary.audioInfo.format.sampleRate) {
    format.push(Math.round(fileSummary.audioInfo.format.sampleRate / 100) / 10 + ' kHz')
  }
  if (fileSummary.audioInfo.format.bitsPerSample) {
    format.push(fileSummary.audioInfo.format.bitsPerSample + '-bit')
  }
  if (format.length > 0) {
    elems.push((
      <div key='format' className='audio-format'>
        <label>Format</label>{format.join(', ')}
      </div>
    ))
  }

  // Audio metadata: comments
  if (common.comment) {
    elems.push((
      <div key='comments' className='audio-comments'>
        <label>Comments</label>{common.comment.join(' / ')}
      </div>
    ))
  }

  // Align the title with the other info, if available. Otherwise, center title
  const emptyLabel = (<label />)
  elems.unshift((
    <div key='title' className='audio-title'>
      {elems.length ? emptyLabel : undefined}{title}
    </div>
  ))

  return (<div key='audio-metadata' className='audio-metadata'>{elems}</div>)
}

// Removed loading spinner function - we don't want any loading indicators on the overlay
// function renderLoadingSpinner (state) {
//   if (state.playing.isPaused) return
//   const isProbablyStalled = state.playing.isStalled ||
//     (new Date().getTime() - state.playing.lastTimeUpdate > 2000)
//   if (!isProbablyStalled) return
//
//   const prog = state.getPlayingTorrentSummary().progress || {}
//   let fileProgress = 0
//   if (prog.files) {
//     const file = prog.files[state.playing.fileIndex]
//     fileProgress = Math.floor(100 * file.numPiecesPresent / file.numPieces)
//   }
//
//   return (
//     <div key='loading' className='media-stalled'>
//       <div key='loading-spinner' className='loading-spinner' />
//       <div key='loading-progress' className='loading-status ellipsis'>
//         <span><span className='progress'>{fileProgress}%</span> downloaded</span>
//         <span> ↓ {prettyBytes(prog.downloadSpeed || 0)}/s</span>
//         <span> ↑ {prettyBytes(prog.uploadSpeed || 0)}/s</span>
//       </div>
//     </div>
//   )
// }

function renderCastScreen (state) {
  // Add safety check
  if (!state.playing || !state.playing.location) {
    console.error('Invalid player state:', state.playing)
    return (
      <div className='letterbox' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <h2>Loading player...</h2>
        </div>
      </div>
    )
  }

  let castIcon, castType, isCast
  if (state.playing.location.startsWith('chromecast')) {
    castIcon = 'cast_connected'
    castType = 'Chromecast'
    isCast = true
  } else if (state.playing.location.startsWith('airplay')) {
    castIcon = 'airplay'
    castType = 'AirPlay'
    isCast = true
  } else if (state.playing.location.startsWith('dlna')) {
    castIcon = 'tv'
    castType = 'DLNA'
    isCast = true
  } else if (state.playing.location === 'external') {
    castIcon = 'tv'
    castType = state.getExternalPlayerName()
    isCast = false
  } else if (state.playing.location === 'error') {
    castIcon = 'error_outline'
    castType = 'Unable to Play'
    isCast = false
  }

  const isStarting = state.playing.location.endsWith('-pending')
  const castName = state.playing.castName
  const fileSummary = state.getPlayingFileSummary()
  const fileName = fileSummary ? fileSummary.name : ''
  let castStatus
  if (isCast && isStarting) castStatus = 'Connecting to ' + castName + '...'
  else if (isCast && !isStarting) castStatus = 'Connected to ' + castName
  else castStatus = ''

  const prog = state.getPlayingTorrentSummary().progress || {}

  // Show a nice title image, if possible
  const style = {
    backgroundImage: cssBackgroundImagePoster(state)
  }

  function renderEta (total, downloaded) {
    const missing = (total || 0) - (downloaded || 0)
    const downloadSpeed = prog.downloadSpeed || 0
    if (downloadSpeed === 0 || missing === 0) return

    const etaStr = calculateEta(missing, downloadSpeed)

    return (<span>{etaStr}</span>)
  }

  function renderDownloadProgress () {
    if (!prog.files) return

    const fileProg = prog.files[state.playing.fileIndex]
    const fileProgress = fileProg.numPiecesPresent / fileProg.numPieces
    const fileLength = state.getPlayingFileSummary().length
    const fileDownloaded = fileProgress * fileLength

    const progress = Math.round(100 * fileProgress)
    const total = prettyBytes(fileLength)
    const completed = prettyBytes(fileDownloaded)

    const downloadSpeed = prettyBytes(prog.downloadSpeed || 0)
    const uploadSpeed = prettyBytes(prog.uploadSpeed || 0)

    let sizes
    if (fileProgress < 1) {
      sizes = <span> | {completed} / {total}</span>
    } else {
      sizes = <span> | {completed}</span>
    }

    return (
      <div key='download-progress'>
        <span className='progress'>{progress}% downloaded {sizes}</span>
        <br />
        <span>↓ {downloadSpeed}/s ↑ {uploadSpeed}/s | {prog.numPeers || 0} peer(s)</span>
        <br />
        {renderEta(fileLength, fileDownloaded)}
      </div>
    )
  }

  return (
    <div key='cast' className='letterbox' style={style}>
      <div className='cast-screen'>
        <i className='icon'>{castIcon}</i>
        <div key='type' className='cast-type'>{castType}</div>
        <div key='status' className='cast-status'>{castStatus}</div>
        <div key='name' className='name'>{fileName}</div>
        {renderDownloadProgress()}
      </div>
    </div>
  )
}

function renderCastOptions (state) {
  if (!state.devices.castMenu) return

  const { location, devices } = state.devices.castMenu
  const player = state.devices[location]

  const items = devices.map((device, ix) => {
    const isSelected = player.device === device
    const name = device.name
    return (
      <li key={ix} onClick={dispatcher('selectCastDevice', ix)}>
        <i className='icon'>{isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}</i>
        {' '}
        {name}
      </li>
    )
  })

  return (
    <ul key='cast-options' className='options-list'>
      {items}
    </ul>
  )
}

function renderSubtitleOptions (state) {
  const subtitles = state.playing.subtitles
  if (!subtitles.tracks.length || !subtitles.showMenu) return

  const items = subtitles.tracks.map((track, ix) => {
    const isSelected = state.playing.subtitles.selectedIndex === ix
    return (
      <li key={ix} onClick={dispatcher('selectSubtitle', ix)}>
        <i className='icon'>{'radio_button_' + (isSelected ? 'checked' : 'unchecked')}</i>
        {track.label}
      </li>
    )
  })

  const noneSelected = state.playing.subtitles.selectedIndex === -1
  const noneClass = 'radio_button_' + (noneSelected ? 'checked' : 'unchecked')
  return (
    <ul key='subtitle-options' className='options-list'>
      {items}
      <li onClick={dispatcher('selectSubtitle', -1)}>
        <i className='icon'>{noneClass}</i>
        None
      </li>
    </ul>
  )
}

function renderAudioTrackOptions (state) {
  const audioTracks = state.playing.audioTracks
  if (!audioTracks.tracks.length || !audioTracks.showMenu) return

  const items = audioTracks.tracks.map((track, ix) => {
    const isSelected = state.playing.audioTracks.selectedIndex === ix
    return (
      <li key={ix} onClick={dispatcher('selectAudioTrack', ix)}>
        <i className='icon'>{'radio_button_' + (isSelected ? 'checked' : 'unchecked')}</i>
        {track.label}
      </li>
    )
  })

  return (
    <ul key='audio-track-options' className='options-list'>
      {items}
    </ul>
  )
}

function renderPlayerControls (state) {
  const positionPercent = 100 * state.playing.currentTime / state.playing.duration
  const playbackCursorStyle = { left: 'calc(' + positionPercent + '% - 3px)' }
  const captionsClass = state.playing.subtitles.tracks.length === 0
    ? 'disabled'
    : state.playing.subtitles.selectedIndex >= 0
      ? 'active'
      : ''
  const multiAudioClass = state.playing.audioTracks.tracks.length > 1
    ? 'active'
    : 'disabled'
  const prevClass = Playlist.hasPrevious(state) ? '' : 'disabled'
  const nextClass = Playlist.hasNext(state) ? '' : 'disabled'

  const elements = [
    renderPreview(state),

    <div key='playback-bar' className='playback-bar'>
      {/* Removed loading bar - no red loading indicators needed */}
      <div
        key='cursor'
        className='playback-cursor'
        style={playbackCursorStyle}
      />
      <div
        key='scrub-bar'
        className='scrub-bar'
        draggable='true'
        onMouseMove={handleScrubPreview}
        onMouseOut={clearPreview}
        onDragStart={handleDragStart}
        onClick={handleScrub}
        onDrag={handleScrub}
      />
    </div>,

    <i
      key='skip-previous'
      className={'icon skip-previous float-left ' + prevClass}
      onClick={dispatcher('previousTrack')}
      role='button'
      aria-label='Previous track'
    >
      skip_previous
    </i>,

    <i
      key='play'
      className='icon play-pause float-left'
      onClick={dispatcher('playPause')}
      role='button'
      aria-label={state.playing.isPaused ? 'Play' : 'Pause'}
    >
      {state.playing.isPaused ? 'play_arrow' : 'pause'}
    </i>,

    <i
      key='skip-next'
      className={'icon skip-next float-left ' + nextClass}
      onClick={dispatcher('nextTrack')}
      role='button'
      aria-label='Next track'
    >
      skip_next
    </i>,

    <i
      key='fullscreen'
      className='icon fullscreen float-right'
      onClick={dispatcher('toggleFullScreen')}
      role='button'
      aria-label={state.window.isFullScreen ? 'Exit full screen' : 'Enter full screen'}
    >
      {state.window.isFullScreen ? 'fullscreen_exit' : 'fullscreen'}
    </i>
  ]

  if (state.playing.type === 'video') {
    // Show closed captions icon
    elements.push((
      <i
        key='subtitles'
        className={'icon closed-caption float-right ' + captionsClass}
        onClick={handleSubtitles}
        role='button'
        aria-label='Closed captions'
      >
        closed_caption
      </i>
    ), (
      <i
        key='audio-tracks'
        className={'icon multi-audio float-right ' + multiAudioClass}
        onClick={handleAudioTracks}
      >
        library_music
      </i>
    ))
  }

  // If we've detected a Chromecast or AppleTV, the user can play video there
  const castTypes = ['chromecast', 'airplay', 'dlna']
  const isCastingAnywhere = castTypes.some(
    (castType) => state.playing.location.startsWith(castType))

  // Add the cast buttons. Icons for each cast type, connected/disconnected:
  const buttonIcons = {
    chromecast: { true: 'cast_connected', false: 'cast' },
    airplay: { true: 'airplay', false: 'airplay' },
    dlna: { true: 'tv', false: 'tv' }
  }
  castTypes.forEach(castType => {
    // Do we show this button (eg. the Chromecast button) at all?
    const isCasting = state.playing.location.startsWith(castType)
    const player = state.devices[castType]
    if ((!player || player.getDevices().length === 0) && !isCasting) return

    // Show the button. Three options for eg the Chromecast button:
    let buttonClass, buttonHandler
    if (isCasting) {
      // Option 1: we are currently connected to Chromecast. Button stops the cast.
      buttonClass = 'active'
      buttonHandler = dispatcher('stopCasting')
    } else if (isCastingAnywhere) {
      // Option 2: we are currently connected somewhere else. Button disabled.
      buttonClass = 'disabled'
      buttonHandler = undefined
    } else {
      // Option 3: we are not connected anywhere. Button opens Chromecast menu.
      buttonClass = ''
      buttonHandler = dispatcher('toggleCastMenu', castType)
    }
    const buttonIcon = buttonIcons[castType][isCasting]

    elements.push((
      <i
        key={castType}
        className={'icon device float-right ' + buttonClass}
        onClick={buttonHandler}
      >
        {buttonIcon}
      </i>
    ))
  })

  // Render volume slider
  const volume = state.playing.volume
  const volumeIcon = 'volume_' + (
    volume === 0
      ? 'off'
      : volume < 0.3
        ? 'mute'
        : volume < 0.6
          ? 'down'
          : 'up'
  )
  const volumeStyle = {
    background: '-webkit-gradient(linear, left top, right top, ' +
      'color-stop(' + (volume * 100) + '%, #eee), ' +
      'color-stop(' + (volume * 100) + '%, #727272))'
  }

  elements.push((
    <div key='volume' className='volume float-left'>
      <i
        className='icon volume-icon float-left'
        onMouseDown={handleVolumeMute}
        role='button'
        aria-label='Mute'
      >
        {volumeIcon}
      </i>
      <input
        className='volume-slider float-right'
        type='range' min='0' max='1' step='0.05'
        value={volume}
        onChange={handleVolumeScrub}
        style={volumeStyle}
      />
    </div>
  ))

  // Show video playback progress
  const currentTimeStr = formatTime(state.playing.currentTime, state.playing.duration)
  const durationStr = formatTime(state.playing.duration, state.playing.duration)
  elements.push((
    <span key='time' className='time float-left'>
      {currentTimeStr} / {durationStr}
    </span>
  ))

  // Render playback rate
  if (state.playing.playbackRate !== 1) {
    elements.push((
      <span key='rate' className='rate float-left'>
        {state.playing.playbackRate}x
      </span>
    ))
  }

  const emptyImage = new window.Image(0, 0)
  emptyImage.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs%3D'
  function handleDragStart (e) {
    if (e.dataTransfer) {
      const dt = e.dataTransfer
      // Prevent the cursor from changing, eg to a green + icon on Mac
      dt.effectAllowed = 'none'
      // Prevent ghost image
      dt.setDragImage(emptyImage, 0, 0)
    }
  }

  // Handles a scrub hover (preview another position in the video)
  function handleScrubPreview (e) {
    // Only show for videos
    if (!e.clientX || state.playing.type !== 'video') return
    dispatch('mediaMouseMoved')
    dispatch('preview', e.clientX)
  }

  function clearPreview () {
    if (state.playing.type !== 'video') return
    dispatch('clearPreview')
  }

  // Handles a click or drag to scrub (jump to another position in the video)
  function handleScrub (e) {
    if (!e.clientX) return
    dispatch('mediaMouseMoved')
    const windowWidth = document.querySelector('body').clientWidth
    const fraction = e.clientX / windowWidth
    const duration = state.playing.duration || 0
    const position = fraction * duration /* seconds */
    if (isFinite(position) && position >= 0) {
      dispatch('skipTo', position)
    }
  }

  // Handles volume muting and Unmuting
  function handleVolumeMute () {
    if (state.playing.volume === 0.0) {
      dispatch('setVolume', 1.0)
    } else {
      dispatch('setVolume', 0.0)
    }
  }

  // Handles volume slider scrub
  function handleVolumeScrub (e) {
    dispatch('setVolume', e.target.value)
  }

  function handleSubtitles (e) {
    if (!state.playing.subtitles.tracks.length || e.ctrlKey || e.metaKey) {
      // if no subtitles available select it
      dispatch('openSubtitles')
    } else {
      dispatch('toggleSubtitlesMenu')
    }
  }

  function handleAudioTracks () {
    dispatch('toggleAudioTracksMenu')
  }

  return (
    <div
      key='controls' className='controls'
      onMouseEnter={dispatcher('mediaControlsMouseEnter')}
      onMouseLeave={dispatcher('mediaControlsMouseLeave')}
    >
      {elements}
      {renderCastOptions(state)}
      {renderSubtitleOptions(state)}
      {renderAudioTrackOptions(state)}
    </div>
  )
}

function renderPreview (state) {
  const { previewXCoord = null } = state.playing

  // Calculate time from x-coord as fraction of track width
  const windowWidth = document.querySelector('body').clientWidth
  const fraction = previewXCoord / windowWidth
  const duration = state.playing.duration || 0
  const time = fraction * duration /* seconds */

  const height = 70
  let width = 0

  const previewEl = document.querySelector('video#preview')
  if (previewEl !== null && previewXCoord !== null && isFinite(time) && time >= 0) {
    try {
      previewEl.currentTime = time
    } catch (err) {
      console.warn('Failed to set preview time:', err)
    }

    // Auto adjust width to maintain video aspect ratio
    width = Math.floor((previewEl.videoWidth / previewEl.videoHeight) * height)
  }

  // Center preview window on mouse cursor,
  // while avoiding falling off the left or right edges
  const xPos = Math.min(Math.max(previewXCoord - (width / 2), 5), windowWidth - width - 5)

  return (
    <div
      key='preview' style={{
        position: 'absolute',
        bottom: 50,
        left: xPos,
        display: previewXCoord == null && 'none' // Hide preview when XCoord unset
      }}
    >
      <div style={{ width, height, backgroundColor: 'black' }}>
        <video
          src={Playlist.getCurrentLocalURL(state)}
          id='preview'
          muted
          style={{ border: '1px solid lightgrey', borderRadius: 2 }}
        />
      </div>
      <p
        style={{
          textAlign: 'center', margin: 5, textShadow: '0 0 2px rgba(0,0,0,.5)', color: '#eee'
        }}
      >
        {formatTime(time, state.playing.duration)}
      </p>
    </div>
  )
}

// Renders the loading bar. Shows which parts of the torrent are loaded, which
// can be 'spongey' / non-contiguous
function renderLoadingBar (state) {
  if (config.IS_TEST) return // Don't integration test the loading bar. Screenshots won't match.

  const torrentSummary = state.getPlayingTorrentSummary()
  if (!torrentSummary || !torrentSummary.progress) {
    return null
  }

  // Find all contiguous parts of the torrent which are loaded
  const prog = torrentSummary.progress
  const fileProg = prog.files && prog.files[state.playing.fileIndex]

  if (!fileProg || !prog.bitfield) return null

  const parts = []
  let lastPiecePresent = false
  for (let i = fileProg.startPiece; i <= fileProg.endPiece; i++) {
    const partPresent = BitField.prototype.get.call(prog.bitfield, i)
    if (partPresent && !lastPiecePresent) {
      parts.push({ start: i - fileProg.startPiece, count: 1 })
    } else if (partPresent) {
      parts[parts.length - 1].count++
    }
    lastPiecePresent = partPresent
  }

  // Output some bars to show which parts of the file are loaded
  const loadingBarElems = parts.map((part, i) => {
    const style = {
      left: (100 * part.start / fileProg.numPieces) + '%',
      width: (100 * part.count / fileProg.numPieces) + '%'
    }

    return (<div key={i} className='loading-bar-part' style={style} />)
  })

  return (<div key='loading-bar' className='loading-bar'>{loadingBarElems}</div>)
}

// Returns the CSS background-image string for a poster image + dark vignette
function cssBackgroundImagePoster (state) {
  const torrentSummary = state.getPlayingTorrentSummary()
  const posterPath = TorrentSummary.getPosterPath(torrentSummary)
  if (!posterPath) return ''
  return cssBackgroundImageDarkGradient() + `, url('${posterPath}')`
}

function cssBackgroundImageDarkGradient () {
  return 'radial-gradient(circle at center, ' +
    'rgba(0,0,0,0.4) 0%, rgba(0,0,0,1) 100%)'
}

function formatTime (time, total) {
  if (typeof time !== 'number' || Number.isNaN(time)) {
    return '0:00'
  }

  const totalHours = Math.floor(total / 3600)
  const totalMinutes = Math.floor(total / 60)
  const hours = Math.floor(time / 3600)
  let minutes = Math.floor(time % 3600 / 60)
  if (totalMinutes > 9 && minutes < 10) {
    minutes = '0' + minutes
  }
  const seconds = `0${Math.floor(time % 60)}`.slice(-2)

  return (totalHours > 0 ? hours + ':' : '') + minutes + ':' + seconds
}
