// To keep the UI snappy, we run WebTorrent in its own hidden window, a separate
// process from the main window.
console.time('init')

const crypto = require('crypto')
const util = require('util')
const { ipcRenderer } = require('electron')
const fs = require('fs')
const mm = require('music-metadata')
const networkAddress = require('network-address')
const path = require('path')
const WebTorrent = require('webtorrent')

const config = require('../config')
const { TorrentKeyNotFoundError } = require('./lib/errors')
const torrentPoster = require('./lib/torrent-poster')

/**
 * WebTorrent version.
 */
const VERSION = require('../../package.json').version

/**
 * Version number in Azureus-style. Generated from major and minor semver version.
 * For example:
 *   '0.16.1' -> '0016'
 *   '1.2.5' -> '0102'
 */
const VERSION_STR = VERSION
  .replace(/\d*./g, v => `0${v % 100}`.slice(-2))
  .slice(0, 4)

/**
 * Version prefix string (used in peer ID). WebTorrent uses the Azureus-style
 * encoding: '-', two characters for client id ('WW'), four ascii digits for version
 * number, '-', followed by random numbers.
 * For example:
 *   '-WW0102-'...
 */
const VERSION_PREFIX = '-WD' + VERSION_STR + '-'

/**
 * Generate an ephemeral peer ID each time.
 */
const PEER_ID = Buffer.from(VERSION_PREFIX + crypto.randomBytes(9).toString('base64'))

// Connect to the WebTorrent and BitTorrent networks. WebTorrent Desktop is a hybrid
// client, as explained here: https://webtorrent.io/faq
let client = window.client = new WebTorrent({ peerId: PEER_ID })

// WebTorrent-to-HTTP streaming sever
let server = null

// Used for diffing, so we only send progress updates when necessary
let prevProgress = null
let progressThrottleTimer = null
const PROGRESS_UPDATE_INTERVAL = 250 // Reduced from 1000ms to 250ms for smoother updates

// Cache for file progress calculations
const fileProgressCache = new WeakMap()

init()

function init () {
  listenToClientEvents()

  ipcRenderer.on('wt-set-global-trackers', (e, globalTrackers) =>
    setGlobalTrackers(globalTrackers))
  ipcRenderer.on('wt-start-torrenting', (e, torrentKey, torrentID, path, fileModtimes, selections) =>
    startTorrenting(torrentKey, torrentID, path, fileModtimes, selections))
  ipcRenderer.on('wt-stop-torrenting', (e, infoHash) =>
    stopTorrenting(infoHash))
  ipcRenderer.on('wt-create-torrent', (e, torrentKey, options) =>
    createTorrent(torrentKey, options))
  ipcRenderer.on('wt-save-torrent-file', (e, torrentKey) =>
    saveTorrentFile(torrentKey))
  ipcRenderer.on('wt-generate-torrent-poster', (e, torrentKey) =>
    generateTorrentPoster(torrentKey))
  ipcRenderer.on('wt-get-audio-metadata', (e, infoHash, index) =>
    getAudioMetadata(infoHash, index))
  ipcRenderer.on('wt-start-server', (e, infoHash) =>
    startServer(infoHash))
  ipcRenderer.on('wt-stop-server', () =>
    stopServer())
  ipcRenderer.on('wt-select-files', (e, infoHash, selections) =>
    selectFiles(infoHash, selections))

  ipcRenderer.send('ipcReadyWebTorrent')

  const errorHandler = (e) =>
    ipcRenderer.send('wt-uncaught-error', { message: e.error.message, stack: e.error.stack })
  window.addEventListener('error', errorHandler, true)
  
  // Cleanup error handler on unload
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('error', errorHandler, true)
  })

  const progressInterval = setInterval(updateTorrentProgress, 100) // Check more frequently, but updates are throttled
  
  // Cleanup on window unload
  window.addEventListener('beforeunload', () => {
    clearInterval(progressInterval)
    if (progressThrottleTimer) {
      clearTimeout(progressThrottleTimer)
      progressThrottleTimer = null
    }
  })
  console.timeEnd('init')
}

function listenToClientEvents () {
  client.on('warning', (err) => ipcRenderer.send('wt-warning', null, err.message))
  client.on('error', (err) => ipcRenderer.send('wt-error', null, err.message))
}

// Sets the default trackers
function setGlobalTrackers (globalTrackers) {
  globalThis.WEBTORRENT_ANNOUNCE = globalTrackers
}

