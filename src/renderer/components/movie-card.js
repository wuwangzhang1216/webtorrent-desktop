const React = require('react')
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
    
    // Find the first magnet link
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

    const title = movie.title || movie.full_title || 'Unknown Title'
    const poster = movie.poster_hd || movie.poster || this.fallbackImage
    const description = movie.description || movie.synopsis || 'No description available'
    const hasMagnetLink = movie.download_links && movie.download_links.some(link => link.type === 'magnet')
    const downloadCount = movie.download_links ? movie.download_links.length : 0
    
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
              {movie.genre && <span className="movie-genre">{movie.genre}</span>}
              {movie.director && <span className="movie-director">Dir: {movie.director}</span>}
            </div>
          }
          className="movie-title"
        />
        
        <CardText className="movie-description">
          {description.length > 150 ? `${description.substring(0, 150)}...` : description}
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
              {downloadCount} download{downloadCount > 1 ? 's' : ''}
            </span>
          )}
        </CardActions>
      </Card>
    )
  }
}

module.exports = MovieCard 