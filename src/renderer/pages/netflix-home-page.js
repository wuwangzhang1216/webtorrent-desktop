const React = require('react')
const AppleMovieCard = require('../components/apple-movie-card')
const AppleMovieModal = require('../components/apple-movie-modal')
const { extractCleanTitle, decodeHtmlEntities } = require('../lib/string-utils')
const { adaptMovieData, adaptMovieList } = require('../lib/movie-data-adapter')

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
      isModalOpen: false,
      heroMovies: [],
      currentHeroIndex: 0,
      nextHeroIndex: null,
      isTransitioning: false
    }

    this.handleMovieClick = this.handleMovieClick.bind(this)
    this.handleCloseModal = this.handleCloseModal.bind(this)
    this.handleMoreInfo = this.handleMoreInfo.bind(this)
    this.heroInterval = null
    this.transitionTimeout = null
    this._isMounted = false
  }

  componentDidMount() {
    console.log('NetflixHomePage mounted')
    this._isMounted = true
    this.loadAllMovies()
  }

  componentWillUnmount() {
    this._isMounted = false
    if (this.heroInterval) {
      clearInterval(this.heroInterval)
      this.heroInterval = null
    }
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout)
      this.transitionTimeout = null
    }
  }

  async loadAllMovies() {
    try {
      // Load all home page data in a single API call
      const response = await fetch('http://localhost:8080/api/home')
      const data = await response.json()
      
      if (data.status === 'success' && data.data) {
        const { featured_movie, sections, statistics } = data.data
        
        console.log(`Loaded movies from ${sections.length} sections`)
        
        // Adapt movie data to legacy format
        const adaptedFeaturedMovie = featured_movie ? adaptMovieData(featured_movie) : null
        const adaptedSections = sections.map(section => ({
          ...section,
          movies: adaptMovieList(section.movies || [])
        }))
        
        // Get up to 5 hero movies from the first section of movies
        let heroMovies = []
        console.log('Sections available:', adaptedSections.length)
        console.log('First section movies:', adaptedSections[0]?.movies?.length)
        
        if (adaptedSections.length > 0 && adaptedSections[0].movies.length > 0) {
          // First try to get movies with posters
          const moviesWithPosters = adaptedSections[0].movies.filter(m => m.poster)
          console.log('Movies with posters:', moviesWithPosters.length)
          
          heroMovies = moviesWithPosters.slice(0, 5)
          // If no movies have posters, just take first 5
          if (heroMovies.length === 0) {
            console.log('No movies with posters, using first 5 movies')
            heroMovies = adaptedSections[0].movies.slice(0, 5)
          }
        } else if (adaptedFeaturedMovie) {
          console.log('Using featured movie as hero')
          heroMovies = [adaptedFeaturedMovie]
        }
        
        console.log('Hero movies selected:', heroMovies.length)
        console.log('Hero movies:', heroMovies.map(m => ({ title: m.title, poster: m.poster })))
        // Log the first movie's poster URL to debug
        if (heroMovies.length > 0 && heroMovies[0].poster) {
          console.log('First hero poster URL:', heroMovies[0].poster)
        }
        
        if (!this._isMounted) return
        
        this.setState({
          featuredMovie: adaptedFeaturedMovie,
          movieRows: adaptedSections,
          loading: false,
          error: null,
          heroMovies: heroMovies,
          currentHeroIndex: 0
        })
        
        // Start auto-scrolling if we have multiple hero movies
        if (heroMovies.length > 1 && this._isMounted) {
          this.startHeroCarousel()
        }
      } else {
        throw new Error(data.message || 'Failed to load home page data')
      }
    } catch (error) {
      console.error('Error loading home page data:', error)
      if (!this._isMounted) return
      
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

  startHeroCarousel() {
    this.heroInterval = setInterval(() => {
      if (!this._isMounted) return
      
      this.setState(prevState => {
        const nextIndex = (prevState.currentHeroIndex + 1) % prevState.heroMovies.length
        return {
          nextHeroIndex: nextIndex,
          isTransitioning: true
        }
      })
      
      // Complete the transition after animation
      this.transitionTimeout = setTimeout(() => {
        if (!this._isMounted) return
        
        this.setState(prevState => ({
          currentHeroIndex: prevState.nextHeroIndex,
          nextHeroIndex: null,
          isTransitioning: false
        }))
      }, 800)
    }, 6000) // Change hero every 6 seconds for smoother experience
  }

  handleMoreInfo(movie) {
    this.handleMovieClick(movie)
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
    const { heroMovies, currentHeroIndex, nextHeroIndex, isTransitioning } = this.state
    console.log('renderHeroSection called, heroMovies:', heroMovies)
    if (!heroMovies || heroMovies.length === 0) {
      console.log('No hero movies available')
      return null
    }

    const currentMovie = heroMovies[currentHeroIndex] || heroMovies[0]
    const nextMovie = nextHeroIndex !== null ? heroMovies[nextHeroIndex] : null
    console.log('Current hero movie:', currentMovie)
    if (!currentMovie) return null

    const magnetLink = currentMovie.download_links?.find(link => link.type === 'magnet')

    const posterUrl = currentMovie.poster
    const nextPosterUrl = nextMovie?.poster
    console.log('Poster URL for hero:', posterUrl)
    
    return (
      <div className="netflix-hero">
        {/* Current background - stays visible */}
        <div 
          className="netflix-hero-bg current"
          style={posterUrl ? {
            backgroundImage: `url("${posterUrl}")`,
            backgroundColor: 'transparent'
          } : {
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
          }}
        />
        
        {/* Next background for transition - fades in on top */}
        {isTransitioning && nextMovie && (
          <div 
            className="netflix-hero-bg fade-in"
            style={nextPosterUrl ? {
              backgroundImage: `url("${nextPosterUrl}")`,
              backgroundColor: 'transparent'
            } : {
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
            }}
          />
        )}
        
        <div className={`netflix-hero-content ${isTransitioning ? 'transitioning' : ''}`}>
          <div className="netflix-hero-title-wrapper">
            <h1 className="netflix-hero-title">
              {extractCleanTitle(currentMovie.title || currentMovie.full_title)}
            </h1>
            <button 
              className="netflix-hero-info-btn"
              onClick={() => this.handleMoreInfo(currentMovie)}
              title="More Info"
              aria-label="More Info"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            </button>
          </div>
          
          {currentMovie.synopsis && (
            <p className="netflix-hero-description">
              {decodeHtmlEntities(
                currentMovie.synopsis.length > 150 
                  ? currentMovie.synopsis.substring(0, 150) + '...'
                  : currentMovie.synopsis
              )}
            </p>
          )}
          
          <div className="netflix-hero-metadata">
            {currentMovie.year && (
              <span>
                <CalendarIcon />
                {currentMovie.year}
              </span>
            )}
            {currentMovie.genre && (
              <span>
                <GenreIcon />
                {currentMovie.genre.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()}
              </span>
            )}
            {currentMovie.duration && (
              <span>
                <TimeIcon />
                {currentMovie.duration}
              </span>
            )}
          </div>
          
          {heroMovies.length > 1 && (
            <div className="netflix-hero-indicators">
              {heroMovies.map((_, index) => (
                <button
                  key={index}
                  className={`hero-indicator ${index === currentHeroIndex ? 'active' : ''}`}
                  onClick={() => {
                    if (!this._isMounted || this.state.isTransitioning || index === this.state.currentHeroIndex) {
                      return
                    }
                    
                    // Clear any existing timeout
                    if (this.transitionTimeout) {
                      clearTimeout(this.transitionTimeout)
                    }
                    
                    this.setState({
                      nextHeroIndex: index,
                      isTransitioning: true
                    })
                    
                    this.transitionTimeout = setTimeout(() => {
                      if (!this._isMounted) return
                      
                      this.setState({
                        currentHeroIndex: index,
                        nextHeroIndex: null,
                        isTransitioning: false
                      })
                    }, 800)
                    
                    // Reset the interval when user manually selects
                    if (this.heroInterval) {
                      clearInterval(this.heroInterval)
                      this.startHeroCarousel()
                    }
                  }}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  renderMovieRows() {
    const { movieRows } = this.state
    const { dispatch } = require('../lib/dispatcher')
    
    return (
      <div className="netflix-movie-rows">
        {movieRows.map((row, index) => (
          <div key={index} className="netflix-movie-row">
            <div className="netflix-movie-row-header">
              <h2 className="netflix-movie-row-title">{row.title}</h2>
              {row.category && row.type !== 'latest' && (
                <button 
                  className="netflix-view-all-btn"
                  onClick={() => dispatch('openCategoryPage', row.category)}
                >
                  View All →
                </button>
              )}
            </div>
            <div className="netflix-movie-row-container">
              <div className="netflix-movie-row-grid">
                {row.movies.map((movie, movieIndex) => (
                  <AppleMovieCard
                    key={movie.id || `${movie.title}-${movieIndex}`}
                    movie={movie}
                    onMovieClick={this.handleMovieClick}
                    onAddToTorrentList={this.handleAddToTorrentList.bind(this)}
                  />
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
          <div className="netflix-error">
            <h1>Connection Error</h1>
            <p>{error}</p>
            <button
              className="netflix-error-btn"
              onClick={() => {
                this.setState({ loading: true, error: null })
                this.loadAllMovies()
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="netflix-home-page">
        {this.renderHeroSection()}
        {this.renderMovieRows()}
        
        <AppleMovieModal
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