// Starts a given TorrentID, which can be an infohash, magnet URI, etc.
// Returns a WebTorrent object. See https://git.io/vik9M
function startTorrenting (torrentKey, torrentID, path, fileModtimes, selections) {
  console.log('starting torrent %s: %s', torrentKey, torrentID)

  const torrent = client.add(torrentID, {
    path,
    fileModtimes
  })
  torrent.key = torrentKey

  // Listen for ready event, progress notifications, etc
  addTorrentEvents(torrent)

  // Only download the files the user wants, not necessarily all files
  torrent.once('ready', () => selectFiles(torrent, selections))
}

function stopTorrenting (infoHash) {
  console.log('--- STOP TORRENTING: ', infoHash)
  const torrent = client.get(infoHash)
  if (torrent) torrent.destroy()
}

// Create a new torrent, start seeding
function createTorrent (torrentKey, options) {
  console.log('creating torrent', torrentKey, options)
  const paths = options.files.map((f) => f.path)
  const torrent = client.seed(paths, options)
  torrent.key = torrentKey
  addTorrentEvents(torrent)
  ipcRenderer.send('wt-new-torrent')
}

function addTorrentEvents (torrent) {
  torrent.on('warning', (err) =>
    ipcRenderer.send('wt-warning', torrent.key, err.message))
  torrent.on('error', (err) =>
    ipcRenderer.send('wt-error', torrent.key, err.message))
  torrent.on('infoHash', () =>
    ipcRenderer.send('wt-parsed', torrent.key, torrent.infoHash, torrent.magnetURI))
  torrent.on('metadata', torrentMetadata)
  torrent.on('ready', torrentReady)
  torrent.on('done', torrentDone)

  function torrentMetadata () {
    const info = getTorrentInfo(torrent)
    ipcRenderer.send('wt-metadata', torrent.key, info)

    updateTorrentProgress()
  }

  function torrentReady () {
    const info = getTorrentInfo(torrent)
    ipcRenderer.send('wt-ready', torrent.key, info)
    ipcRenderer.send('wt-ready-' + torrent.infoHash, torrent.key, info)

    updateTorrentProgress()
  }

  function torrentDone () {
    const info = getTorrentInfo(torrent)
    ipcRenderer.send('wt-done', torrent.key, info)

    updateTorrentProgress()

    torrent.getFileModtimes((err, fileModtimes) => {
      if (err) return onError(err)
      ipcRenderer.send('wt-file-modtimes', torrent.key, fileModtimes)
    })
  }
}

// Produces a JSON saveable summary of a torrent
function getTorrentInfo (torrent) {
  return {
    infoHash: torrent.infoHash,
    magnetURI: torrent.magnetURI,
    name: torrent.name,
    path: torrent.path,
    files: torrent.files.map(getTorrentFileInfo),
    bytesReceived: torrent.received
  }
}

// Produces a JSON saveable summary of a file in a torrent
function getTorrentFileInfo (file) {
  return {
    name: file.name,
    length: file.length,
    path: file.path
  }
}

// Every time we resolve a magnet URI, save the torrent file so that we can use
// it on next startup. Starting with the full torrent metadata will be faster
// than re-fetching it from peers using ut_metadata.
function saveTorrentFile (torrentKey) {
  const torrent = getTorrent(torrentKey)
  const torrentPath = path.join(config.TORRENT_PATH, torrent.infoHash + '.torrent')

  fs.access(torrentPath, fs.constants.R_OK, err => {
    const fileName = torrent.infoHash + '.torrent'
    if (!err) {
      // We've already saved the file
      return ipcRenderer.send('wt-file-saved', torrentKey, fileName)
    }

    // Otherwise, save the .torrent file, under the app config folder
    fs.mkdir(config.TORRENT_PATH, { recursive: true }, _ => {
      fs.writeFile(torrentPath, torrent.torrentFile, err => {
        if (err) return console.log('error saving torrent file %s: %o', torrentPath, err)
        console.log('saved torrent file %s', torrentPath)
        return ipcRenderer.send('wt-file-saved', torrentKey, fileName)
      })
    })
  })
}

