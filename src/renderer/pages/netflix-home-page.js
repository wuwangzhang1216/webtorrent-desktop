const React = require('react')
const Header = require('../components/header')
const MovieDetailsModal = require('../components/movie-details-modal')

// SVG Icons - Enhanced with better styling
const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
  </svg>
)

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
  </svg>
)

const TimeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6l5.25 3.15-.9 1.49L11 15.4V7z"/>
  </svg>
)

const GenreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

const LinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
  </svg>
)

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
  </svg>
)

class NetflixHomePage extends React.Component {
  constructor(props) {
    super(props)
    
    this.state = {
      featuredMovie: null,
      movieRows: [],
      loading: true,
      error: null,
      selectedMovie: null,
      isModalOpen: false
    }

    this.handleMovieClick = this.handleMovieClick.bind(this)
    this.handleCloseModal = this.handleCloseModal.bind(this)
  }

  componentDidMount() {
    this.loadAllMovies()
  }

  async loadAllMovies() {
    try {
      // Load all home page data in a single API call
      const response = await fetch('http://localhost:8080/api/home')
      const data = await response.json()
      
      if (data.status === 'success' && data.data) {
        const { featured_movie, movie_rows, statistics } = data.data
        
        console.log(`Loaded ${statistics.total_movies} movies from ${statistics.categories_loaded} categories in ${data.data.processing_time}`)
        
        this.setState({
          featuredMovie: featured_movie,
          movieRows: movie_rows,
          loading: false,
          error: null
        })
      } else {
        throw new Error(data.message || 'Failed to load home page data')
      }
    } catch (error) {
      console.error('Error loading home page data:', error)
      this.setState({
        loading: false,
        error: 'Failed to load movies. Please ensure the API server is running.'
      })
    }
  }

  handleAddToTorrentList(movie) {
    const magnetLink = movie.download_links?.find(link => link.type === 'magnet')
    if (magnetLink) {
      const { dispatch } = require('../lib/dispatcher')
      dispatch('addTorrent', magnetLink.link)
      
      // Show notification
      this.showNotification(`"${movie.title}" added to downloads!`)
    } else {
      this.showNotification('No magnet link available for this movie.', 'error')
    }
  }

  handleMovieClick(movie) {
    this.setState({
      selectedMovie: movie,
      isModalOpen: true
    })
  }

  handleCloseModal() {
    this.setState({
      selectedMovie: null,
      isModalOpen: false
    })
  }

  showNotification(message, type = 'success') {
    // Enhanced notification system
    const notification = document.createElement('div')
    notification.className = `notification ${type}`
    notification.style.cssText = `
      position: fixed;
      top: 90px;
      right: 30px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #4CAF50, #45a049)' : 'linear-gradient(135deg, #f44336, #da190b)'};
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
    notification.textContent = message
    
    document.body.appendChild(notification)
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)'
    }, 100)
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 3000)
  }

  renderHeroSection() {
    const { featuredMovie } = this.state
    if (!featuredMovie) return null

    const magnetLink = featuredMovie.download_links?.find(link => link.type === 'magnet')

    return (
      <div className="netflix-hero">
        {featuredMovie.poster_hd && (
          <div 
            className="netflix-hero-bg"
            style={{
              backgroundImage: `url(${featuredMovie.poster_hd})`,
            }}
          />
        )}
        
        <div className="netflix-hero-content">
          <h1 className="netflix-hero-title">
            {featuredMovie.title || featuredMovie.full_title}
          </h1>
          
          {featuredMovie.description && (
            <p className="netflix-hero-description">
              {featuredMovie.description.length > 200 
                ? featuredMovie.description.substring(0, 200) + '...'
                : featuredMovie.description
              }
            </p>
          )}
          
          <div className="netflix-hero-metadata">
            {featuredMovie.year && (
              <span>
                <CalendarIcon />
                {featuredMovie.year}
              </span>
            )}
            {featuredMovie.genre && (
              <span>
                <GenreIcon />
                {featuredMovie.genre}
              </span>
            )}
            {featuredMovie.duration && (
              <span>
                <TimeIcon />
                {featuredMovie.duration}
              </span>
            )}
            {featuredMovie.download_links && (
              <span>
                <LinkIcon />
                {featuredMovie.download_links.length} links
              </span>
            )}
          </div>
          
          <div className="netflix-hero-actions">
            <button
              className="netflix-hero-btn primary"
              onClick={() => this.handleAddToTorrentList(featuredMovie)}
              disabled={!magnetLink}
            >
              <PlayIcon />
              {magnetLink ? 'Download Now' : 'No Download Available'}
            </button>
            
            <button className="netflix-hero-btn secondary">
              <InfoIcon />
              More Info
            </button>
          </div>
        </div>
      </div>
    )
  }

  renderMovieRows() {
    const { movieRows } = this.state
    
    return (
      <div className="netflix-movie-rows">
        {movieRows.map((row, index) => (
          <div key={index} className="netflix-movie-row">
            <h2 className="netflix-movie-row-title">{row.title}</h2>
            <div className="netflix-movie-row-container">
              <div className="netflix-movie-row-grid">
                {row.movies.map((movie, movieIndex) => (
                  <div key={movieIndex} className="netflix-movie-card" onClick={() => this.handleMovieClick(movie)}>
                    {movie.poster && (
                      <img 
                        src={movie.poster} 
                        alt={movie.title}
                        className="netflix-movie-poster"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    )}
                    
                    <div className="netflix-movie-info">
                      <h3 className="netflix-movie-title">
                        {movie.title || movie.full_title}
                      </h3>
                      
                      <div className="netflix-movie-metadata">
                        {movie.year && (
                          <span>
                            <CalendarIcon />
                            {movie.year}
                          </span>
                        )}
                        {movie.genre && (
                          <span>
                            <GenreIcon />
                            {movie.genre.split(' ')[0]}
                          </span>
                        )}
                        {movie.duration && (
                          <span>
                            <TimeIcon />
                            {movie.duration}
                          </span>
                        )}
                      </div>
                      
                      <button
                        className="netflix-movie-download-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          this.handleAddToTorrentList(movie)
                        }}
                        disabled={!movie.download_links?.some(link => link.type === 'magnet')}
                      >
                        {movie.download_links?.some(link => link.type === 'magnet') ? (
                          <>
                            <DownloadIcon />
                            Add to Downloads
                          </>
                        ) : (
                          <>
                            <InfoIcon />
                            No Download
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  render() {
    const { loading, error } = this.state

    if (loading) {
      return (
        <div className="netflix-home-page">
          <Header state={this.props.state} />
          <div className="netflix-loading">
            <div className="netflix-loading-spinner">
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(229, 9, 20, 0.3)',
                borderTop: '4px solid #e50914',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
            <p className="netflix-loading-text">Loading amazing movies...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="netflix-home-page">
          <Header state={this.props.state} />
          <div className="netflix-error">
            <h1>Connection Error</h1>
            <p>{error}</p>
            <button
              className="netflix-error-btn"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="netflix-home-page">
        <Header state={this.props.state} />
        {this.renderHeroSection()}
        {this.renderMovieRows()}
        
        <MovieDetailsModal
          movie={this.state.selectedMovie}
          isOpen={this.state.isModalOpen}
          onClose={this.handleCloseModal}
          onAddToTorrentList={this.handleAddToTorrentList.bind(this)}
        />
      </div>
    )
  }
}

module.exports = NetflixHomePage 