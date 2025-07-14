const React = require('react')
const Dialog = require('material-ui/Dialog').default
const FlatButton = require('material-ui/FlatButton').default
const RaisedButton = require('material-ui/RaisedButton').default
const Chip = require('material-ui/Chip').default
const CloseIcon = require('material-ui/svg-icons/navigation/close').default
const DownloadIcon = require('material-ui/svg-icons/file/file-download').default

class MovieDetailsModal extends React.Component {
  constructor(props) {
    super(props)
    this.handleClose = this.handleClose.bind(this)
  }

  handleClose() {
    if (this.props.onClose) {
      this.props.onClose()
    }
  }

  // Helper function to get unique magnet links grouped by resolution
  getMagnetLinks(movie) {
    if (!movie.download_links || movie.download_links.length === 0) {
      return []
    }

    // Filter only magnet links
    const magnetLinks = movie.download_links.filter(link => link.type === 'magnet')
    
    // Group by resolution/quality
    const groupedLinks = {}
    magnetLinks.forEach(link => {
      const key = link.quality || link.resolution || 'Standard'
      if (!groupedLinks[key]) {
        groupedLinks[key] = []
      }
      groupedLinks[key].push(link)
    })

    // Convert to array and sort by quality (prioritize higher quality)
    const sortedLinks = Object.keys(groupedLinks).map(key => ({
      quality: key,
      links: groupedLinks[key]
    })).sort((a, b) => {
      // Custom sort to prioritize higher quality
      const qualityOrder = {
        '4K': 4,
        '2160p': 4,
        '1080p': 3,
        'HD': 2.5,
        '720p': 2,
        '480p': 1,
        'SD': 0.5,
        'Standard': 1
      }
      
      const aOrder = qualityOrder[a.quality] || 1
      const bOrder = qualityOrder[b.quality] || 1
      
      return bOrder - aOrder
    })

    return sortedLinks
  }

  render() {
    const { movie, isOpen, onAddToTorrentList } = this.props
    
    if (!movie) return null

    const dialogActions = [
      <FlatButton
        label="Close"
        primary={true}
        onClick={this.handleClose}
        icon={<CloseIcon />}
      />
    ]

    const magnetLinks = this.getMagnetLinks(movie)

    return (
      <Dialog
        title={movie.title || movie.full_title}
        actions={dialogActions}
        modal={true}
        open={isOpen}
        onRequestClose={this.handleClose}
        autoScrollBodyContent={true}
        className="movie-detail-dialog"
        contentClassName="movie-detail-dialog-content"
        overlayClassName="movie-detail-overlay"
        bodyClassName="movie-detail-body"
        repositionOnUpdate={false}
      >
        <div className="movie-detail-content">
          <div className="movie-detail-header">
            {(movie.poster_hd || movie.poster) && (
              <img 
                src={movie.poster_hd || movie.poster} 
                alt={movie.title}
                className="movie-detail-poster"
              />
            )}
            <div className="movie-detail-info">
              <h3>{movie.title || movie.full_title}</h3>
              {movie.translated_name && (
                <p><strong>Translated:</strong> {movie.translated_name}</p>
              )}
              {movie.year && (
                <p><strong>Year:</strong> {movie.year}</p>
              )}
              {movie.genre && (
                <p><strong>Genre:</strong> {movie.genre}</p>
              )}
              {movie.director && (
                <p><strong>Director:</strong> {movie.director}</p>
              )}
              {movie.country && (
                <p><strong>Country:</strong> {movie.country}</p>
              )}
              {movie.language && (
                <p><strong>Language:</strong> {movie.language}</p>
              )}
              {movie.duration && (
                <p><strong>Duration:</strong> {movie.duration}</p>
              )}
              {movie.file_size && (
                <p><strong>File Size:</strong> {movie.file_size}</p>
              )}
              {movie.resolution && (
                <p><strong>Resolution:</strong> {movie.resolution}</p>
              )}
              {movie.quality && (
                <p><strong>Quality:</strong> {movie.quality}</p>
              )}
            </div>
          </div>

          {movie.cast_list && movie.cast_list.length > 0 && (
            <div className="movie-cast">
              <h4>Cast</h4>
              <div className="cast-chips">
                {movie.cast_list.slice(0, 10).map((actor, index) => (
                  <Chip key={index} className="cast-chip">
                    {actor}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {(movie.synopsis || movie.description) && (
            <div className="movie-synopsis">
              <h4>Synopsis</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{movie.synopsis || movie.description}</p>
            </div>
          )}

          {magnetLinks.length > 0 && (
            <div className="download-section">
              <h4>Download</h4>
              <div className="download-buttons">
                {magnetLinks.map((group, groupIndex) => (
                  <div key={groupIndex} className="download-quality-group">
                    <div className="quality-label">{group.quality}</div>
                    <div className="quality-buttons">
                      {group.links.map((link, linkIndex) => (
                        <RaisedButton
                          key={linkIndex}
                          label={group.links.length > 1 ? `${group.quality} (${linkIndex + 1})` : group.quality}
                          primary={true}
                          icon={<DownloadIcon />}
                          onClick={() => onAddToTorrentList && onAddToTorrentList(movie, link.link)}
                          className="download-button"
                          style={{ marginRight: '8px', marginBottom: '8px' }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {magnetLinks.length === 0 && (
            <div className="no-download-section">
              <p style={{ color: '#B0B0B0', fontStyle: 'italic' }}>No download links available</p>
            </div>
          )}
        </div>
      </Dialog>
    )
  }
}

module.exports = MovieDetailsModal 