// Save a JPG that represents a torrent.
// Auto chooses either a frame from a video file, an image, etc
function generateTorrentPoster (torrentKey) {
  const torrent = getTorrent(torrentKey)
  torrentPoster(torrent, (err, buf, extension) => {
    if (err) return console.log('error generating poster: %o', err)
    // save it for next time
    fs.mkdir(config.POSTER_PATH, { recursive: true }, err => {
      if (err) return console.log('error creating poster dir: %o', err)
      const posterFileName = torrent.infoHash + extension
      const posterFilePath = path.join(config.POSTER_PATH, posterFileName)
      fs.writeFile(posterFilePath, buf, err => {
        if (err) return console.log('error saving poster: %o', err)
        // show the poster
        ipcRenderer.send('wt-poster', torrentKey, posterFileName)
      })
    })
  })
}

function updateTorrentProgress () {
  // Throttle progress updates to reduce CPU usage
  if (progressThrottleTimer) return
  
  progressThrottleTimer = setTimeout(() => {
    progressThrottleTimer = null
    const progress = getTorrentProgressOptimized()
    // Only send if there's a meaningful change
    if (prevProgress && isSimilarProgress(progress, prevProgress)) {
      return /* don't send heavy object if it hasn't changed significantly */
    }
    ipcRenderer.send('wt-progress', progress)
    prevProgress = progress
  }, PROGRESS_UPDATE_INTERVAL)
}

// Check if progress has changed meaningfully (not just download speed fluctuations)
function isSimilarProgress(curr, prev) {
  if (!curr || !prev) return false
  if (curr.progress !== prev.progress) return false
  if (curr.hasActiveTorrents !== prev.hasActiveTorrents) return false
  
  // Check each torrent for significant changes
  for (let i = 0; i < curr.torrents.length; i++) {
    const currTorrent = curr.torrents[i]
    const prevTorrent = prev.torrents.find(t => t.torrentKey === currTorrent.torrentKey)
    if (!prevTorrent) return false
    
    // Only care about meaningful progress changes (> 0.1%)
    if (Math.abs(currTorrent.progress - prevTorrent.progress) > 0.001) return false
    if (currTorrent.ready !== prevTorrent.ready) return false
    if (Math.abs(currTorrent.downloaded - prevTorrent.downloaded) > 1024 * 1024) return false // 1MB threshold
  }
  
  return true
}

// Optimized version that caches file progress and only updates when necessary
function getTorrentProgressOptimized () {
  // First, track overall progress
  const progress = client.progress
  const hasActiveTorrents = client.torrents.some(torrent => torrent.progress !== 1)

  // Track progress for every file in each torrent with caching
  const torrentProg = client.torrents.map(torrent => {
    // Only calculate file progress for active torrents or if not cached
    let fileProg = null
    if (torrent.progress < 1 || !fileProgressCache.has(torrent)) {
      fileProg = torrent.files && torrent.files.map(file => {
        // Use cached calculation if file hasn't changed
        const cacheKey = `${file._startPiece}-${file._endPiece}`
        const torrentCache = fileProgressCache.get(torrent) || {}
        
        if (torrentCache[cacheKey] && torrent.progress === 1) {
          return torrentCache[cacheKey]
        }
        
        const numPieces = file._endPiece - file._startPiece + 1
        let numPiecesPresent = 0
        
        // Optimize bitfield checking for completed torrents
        if (torrent.progress === 1) {
          numPiecesPresent = numPieces
        } else {
          // Only check pieces for incomplete torrents
          for (let piece = file._startPiece; piece <= file._endPiece; piece++) {
            if (torrent.bitfield.get(piece)) numPiecesPresent++
          }
        }
        
        const result = {
          startPiece: file._startPiece,
          endPiece: file._endPiece,
          numPieces,
          numPiecesPresent
        }
        
        // Cache the result
        if (!fileProgressCache.has(torrent)) {
          fileProgressCache.set(torrent, {})
        }
        fileProgressCache.get(torrent)[cacheKey] = result
        
        return result
      })
    } else {
      // Use fully cached data for completed torrents
      const cache = fileProgressCache.get(torrent)
      fileProg = torrent.files && torrent.files.map(file => {
        const cacheKey = `${file._startPiece}-${file._endPiece}`
        return cache[cacheKey]
      })
    }
    
    return {
      torrentKey: torrent.key,
      ready: torrent.ready,
      progress: torrent.progress,
      downloaded: torrent.downloaded,
      downloadSpeed: torrent.downloadSpeed,
      uploadSpeed: torrent.uploadSpeed,
      numPeers: torrent.numPeers,
      length: torrent.length,
      // Don't send bitfield over IPC - it's too heavy and rarely needed
      // bitfield: torrent.bitfield,
      files: fileProg
    }
  })

  return {
    torrents: torrentProg,
    progress,
    hasActiveTorrents
  }
}

