const React = require('react')
const { memo } = React
const { extractCleanTitle } = require('../lib/string-utils')
const { dispatch } = require('../lib/dispatcher')

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
    
    if (!movie || !isOpen) return null

    const magnetLinks = this.getMagnetLinks(movie)
    const title = extractCleanTitle(movie.title || movie.full_title || 'Unknown Title')
    const poster = movie.poster_hd || movie.poster
    const description = movie.description || movie.synopsis || 'No description available'
    const rating = movie.rating || movie.imdb_rating

    return (
      <div className={`movie-modal-overlay ${isOpen ? 'active' : ''}`} onClick={this.handleClose}>
        <div className="movie-modal-container" onClick={(e) => e.stopPropagation()}>
          <button className="movie-modal-close" onClick={this.handleClose}>
            <span className="icon">close</span>
          </button>
          
          <div className="movie-modal-content">
            {/* Hero Section with Backdrop */}
            <div className="movie-modal-hero">
              {poster && (
                <div className="movie-modal-backdrop">
                  <img src={poster} alt={title} />
                  <div className="backdrop-gradient" />
                </div>
              )}
              
              <div className="movie-modal-hero-content">
                <div className="movie-modal-poster-wrapper">
                  {poster && (
                    <img 
                      src={poster} 
                      alt={title}
                      className="movie-modal-poster"
                    />
                  )}
                </div>
                
                <div className="movie-modal-info">
                  <h1 className="movie-modal-title">{title}</h1>
                  {movie.translated_name && (
                    <h2 className="movie-modal-subtitle">{movie.translated_name}</h2>
                  )}
                  
                  <div className="movie-modal-meta">
                    {movie.year && <span className="meta-item">{movie.year}</span>}
                    {movie.duration && <span className="meta-item">{movie.duration}</span>}
                    {movie.quality && (
                      <span className={`meta-item quality-badge quality-${movie.quality.toLowerCase().replace(/[^a-z0-9]/g, '')}`}>
                        {movie.quality}
                      </span>
                    )}
                    {rating && (
                      <span className="meta-item rating">
                        <span className="icon">star</span> {rating}
                      </span>
                    )}
                  </div>
                  
                  <div className="movie-modal-details">
                    {movie.genre && (
                      <div className="detail-item">
                        <span className="detail-label">Genre:</span>
                        <span className="detail-value">{movie.genre.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()}</span>
                      </div>
                    )}
                    {movie.director && (
                      <div className="detail-item">
                        <span className="detail-label">Director:</span>
                        <span className="detail-value">{movie.director}</span>
                      </div>
                    )}
                    {movie.country && (
                      <div className="detail-item">
                        <span className="detail-label">Country:</span>
                        <span className="detail-value">{movie.country}</span>
                      </div>
                    )}
                    {movie.language && (
                      <div className="detail-item">
                        <span className="detail-label">Language:</span>
                        <span className="detail-value">{movie.language}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Description Section */}
            <div className="movie-modal-section">
              <h3 className="section-title">Synopsis</h3>
              <p className="movie-modal-description">{description}</p>
            </div>
            
            {/* Cast Section */}
            {movie.cast_list && movie.cast_list.length > 0 && (
              <div className="movie-modal-section">
                <h3 className="section-title">Cast</h3>
                <div className="movie-modal-cast">
                  {movie.cast_list.slice(0, 12).map((actor, index) => (
                    <div key={index} className="cast-member">
                      <div className="cast-avatar">{actor.charAt(0).toUpperCase()}</div>
                      <span className="cast-name">{actor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Download Section */}
            {magnetLinks.length > 0 && (
              <div className="movie-modal-section download-section">
                <h3 className="section-title">Download Options</h3>
                <div className="movie-modal-downloads">
                  {magnetLinks.map((group, groupIndex) => (
                    <div key={groupIndex} className="download-group">
                      <div className="download-quality-label">{group.quality}</div>
                      <div className="download-options">
                        {group.links.map((link, linkIndex) => (
                          <button
                            key={linkIndex}
                            className="download-option"
                            onClick={() => {
                              // 直接使用 dispatch，不依赖传递的函数
                              dispatch('addTorrent', link.link)
                              
                              // Show notification
                              const notification = document.createElement('div')
                              notification.className = 'notification success'
                              notification.style.cssText = `
                                position: fixed;
                                top: 90px;
                                right: 30px;
                                background: linear-gradient(135deg, #4CAF50, #45a049);
                                color: white;
                                padding: 15px 25px;
                                border-radius: 10px;
                                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                                z-index: 1000;
                                font-weight: 500;
                                max-width: 300px;
                                transform: translateX(100%);
                                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                              `
                              notification.textContent = `"${movie.title || movie.full_title || 'Movie'}" added to downloads!`
                              
                              document.body.appendChild(notification)
                              
                              setTimeout(() => {
                                notification.style.transform = 'translateX(0)'
                              }, 100)
                              
                              setTimeout(() => {
                                notification.style.transform = 'translateX(100%)'
                                setTimeout(() => {
                                  if (notification.parentNode) {
                                    notification.parentNode.removeChild(notification)
                                  }
                                }, 300)
                              }, 3000)
                            }}
                          >
                            <span className="icon" style={{ pointerEvents: 'none' }}>get_app</span>
                            <span className="download-info" style={{ pointerEvents: 'none' }}>
                              <span className="download-label" style={{ pointerEvents: 'none' }}>
                                {group.links.length > 1 ? `Option ${linkIndex + 1}` : 'Download'}
                              </span>
                              {link.size && <span className="download-size" style={{ pointerEvents: 'none' }}>{link.size}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Additional Info */}
            <div className="movie-modal-section">
              <h3 className="section-title">Technical Details</h3>
              <div className="movie-modal-tech-details">
                {movie.file_size && (
                  <div className="tech-item">
                    <span className="icon">storage</span>
                    <span className="tech-label">File Size</span>
                    <span className="tech-value">{movie.file_size}</span>
                  </div>
                )}
                {movie.resolution && (
                  <div className="tech-item">
                    <span className="icon">tv</span>
                    <span className="tech-label">Resolution</span>
                    <span className="tech-value">{movie.resolution}</span>
                  </div>
                )}
                {movie.codec && (
                  <div className="tech-item">
                    <span className="icon">videocam</span>
                    <span className="tech-label">Codec</span>
                    <span className="tech-value">{movie.codec}</span>
                  </div>
                )}
                {movie.audio && (
                  <div className="tech-item">
                    <span className="icon">audiotrack</span>
                    <span className="tech-label">Audio</span>
                    <span className="tech-value">{movie.audio}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

module.exports = MovieDetailsModal 