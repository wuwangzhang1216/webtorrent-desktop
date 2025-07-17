const React = require('react')
const { extractCleanTitle, decodeHtmlEntities } = require('../lib/string-utils')
const { adaptMovieData } = require('../lib/movie-data-adapter')

// SVG Icons
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
)

const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>
)

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

const TimeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
  </svg>
)

class AppleMovieModal extends React.Component {
  constructor(props) {
    super(props)
    this.modalRef = React.createRef()
    this.state = {
      selectedEpisodeGroup: 0,
      showAllEpisodes: false,
      episodesPerGroup: 10,
      loading: false,
      detailedMovie: null,
      error: null
    }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleEscKey)
    if (this.props.movie && this.props.isOpen) {
      this.fetchMovieDetails()
    }
  }

  componentDidUpdate(prevProps) {
    // Fetch details when modal opens with a new movie
    if (this.props.isOpen && this.props.movie && 
        (!prevProps.isOpen || prevProps.movie?.id !== this.props.movie?.id)) {
      this.fetchMovieDetails()
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleEscKey)
  }

  fetchMovieDetails = async () => {
    const { movie } = this.props
    if (!movie || !movie.id) return

    // Skip if we already have detailed data for this movie
    if (this.state.detailedMovie?.id === movie.id) return

    this.setState({ loading: true, error: null })

    try {
      // The new API requires the full URL as a parameter
      const url = movie.page_url || movie.link
      if (!url) {
        console.warn('No URL available for movie details')
        this.setState({ loading: false })
        return
      }

      const response = await fetch(`http://localhost:8080/api/movie/${movie.id}?url=${encodeURIComponent(url)}`)
      const data = await response.json()

      if (data.status === 'success' && data.data) {
        const adaptedMovie = adaptMovieData(data.data)
        this.setState({ 
          detailedMovie: adaptedMovie,
          loading: false 
        })
      } else {
        throw new Error(data.message || 'Failed to fetch movie details')
      }
    } catch (error) {
      console.error('Error fetching movie details:', error)
      this.setState({ 
        loading: false,
        error: 'Failed to load movie details'
      })
    }
  }

  // Helper function to clean JSON-formatted strings
  cleanJsonString = (str) => {
    if (!str) return ''
    // Remove square brackets and quotes, replace tabs with spaces
    return str.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()
  }

  handleEscKey = (e) => {
    if (e.key === 'Escape' && this.props.isOpen) {
      this.props.onClose()
    }
  }

  handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      this.props.onClose()
    }
  }

  handleAddToTorrentList = () => {
    const { movie, onAddToTorrentList, onClose } = this.props
    const { detailedMovie } = this.state
    
    // Use detailed movie data if available
    const movieToAdd = detailedMovie || movie
    
    if (onAddToTorrentList) {
      // If there's only one magnet link, pass it directly
      const magnetLinks = movieToAdd.download_links ? 
        movieToAdd.download_links.filter(link => link.type === 'magnet') : []
      
      if (magnetLinks.length === 1) {
        onAddToTorrentList(movieToAdd, magnetLinks[0].link)
      } else {
        onAddToTorrentList(movieToAdd)
      }
      onClose()
    }
  }

  getQualityLabel(quality) {
    if (!quality) return null
    
    const qualityLower = quality.toLowerCase()
    if (qualityLower.includes('4k') || qualityLower.includes('2160p')) return '4K'
    if (qualityLower.includes('1080p')) return '1080p HD'
    if (qualityLower.includes('720p')) return '720p HD'
    return quality
  }

  // Group episodes by ranges (1-10, 11-20, etc.)
  groupEpisodes(movie) {
    const { episodesPerGroup } = this.state
    
    // Check if this is a TV show with episodes array
    if (movie.episodes && movie.episodes.length > 0) {
      // Use structured episode data from API
      const groups = []
      const episodes = [...movie.episodes].sort((a, b) => a.episode_number - b.episode_number)
      
      for (let i = 0; i < episodes.length; i += episodesPerGroup) {
        const group = episodes.slice(i, i + episodesPerGroup)
        const start = group[0].episode_number
        const end = group[group.length - 1].episode_number
        groups.push({
          title: `Episodes ${start}-${end}`,
          episodes: group
        })
      }
      
      return { groups, hasEpisodes: true }
    }
    
    // Fallback to parsing from download_links for old data
    const magnetLinks = movie.download_links ? 
      movie.download_links.filter(link => link.type === 'magnet') : []
    
    const episodeLinks = []
    const otherLinks = []
    
    magnetLinks.forEach(link => {
      if (link.episode_number) {
        // New API provides episode_number directly
        episodeLinks.push({ ...link, episode: link.episode_number })
      } else {
        // Try to parse from quality string
        const episodeMatch = link.quality?.match(/第(\d+)集|EP(\d+)|E(\d+)/i)
        if (episodeMatch) {
          const episodeNum = parseInt(episodeMatch[1] || episodeMatch[2] || episodeMatch[3])
          episodeLinks.push({ ...link, episode: episodeNum })
        } else {
          otherLinks.push(link)
        }
      }
    })
    
    // Sort episode links by episode number
    episodeLinks.sort((a, b) => a.episode - b.episode)
    
    // Group episodes
    const groups = []
    for (let i = 0; i < episodeLinks.length; i += episodesPerGroup) {
      const group = episodeLinks.slice(i, i + episodesPerGroup)
      const start = group[0].episode
      const end = group[group.length - 1].episode
      groups.push({
        title: `Episodes ${start}-${end}`,
        links: group
      })
    }
    
    return { groups, otherLinks, hasEpisodes: false }
  }

  renderEpisodeGroups(movie) {
    const { selectedEpisodeGroup, showAllEpisodes } = this.state
    const { groups, otherLinks, hasEpisodes } = this.groupEpisodes(movie)
    
    // Handle TV shows with structured episode data
    if (hasEpisodes) {
      const allEpisodes = movie.episodes
      
      // If less than 15 episodes, show all without grouping
      if (allEpisodes.length <= 15 || showAllEpisodes) {
        return (
          <div className="apple-modal-episodes-grid">
            {allEpisodes.map((episode) => {
              const magnetLink = episode.download_links?.find(link => link.type === 'magnet')
              if (!magnetLink) return null
              
              return (
                <button 
                  key={episode.episode_number}
                  className="apple-modal-episode-btn"
                  onClick={() => this.props.onAddToTorrentList(this.props.movie, magnetLink.link)}
                  title={episode.episode_title || `Episode ${episode.episode_number}`}
                >
                  <DownloadIcon />
                  <span>EP {episode.episode_number}</span>
                  {episode.episode_title && (
                    <span className="episode-title">{episode.episode_title}</span>
                  )}
                </button>
              )
            })}
          </div>
        )
      }
      
      // Show grouped interface for many episodes
      return (
        <div className="apple-modal-episodes-container">
          <div className="apple-modal-episode-tabs">
            {groups.map((group, index) => (
              <button
                key={index}
                className={`episode-tab ${selectedEpisodeGroup === index ? 'active' : ''}`}
                onClick={() => this.setState({ selectedEpisodeGroup: index })}
              >
                {group.title}
              </button>
            ))}
          </div>
          
          <div className="apple-modal-episodes-grid">
            {groups[selectedEpisodeGroup].episodes.map((episode) => {
              const magnetLink = episode.download_links?.find(link => link.type === 'magnet')
              if (!magnetLink) return null
              
              return (
                <button 
                  key={episode.episode_number}
                  className="apple-modal-episode-btn"
                  onClick={() => this.props.onAddToTorrentList(this.props.movie, magnetLink.link)}
                  title={episode.episode_title || `Episode ${episode.episode_number}`}
                >
                  <DownloadIcon />
                  <span>EP {episode.episode_number}</span>
                </button>
              )
            })}
          </div>
          
          <button 
            className="apple-modal-show-all-btn"
            onClick={() => this.setState({ showAllEpisodes: true })}
          >
            Show All Episodes ({allEpisodes.length} total)
          </button>
        </div>
      )
    }
    
    // Fallback to old behavior for non-episode data
    const magnetLinks = movie.download_links ? 
      movie.download_links.filter(link => link.type === 'magnet') : []
    
    // If less than 15 links total, show all without grouping
    if (magnetLinks.length <= 15 || showAllEpisodes) {
      return (
        <div className="apple-modal-episodes-grid">
          {magnetLinks.map((link, index) => (
            <button 
              key={index}
              className="apple-modal-episode-btn"
              onClick={() => {
                const { dispatch } = require('../lib/dispatcher')
                dispatch('addTorrent', link.link)
              }}
              title={link.quality}
            >
              <DownloadIcon />
              <span>{link.quality || 'Download'}</span>
            </button>
          ))}
        </div>
      )
    }
    
    // Show grouped interface for many episodes
    return (
      <div className="apple-modal-episodes-container">
        {/* Episode group tabs */}
        <div className="apple-modal-episode-tabs">
          {groups.map((group, index) => (
            <button
              key={index}
              className={`episode-tab ${selectedEpisodeGroup === index ? 'active' : ''}`}
              onClick={() => this.setState({ selectedEpisodeGroup: index })}
            >
              {group.title}
            </button>
          ))}
          {otherLinks.length > 0 && (
            <button
              className={`episode-tab ${selectedEpisodeGroup === groups.length ? 'active' : ''}`}
              onClick={() => this.setState({ selectedEpisodeGroup: groups.length })}
            >
              Other
            </button>
          )}
        </div>
        
        {/* Episode grid for selected group */}
        <div className="apple-modal-episodes-grid">
          {selectedEpisodeGroup < groups.length ? (
            groups[selectedEpisodeGroup].links.map((link, index) => (
              <button 
                key={index}
                className="apple-modal-episode-btn"
                onClick={() => {
                const { dispatch } = require('../lib/dispatcher')
                dispatch('addTorrent', link.link)
              }}
                title={link.quality}
              >
                <DownloadIcon />
                <span>Episode {link.episode}</span>
              </button>
            ))
          ) : (
            otherLinks.map((link, index) => (
              <button 
                key={index}
                className="apple-modal-episode-btn"
                onClick={() => {
                const { dispatch } = require('../lib/dispatcher')
                dispatch('addTorrent', link.link)
              }}
                title={link.quality}
              >
                <DownloadIcon />
                <span>{link.quality || 'Download'}</span>
              </button>
            ))
          )}
        </div>
        
        {/* Toggle to show all episodes */}
        <button 
          className="apple-modal-show-all-btn"
          onClick={() => this.setState({ showAllEpisodes: true })}
        >
          Show All Episodes ({magnetLinks.length} total)
        </button>
      </div>
    )
  }

  render() {
    const { movie, isOpen, onClose } = this.props
    const { loading, detailedMovie, error } = this.state

    if (!isOpen || !movie) return null

    // Use detailed movie data if available, otherwise fall back to basic data
    const displayMovie = detailedMovie || movie
    const title = extractCleanTitle(displayMovie.title || displayMovie.full_title || 'Unknown Title')
    const poster = displayMovie.poster
    const description = displayMovie.description || displayMovie.synopsis || 'No description available'
    const hasMagnetLink = displayMovie.download_links && displayMovie.download_links.some(link => link.type === 'magnet')
    const qualityLabel = this.getQualityLabel(displayMovie.quality)

    return (
      <div className="apple-modal-backdrop" onClick={this.handleBackdropClick}>
        <div className="apple-modal" ref={this.modalRef}>
          <button className="apple-modal-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>

          <div className="apple-modal-content">
            {loading && (
              <div className="apple-modal-loading">
                <div className="loading-spinner"></div>
                <p>Loading movie details...</p>
              </div>
            )}
            
            <div className="apple-modal-hero">
              {poster && (
                <img 
                  src={poster} 
                  alt={title}
                  className="apple-modal-poster"
                />
              )}
              <div className="apple-modal-hero-overlay" />
              <div className="apple-modal-hero-content">
                <h1 className="apple-modal-title">{title}</h1>
                
                <div className="apple-modal-metadata">
                  {displayMovie.year && (
                    <span className="metadata-item">
                      <CalendarIcon />
                      {displayMovie.year}
                    </span>
                  )}
                  {displayMovie.duration && (
                    <span className="metadata-item">
                      <TimeIcon />
                      {displayMovie.duration}
                    </span>
                  )}
                  {qualityLabel && (
                    <span className="metadata-item quality">
                      {qualityLabel}
                    </span>
                  )}
                  {displayMovie.imdb_rating && (
                    <span className="metadata-item rating">
                      <StarIcon />
                      {displayMovie.imdb_rating}
                    </span>
                  )}
                </div>

                <div className="apple-modal-actions">
                  {(() => {
                    const magnetLinks = displayMovie.download_links ? 
                      displayMovie.download_links.filter(link => link.type === 'magnet') : []
                    
                    if (magnetLinks.length === 0) return null
                    
                    if (magnetLinks.length === 1) {
                      return (
                        <button 
                          className="apple-modal-button primary"
                          onClick={this.handleAddToTorrentList}
                        >
                          <DownloadIcon />
                          <span>Add to Downloads</span>
                        </button>
                      )
                    }
                    
                    // For 2-4 links, show inline buttons
                    if (magnetLinks.length <= 4) {
                      return (
                        <div className="apple-modal-download-options">
                          {magnetLinks.map((link, index) => (
                            <button 
                              key={index}
                              className="apple-modal-button resolution-option"
                              onClick={() => this.props.onAddToTorrentList(displayMovie, link.link)}
                            >
                              <DownloadIcon />
                              <span>
                                {link.quality || link.resolution || 'Download'}
                                {link.size && ` • ${link.size}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      )
                    }
                    
                    // For many links, don't show them here - they'll be in the modal body
                    return null
                  })()}
                </div>
              </div>
            </div>

            <div className="apple-modal-body">
              <div className="apple-modal-section">
                <p className="apple-modal-description">{decodeHtmlEntities(description)}</p>
              </div>

              {displayMovie.genre && (
                <div className="apple-modal-section">
                  <h3>Genre</h3>
                  <div className="apple-modal-tags">
                    {this.cleanJsonString(displayMovie.genre).split(',').map((g, i) => (
                      <span key={i} className="apple-tag">{g.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {displayMovie.director && (
                <div className="apple-modal-section">
                  <h3>Director</h3>
                  <p>{displayMovie.director}</p>
                </div>
              )}

              {displayMovie.cast && (
                <div className="apple-modal-section">
                  <h3>Cast</h3>
                  <p>{this.cleanJsonString(displayMovie.cast)}</p>
                </div>
              )}

              {/* Episodes section for TV series with many episodes */}
              {(() => {
                // Check if this is a TV show with episodes
                if (displayMovie.is_tv_show && displayMovie.episodes && displayMovie.episodes.length > 0) {
                  return (
                    <div className="apple-modal-section">
                      <h3>Episodes ({displayMovie.total_episodes || displayMovie.episodes.length})</h3>
                      {this.renderEpisodeGroups(displayMovie)}
                    </div>
                  )
                }
                
                // Check for many download links (old behavior)
                const magnetLinks = displayMovie.download_links ? 
                  displayMovie.download_links.filter(link => link.type === 'magnet') : []
                
                if (magnetLinks.length > 4) {
                  return (
                    <div className="apple-modal-section">
                      <h3>Episodes & Downloads</h3>
                      {this.renderEpisodeGroups(displayMovie)}
                    </div>
                  )
                }
                return null
              })()}

              {displayMovie.file_info && (
                <div className="apple-modal-section">
                  <h3>File Information</h3>
                  <div className="apple-file-info">
                    {displayMovie.resolution && (
                      <div className="info-item">
                        <span className="info-label">Resolution</span>
                        <span className="info-value">{displayMovie.resolution}</span>
                      </div>
                    )}
                    {displayMovie.file_size && (
                      <div className="info-item">
                        <span className="info-label">File Size</span>
                        <span className="info-value">{displayMovie.file_size}</span>
                      </div>
                    )}
                    {displayMovie.language && (
                      <div className="info-item">
                        <span className="info-label">Language</span>
                        <span className="info-value">{displayMovie.language}</span>
                      </div>
                    )}
                    {displayMovie.subtitle && (
                      <div className="info-item">
                        <span className="info-label">Subtitles</span>
                        <span className="info-value">{displayMovie.subtitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

module.exports = AppleMovieModal