// Keep original function for compatibility if needed
function getTorrentProgress () {
  return getTorrentProgressOptimized()
}

function startServer (infoHash) {
  const torrent = client.get(infoHash)
  if (torrent.ready) startServerFromReadyTorrent(torrent)
  else torrent.once('ready', () => startServerFromReadyTorrent(torrent))
}

function startServerFromReadyTorrent (torrent) {
  if (server) return

  // start the streaming torrent-to-http server
  server = torrent.createServer({
    // Add CORS headers for Electron
    origin: '*',
    // Add additional headers for better compatibility
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400'
    }
  })
  server.listen(0, () => {
    const port = server.address().port
    const urlSuffix = ':' + port
    const info = {
      torrentKey: torrent.key,
      localURL: 'http://localhost' + urlSuffix,
      networkURL: 'http://' + networkAddress() + urlSuffix,
      networkAddress: networkAddress()
    }

    ipcRenderer.send('wt-server-running', info)
    ipcRenderer.send('wt-server-' + torrent.infoHash, info)
  })
}

function stopServer () {
  if (!server) return
  server.destroy()
  server = null
}

function getAudioMetadata (infoHash, index) {
  const torrent = client.get(infoHash)
  const file = torrent.files[index]

  // Set initial matadata to display the filename first.
  const metadata = { title: file.name }
  ipcRenderer.send('wt-audio-metadata', infoHash, index, metadata)

  const options = {
    native: false,
    skipCovers: true,
    fileSize: file.length,
    observer: () => {
      ipcRenderer.send('wt-audio-metadata', infoHash, index, {
        common: metadata.common,
        format: metadata.format
      })
    }
  }
  const onMetadata = file.done
    // If completed; use direct file access
    ? mm.parseFile(path.join(torrent.path, file.path), options)
    // otherwise stream
    : mm.parseStream(file.createReadStream(), file.name, options)

  onMetadata
    .then(
      metadata => {
        ipcRenderer.send('wt-audio-metadata', infoHash, index, metadata)
      },
      err => {
        console.log(
          `error getting audio metadata for ${infoHash}:${index}`,
          err
        )
      }
    )
}

function selectFiles (torrentOrInfoHash, selections) {
  // Get the torrent object
  let torrent
  if (typeof torrentOrInfoHash === 'string') {
    torrent = client.get(torrentOrInfoHash)
  } else {
    torrent = torrentOrInfoHash
  }
  if (!torrent) {
    throw new Error('selectFiles: missing torrent ' + torrentOrInfoHash)
  }

  // Selections not specified?
  // Load all files. We still need to replace the default whole-torrent
  // selection with individual selections for each file, so we can
  // select/deselect files later on
  if (!selections) {
    selections = new Array(torrent.files.length).fill(true)
  }

  // Selections specified incorrectly?
  if (selections.length !== torrent.files.length) {
    throw new Error('got ' + selections.length + ' file selections, ' +
      'but the torrent contains ' + torrent.files.length + ' files')
  }

  // Remove default selection (whole torrent)
  torrent.deselect(0, torrent.pieces.length - 1, false)

  // Add selections (individual files)
  selections.forEach((selection, i) => {
    const file = torrent.files[i]
    if (selection) {
      file.select()
    } else {
      console.log('deselecting file ' + i + ' of torrent ' + torrent.name)
      file.deselect()
    }
  })
}

// Gets a WebTorrent handle by torrentKey
// Throws an Error if we're not currently torrenting anything w/ that key
function getTorrent (torrentKey) {
  const ret = client.torrents.find((x) => x.key === torrentKey)
  if (!ret) throw new TorrentKeyNotFoundError(torrentKey)
  return ret
}

function onError (err) {
  console.log(err)
}

// TODO: remove this once the following bugs are fixed:
// https://bugs.chromium.org/p/chromium/issues/detail?id=490143
// https://github.com/electron/electron/issues/7212
window.testOfflineMode = () => {
  client = window.client = new WebTorrent({
    peerId: PEER_ID,
    tracker: false,
    dht: false,
    webSeeds: false
  })
  listenToClientEvents()
}
