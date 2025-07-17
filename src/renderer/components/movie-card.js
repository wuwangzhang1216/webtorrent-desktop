const React = require('react')
const { memo } = React
const { Card, CardActions, CardMedia, CardTitle, CardText } = require('material-ui/Card')
const FlatButton = require('material-ui/FlatButton').default
const RaisedButton = require('material-ui/RaisedButton').default
const Badge = require('material-ui/Badge').default
const DownloadIcon = require('material-ui/svg-icons/file/file-download').default
const InfoIcon = require('material-ui/svg-icons/action/info').default
const PlayIcon = require('material-ui/svg-icons/av/play-arrow').default
const colors = require('material-ui/styles/colors')
const path = require('path')
const config = require('../../config')
const { extractCleanTitle, decodeHtmlEntities } = require('../lib/string-utils')

class MovieCard extends React.Component {
  constructor(props) {
    super(props)
    
    this.handleAddToTorrentList = this.handleAddToTorrentList.bind(this)
    this.handleMovieClick = this.handleMovieClick.bind(this)
    
    // Create the proper fallback image path
    this.fallbackImage = 'file://' + path.join(config.STATIC_PATH, 'WebTorrent.png')
  }

  handleAddToTorrentList(e) {
    e.stopPropagation()
    const { movie, onAddToTorrentList } = this.props
    
    // For TV shows with episodes, find the first episode's magnet link
    if (movie.is_tv_show && movie.episodes && movie.episodes.length > 0) {
      const firstEpisode = movie.episodes[0]
      const magnetLink = firstEpisode.download_links && firstEpisode.download_links.find(link => link.type === 'magnet')
      if (magnetLink) {
        onAddToTorrentList(movie, magnetLink.link)
        return
      }
    }
    
    // Otherwise find the first magnet link in download_links
    const magnetLink = movie.download_links && movie.download_links.find(link => link.type === 'magnet')
    
    if (magnetLink) {
      onAddToTorrentList(movie, magnetLink.link)
    }
  }

  handleMovieClick() {
    this.props.onMovieClick(this.props.movie)
  }

  getQualityColor(quality) {
    if (!quality) return colors.grey500
    
    const qualityLower = quality.toLowerCase()
    if (qualityLower.includes('4k') || qualityLower.includes('2160p')) return colors.red500
    if (qualityLower.includes('1080p') || qualityLower.includes('hd')) return colors.blue500
    if (qualityLower.includes('720p')) return colors.green500
    return colors.grey500
  }

  render() {
    const { movie } = this.props
    
    if (!movie) return null

    const title = extractCleanTitle(movie.title || movie.full_title || 'Unknown Title')
    const poster = movie.poster_hd || movie.poster || this.fallbackImage
    const description = movie.description || movie.synopsis || 'No description available'
    const hasMagnetLink = movie.has_magnet || (movie.download_links && movie.download_links.some(link => link.type === 'magnet'))
    
    // Calculate download count including episodes
    let downloadCount = movie.download_links ? movie.download_links.length : 0
    if (movie.is_tv_show && movie.episodes) {
      downloadCount = movie.episodes.reduce((total, ep) => 
        total + (ep.download_links ? ep.download_links.length : 0), downloadCount)
    }
    
    // Create badge style object once per render to avoid Material-UI prepareStyles warning
    const badgeStyle = movie.quality ? { backgroundColor: this.getQualityColor(movie.quality) } : null
    
    return (
      <Card className="movie-card" onClick={this.handleMovieClick}>
        <CardMedia className="movie-poster">
          <img 
            src={poster} 
            alt={title}
            onError={(e) => {
              e.target.src = this.fallbackImage
            }}
          />
          {movie.quality && (
            <Badge
              badgeContent={movie.quality}
              badgeStyle={badgeStyle}
              className="quality-badge"
            />
          )}
        </CardMedia>
        
        <CardTitle
          title={title}
          subtitle={
            <div className="movie-subtitle">
              {movie.year && <span className="movie-year">{movie.year}</span>}
              {movie.genre && <span className="movie-genre">{movie.genre.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()}</span>}
              {movie.is_tv_show && movie.total_episodes && <span className="movie-episodes">{movie.total_episodes} Episodes</span>}
              {movie.director && <span className="movie-director">Dir: {movie.director}</span>}
            </div>
          }
          className="movie-title"
        />
        
        <CardText className="movie-description">
          {decodeHtmlEntities(description.length > 150 ? `${description.substring(0, 150)}...` : description)}
        </CardText>
        
        <div className="movie-metadata">
          {movie.duration && (
            <span className="metadata-item">⏱️ {movie.duration}</span>
          )}
          {movie.file_size && (
            <span className="metadata-item">📦 {movie.file_size}</span>
          )}
          {movie.resolution && (
            <span className="metadata-item">📺 {movie.resolution}</span>
          )}
          {movie.language && (
            <span className="metadata-item">🗣️ {movie.language}</span>
          )}
        </div>
        
        <CardActions className="movie-actions">
          <FlatButton 
            label="Details"
            primary={true}
            icon={<InfoIcon />}
            onClick={this.handleMovieClick}
          />
          
          {hasMagnetLink ? (
            <RaisedButton
              label="Add to Torrent List"
              primary={true}
              icon={<DownloadIcon />}
              onClick={this.handleAddToTorrentList}
              className="download-button"
            />
          ) : (
            <FlatButton
              label="No Magnet Link"
              disabled={true}
              className="no-download-button"
            />
          )}
          
          {downloadCount > 0 && (
            <span className="download-count">
              {movie.is_tv_show && movie.episodes && movie.episodes.length > 0
                ? `${movie.episodes.length} episodes, ${downloadCount} downloads`
                : `${downloadCount} download${downloadCount > 1 ? 's' : ''}`}
            </span>
          )}
        </CardActions>
      </Card>
    )
  }
}

// Memoize MovieCard to prevent unnecessary re-renders
module.exports = memo(MovieCard, (prevProps, nextProps) => {
  // Deep comparison for movie object and callback references
  return (
    prevProps.movie === nextProps.movie && // Reference equality
    prevProps.onMovieClick === nextProps.onMovieClick &&
    prevProps.onAddToTorrentList === nextProps.onAddToTorrentList
  )
}) 