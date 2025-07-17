const React = require('react')
const { memo } = React
const { extractCleanTitle } = require('../lib/string-utils')

// SVG Icons
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>
)

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
)

class AppleMovieCard extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      imageLoaded: false,
      imageError: false
    }
  }

  handleAddToTorrentList = (e) => {
    e.stopPropagation()
    const { movie, onAddToTorrentList } = this.props
    
    const magnetLink = movie.download_links && movie.download_links.find(link => link.type === 'magnet')
    
    if (magnetLink) {
      onAddToTorrentList(movie, magnetLink.link)
    }
  }

  handleMovieClick = () => {
    this.props.onMovieClick(this.props.movie)
  }

  handleImageLoad = () => {
    this.setState({ imageLoaded: true })
  }

  handleImageError = () => {
    this.setState({ imageError: true })
  }

  getQualityBadge(quality) {
    if (!quality) return null
    
    const qualityLower = quality.toLowerCase()
    let qualityClass = 'quality-standard'
    let displayText = quality
    
    if (qualityLower.includes('4k') || qualityLower.includes('2160p')) {
      qualityClass = 'quality-4k'
      displayText = '4K'
    } else if (qualityLower.includes('1080p')) {
      qualityClass = 'quality-hd'
      displayText = 'HD'
    } else if (qualityLower.includes('720p')) {
      qualityClass = 'quality-hd'
      displayText = 'HD'
    }
    
    return (
      <div className={`apple-quality-badge ${qualityClass}`}>
        {displayText}
      </div>
    )
  }

  cleanJsonString(str) {
    if (!str) return ''
    // Remove square brackets and quotes, replace tabs with spaces
    return str.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()
  }

  formatMetadata(movie) {
    const items = []
    
    if (movie.year) items.push(movie.year)
    if (movie.genre) {
      const cleanGenre = this.cleanJsonString(movie.genre)
      items.push(cleanGenre.split(',')[0].trim())
    }
    if (movie.is_tv_show && movie.total_episodes) {
      items.push(`${movie.total_episodes} Episodes`)
    } else if (movie.duration) {
      items.push(movie.duration)
    }
    
    return items.join(' • ')
  }

  render() {
    const { movie } = this.props
    const { imageLoaded, imageError } = this.state
    
    if (!movie) return null

    const title = extractCleanTitle(movie.title || movie.full_title || 'Unknown Title', 50)
    const poster = movie.poster_hd || movie.poster
    const hasMagnetLink = movie.download_links && movie.download_links.some(link => link.type === 'magnet')
    const metadata = this.formatMetadata(movie)
    
    return (
      <div className="apple-movie-card" onClick={this.handleMovieClick}>
        <div className="apple-movie-poster">
          {!imageError && poster && (
            <img 
              src={poster} 
              alt={title}
              onLoad={this.handleImageLoad}
              onError={this.handleImageError}
              className={imageLoaded ? 'loaded' : ''}
            />
          )}
          {(!poster || imageError) && (
            <div className="apple-movie-placeholder">
              <div className="placeholder-icon">🎬</div>
            </div>
          )}
          
          {movie.quality && this.getQualityBadge(movie.quality)}
          
          {movie.is_tv_show && (
            <div className="apple-tv-badge">TV</div>
          )}
          
          {/* Hover overlay */}
          <div className="apple-movie-overlay">
            <div className="overlay-actions">
              {hasMagnetLink && (
                <button 
                  className="overlay-action-btn primary"
                  onClick={this.handleAddToTorrentList}
                  aria-label="Add to downloads"
                >
                  <DownloadIcon />
                  <span>Add</span>
                </button>
              )}
              <button 
                className="overlay-action-btn"
                onClick={this.handleMovieClick}
                aria-label="View details"
              >
                <InfoIcon />
                <span>Info</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="apple-movie-info">
          <h3 className="apple-movie-title">{title}</h3>
          {metadata && (
            <p className="apple-movie-metadata">{metadata}</p>
          )}
        </div>
      </div>
    )
  }
}

// Memoize to prevent unnecessary re-renders
module.exports = memo(AppleMovieCard, (prevProps, nextProps) => {
  return (
    prevProps.movie === nextProps.movie &&
    prevProps.onMovieClick === nextProps.onMovieClick &&
    prevProps.onAddToTorrentList === nextProps.onAddToTorrentList
  )
})