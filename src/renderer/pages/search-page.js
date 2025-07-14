const React = require('react')
const CircularProgress = require('material-ui/CircularProgress').default
const Snackbar = require('material-ui/Snackbar').default
const Paper = require('material-ui/Paper').default
const TextField = require('material-ui/TextField').default
const IconButton = require('material-ui/IconButton').default
const RaisedButton = require('material-ui/RaisedButton').default
const SearchIcon = require('material-ui/svg-icons/action/search').default
const ClearIcon = require('material-ui/svg-icons/content/clear').default

const Header = require('../components/header')
const MovieCard = require('../components/movie-card')
const MovieDetailsModal = require('../components/movie-details-modal')
const { dispatcher } = require('../lib/dispatcher')

// Enhanced SVG Icons
const EmptySearchIcon = () => (
  <svg width="80" height="80" viewBox="0 0 24 24" fill="rgba(229, 9, 20, 0.6)">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
)

const ErrorIcon = () => (
  <svg width="60" height="60" viewBox="0 0 24 24" fill="#e50914">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
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

class SearchPage extends React.Component {
  constructor(props) {
    super(props)
    console.log('SearchPage constructor called')
    
    this.state = {
      searchKeyword: '',
      movies: [],
      loading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      hasSearched: false,
      selectedMovie: null,
      isModalOpen: false
    }

    this.handleSearch = this.handleSearch.bind(this)
    this.handleKeywordChange = this.handleKeywordChange.bind(this)
    this.handleClearSearch = this.handleClearSearch.bind(this)
    this.handleAddToTorrentList = this.handleAddToTorrentList.bind(this)
    this.handleMovieClick = this.handleMovieClick.bind(this)
    this.handleCloseModal = this.handleCloseModal.bind(this)
  }

  componentDidMount() {
    console.log('SearchPage componentDidMount called')
    // Focus on search input when page loads
    setTimeout(() => {
      const searchInput = document.querySelector('input[type="text"]')
      if (searchInput) {
        searchInput.focus()
      }
    }, 300)
  }

  handleKeywordChange(event) {
    this.setState({ searchKeyword: event.target.value })
  }

  async handleSearch(event) {
    if (event) event.preventDefault()
    
    const keyword = this.state.searchKeyword.trim()
    if (!keyword) return

    this.setState({ 
      loading: true, 
      error: null,
      hasSearched: true
    })

    try {
      const response = await fetch(`http://localhost:8080/api/search?keyword=${encodeURIComponent(keyword)}&page=1`)
      const data = await response.json()
      
      if (data.status === 'success') {
        this.setState({
          loading: false,
          movies: data.data?.movies || [],
          currentPage: data.data?.pagination?.current_page || 1,
          totalPages: data.data?.pagination?.total_pages || 1,
          error: null
        })
      } else {
        this.setState({
          loading: false,
          movies: [],
          error: data.message || 'Search failed'
        })
      }
    } catch (error) {
      console.error('Search error:', error)
      this.setState({
        loading: false,
        movies: [],
        error: 'Failed to search movies. Make sure the API server is running.'
      })
    }
  }

  handleClearSearch() {
    this.setState({
      searchKeyword: '',
      movies: [],
      currentPage: 1,
      totalPages: 1,
      hasSearched: false,
      error: null
    })
  }

  handleAddToTorrentList(movie) {
    const magnetLink = movie.download_links?.find(link => link.type === 'magnet')
    if (magnetLink) {
      dispatcher('addTorrent', magnetLink.link)
      this.showNotification(`"${movie.title}" added to downloads!`)
    } else {
      this.showNotification('No magnet link available for this movie.', 'error')
    }
  }

  handleMovieClick(movie) {
    console.log('Movie clicked:', movie)
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
  }

  renderSearchSection() {
    const { searchKeyword, loading } = this.state
    
    return (
      <Paper className="search-section">
        <h2>Search Movies</h2>
        <form onSubmit={this.handleSearch} className="search-form">
          <TextField
            hintText="Enter movie title to search..."
            value={searchKeyword}
            onChange={this.handleKeywordChange}
            onKeyPress={(event) => {
              if (event.key === 'Enter') {
                this.handleSearch(event)
              }
            }}
            style={{ flex: 1 }}
            fullWidth
            inputStyle={{
              color: '#FAFAFA',
              fontSize: '16px',
              fontWeight: '400'
            }}
            hintStyle={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '16px'
            }}
            underlineStyle={{
              display: 'none'
            }}
            underlineFocusStyle={{
              display: 'none'
            }}
          />
          <IconButton 
            onClick={this.handleSearch}
            tooltip="Search"
            disabled={!searchKeyword.trim() || loading}
            style={{
              background: 'linear-gradient(135deg, #e50914, #f40612)',
              borderRadius: '50%',
              padding: '12px',
              color: 'white',
              boxShadow: '0 2px 8px rgba(229, 9, 20, 0.3)',
              transition: 'all 0.3s ease'
            }}
          >
            <SearchIcon />
          </IconButton>
          {searchKeyword && (
            <IconButton 
              onClick={this.handleClearSearch}
              tooltip="Clear Search"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '50%',
                padding: '12px',
                color: 'white',
                transition: 'all 0.3s ease'
              }}
            >
              <ClearIcon />
            </IconButton>
          )}
        </form>
      </Paper>
    )
  }

  renderMovieGrid() {
    const { movies } = this.state
    
    return (
      <div className="search-movies-grid">
        {movies.map((movie, index) => (
          <div key={index} className="search-movie-card" onClick={() => this.handleMovieClick(movie)}>
            <div className="movie-poster-container" style={{ height: '400px', position: 'relative' }}>
              {movie.poster ? (
                <img 
                  src={movie.poster} 
                  alt={movie.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '15px 15px 0 0'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(135deg, #3a3a3a, #1a1a1a)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#666',
                  fontSize: '14px',
                  borderRadius: '15px 15px 0 0'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎬</div>
                    <div>No Image</div>
                  </div>
                </div>
              )}
              
              {/* Quality badge */}
              {movie.quality && (
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.8)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)'
                }}>
                  {movie.quality}
                </div>
              )}
            </div>
            
            <div style={{ padding: '20px' }}>
              <h3 style={{
                color: '#FAFAFA',
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '12px',
                lineHeight: '1.3'
              }}>
                {movie.title || movie.full_title || 'Unknown Title'}
              </h3>
              
              {movie.description && (
                <p style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  marginBottom: '15px',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {movie.description}
                </p>
              )}
              
              <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '15px',
                flexWrap: 'wrap'
              }}>
                {movie.year && (
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#aaa',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {movie.year}
                  </span>
                )}
                {movie.genre && (
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#aaa',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}>
                    {movie.genre}
                  </span>
                )}
              </div>
              
              <button
                onClick={() => this.handleAddToTorrentList(movie)}
                disabled={!movie.download_links?.some(link => link.type === 'magnet')}
                style={{
                  background: movie.download_links?.some(link => link.type === 'magnet') ? 
                    'linear-gradient(135deg, #e50914, #f40612)' : 
                    'linear-gradient(135deg, #555, #666)',
                  color: 'white',
                  border: 'none',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  cursor: movie.download_links?.some(link => link.type === 'magnet') ? 'pointer' : 'not-allowed',
                  width: '100%',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase'
                }}
                onMouseEnter={(e) => {
                  if (movie.download_links?.some(link => link.type === 'magnet')) {
                    e.target.style.background = 'linear-gradient(135deg, #f40612, #ff1e2d)'
                    e.target.style.transform = 'translateY(-2px)'
                    e.target.style.boxShadow = '0 4px 15px rgba(229,9,20,0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (movie.download_links?.some(link => link.type === 'magnet')) {
                    e.target.style.background = 'linear-gradient(135deg, #e50914, #f40612)'
                    e.target.style.transform = 'translateY(0)'
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                  }
                }}
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
    )
  }

  render() {
    const { 
      loading, 
      error, 
      hasSearched,
      movies,
      searchKeyword
    } = this.state

    return (
      <div className="search-page">
        <Header state={this.props.state} />
        
        <div className="search-content">
          {this.renderSearchSection()}
          
          {loading && (
            <div className="search-loading">
              <div className="search-loading-spinner">
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid rgba(229, 9, 20, 0.3)',
                  borderTop: '4px solid #e50914',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              </div>
              <p style={{ fontSize: '18px', fontWeight: '500' }}>
                Searching for "{searchKeyword}"...
              </p>
            </div>
          )}

          {!loading && hasSearched && movies.length === 0 && (
            <div className="search-empty-state">
              <EmptySearchIcon />
              <h3>No movies found</h3>
              <p>
                We couldn't find any movies matching "{searchKeyword}". 
                Try searching with different keywords or check your spelling.
              </p>
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="search-empty-state">
              <EmptySearchIcon />
              <h3>Search Movies</h3>
              <p>
                Enter a movie title above to search for torrents. 
                You can search by title, genre, or year.
              </p>
            </div>
          )}

          {!loading && movies.length > 0 && this.renderMovieGrid()}
        </div>

        {error && (
          <Snackbar
            open={!!error}
            message={error}
            autoHideDuration={4000}
            onRequestClose={() => this.setState({ error: null })}
          />
        )}

        <MovieDetailsModal
          movie={this.state.selectedMovie}
          isOpen={this.state.isModalOpen}
          onClose={this.handleCloseModal}
          onAddToTorrentList={this.handleAddToTorrentList}
        />
      </div>
    )
  }
}

module.exports = SearchPage 