const React = require('react')
const AppleMovieCard = require('../components/apple-movie-card')
const AppleMovieModal = require('../components/apple-movie-modal')
const { dispatcher } = require('../lib/dispatcher')
const { adaptMovieList } = require('../lib/movie-data-adapter')

// SVG Icons
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
)

const ClearIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
)

const EmptyIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 9V7h10v2h-2.15c.46.52.85 1.12 1.13 1.78.48-.41 1.1-.65 1.77-.65 1.52 0 2.75 1.23 2.75 2.75s-1.23 2.75-2.75 2.75c-.69 0-1.32-.25-1.8-.69-.23.42-.51.8-.83 1.14l1.89 1.9-1.41 1.41L14.17 18c-.51.3-1.08.5-1.67.59V20h-1v-1.41c-.6-.09-1.16-.29-1.67-.59l-1.43 1.43-1.41-1.41 1.9-1.9c-.33-.34-.6-.72-.83-1.14-.48.44-1.11.69-1.8.69-1.52 0-2.75-1.23-2.75-2.75s1.23-2.75 2.75-2.75c.67 0 1.29.24 1.77.65.28-.66.67-1.26 1.13-1.78H7zm5 2c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
  </svg>
)

class AppleSearchPage extends React.Component {
  constructor(props) {
    super(props)
    
    this.state = {
      searchQuery: '',
      movies: [],
      loading: false,
      error: null,
      currentPage: 1,
      totalPages: 1,
      hasSearched: false,
      selectedMovie: null,
      isModalOpen: false,
      searchHistory: this.loadSearchHistory()
    }

    this.searchTimeout = null
  }

  componentDidMount() {
    // Focus search input
    setTimeout(() => {
      const searchInput = document.querySelector('.apple-search-input')
      if (searchInput) searchInput.focus()
    }, 100)
  }

  componentWillUnmount() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }
  }

  loadSearchHistory() {
    try {
      const history = localStorage.getItem('searchHistory')
      return history ? JSON.parse(history) : []
    } catch {
      return []
    }
  }

  saveSearchHistory(query) {
    try {
      let history = this.state.searchHistory.filter(q => q !== query)
      history.unshift(query)
      history = history.slice(0, 5) // Keep only last 5 searches
      this.setState({ searchHistory: history })
      localStorage.setItem('searchHistory', JSON.stringify(history))
    } catch (e) {
      console.error('Failed to save search history:', e)
    }
  }

  handleSearchChange = (e) => {
    const query = e.target.value
    this.setState({ searchQuery: query })

    // Debounced search
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout)
    }

    if (query.trim().length > 2) {
      this.searchTimeout = setTimeout(() => {
        this.performSearch(query)
      }, 500)
    }
  }

  handleSearchSubmit = (e) => {
    e.preventDefault()
    const { searchQuery } = this.state
    if (searchQuery.trim()) {
      this.performSearch(searchQuery)
    }
  }

  performSearch = async (query, page = 1) => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    // Store the query for pagination
    if (page === 1) {
      this.lastSearchQuery = trimmedQuery
    }

    this.setState({ 
      loading: true, 
      error: null,
      hasSearched: true
    })

    try {
      const response = await fetch(`http://localhost:8080/api/search?keyword=${encodeURIComponent(trimmedQuery)}&page=${page}`)
      const data = await response.json()
      
      if (data.status === 'success') {
        const adaptedMovies = adaptMovieList(data.data?.movies || [])
        this.setState({
          loading: false,
          movies: adaptedMovies,
          currentPage: data.data?.pagination?.current_page || 1,
          totalPages: data.data?.pagination?.total_pages || 1
        })
        this.saveSearchHistory(trimmedQuery)
      } else {
        throw new Error(data.message || 'Search failed')
      }
    } catch (error) {
      console.error('Search error:', error)
      this.setState({
        loading: false,
        error: 'Unable to search movies. Please check your connection.',
        movies: []
      })
    }
  }

  handleClearSearch = () => {
    this.setState({
      searchQuery: '',
      movies: [],
      hasSearched: false,
      error: null
    })
    const searchInput = document.querySelector('.apple-search-input')
    if (searchInput) searchInput.focus()
  }

  handleHistoryClick = (query) => {
    this.setState({ searchQuery: query })
    this.performSearch(query)
  }

  handleAddToTorrentList = (movie) => {
    const magnetLink = movie.download_links?.find(link => link.type === 'magnet')
    if (magnetLink) {
      dispatcher('addTorrent', magnetLink.link)
    }
  }

  handleMovieClick = (movie) => {
    this.setState({
      selectedMovie: movie,
      isModalOpen: true
    })
    document.body.style.overflow = 'hidden'
  }

  handlePageChange = (page) => {
    if (page >= 1 && page <= this.state.totalPages && page !== this.state.currentPage) {
      // Use the last search query for pagination
      this.performSearch(this.lastSearchQuery || this.state.searchQuery, page)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  handleCloseModal = () => {
    this.setState({
      selectedMovie: null,
      isModalOpen: false
    })
    document.body.style.overflow = ''
  }

  renderSearchHistory() {
    const { searchHistory, searchQuery } = this.state
    
    if (!searchHistory.length || searchQuery.trim()) return null

    return (
      <div className="apple-search-history">
        <h3>Recent Searches</h3>
        <div className="history-list">
          {searchHistory.map((query, index) => (
            <button
              key={index}
              className="history-item"
              onClick={() => this.handleHistoryClick(query)}
            >
              <SearchIcon />
              <span>{query}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  renderSearchResults() {
    const { movies, loading, error, hasSearched, searchQuery, currentPage, totalPages } = this.state

    if (loading) {
      return (
        <div className="apple-search-loading">
          <div className="apple-spinner" />
          <p>Searching for "{searchQuery}"...</p>
        </div>
      )
    }

    if (error) {
      return (
        <div className="apple-search-empty">
          <div className="empty-icon">⚠️</div>
          <h3>Search Error</h3>
          <p>{error}</p>
          <button 
            className="apple-retry-button"
            onClick={() => this.performSearch(searchQuery)}
          >
            Try Again
          </button>
        </div>
      )
    }

    if (hasSearched && movies.length === 0) {
      return (
        <div className="apple-search-empty">
          <EmptyIcon />
          <h3>No Results Found</h3>
          <p>We couldn't find any movies matching "{searchQuery}"</p>
          <p className="suggestion">Try searching with different keywords</p>
        </div>
      )
    }

    if (movies.length > 0) {
      return (
        <>
          <div className="apple-search-results-header">
            <h2>Search Results</h2>
            <p>{movies.length} movie{movies.length !== 1 ? 's' : ''} found</p>
          </div>
          <div className="apple-search-grid">
            {movies.map((movie) => (
              <AppleMovieCard
                key={movie.id || `${movie.title}-${movie.year}`}
                movie={movie}
                onMovieClick={this.handleMovieClick}
                onAddToTorrentList={this.handleAddToTorrentList}
              />
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="apple-pagination">
              <button
                className="apple-page-button apple-page-nav"
                onClick={() => this.handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </button>
              
              <div className="apple-page-numbers">
                {(() => {
                  const pages = []
                  const maxVisible = 5
                  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                  let end = Math.min(totalPages, start + maxVisible - 1)
                  
                  if (end - start < maxVisible - 1) {
                    start = Math.max(1, end - maxVisible + 1)
                  }
                  
                  if (start > 1) {
                    pages.push(
                      <button key={1} className="apple-page-button" onClick={() => this.handlePageChange(1)}>1</button>
                    )
                    if (start > 2) pages.push(<span key="dots1" className="apple-page-dots">...</span>)
                  }
                  
                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <button
                        key={i}
                        className={`apple-page-button ${i === currentPage ? 'active' : ''}`}
                        onClick={() => this.handlePageChange(i)}
                      >
                        {i}
                      </button>
                    )
                  }
                  
                  if (end < totalPages) {
                    if (end < totalPages - 1) pages.push(<span key="dots2" className="apple-page-dots">...</span>)
                    pages.push(
                      <button key={totalPages} className="apple-page-button" onClick={() => this.handlePageChange(totalPages)}>
                        {totalPages}
                      </button>
                    )
                  }
                  
                  return pages
                })()}
              </div>
              
              <button
                className="apple-page-button apple-page-nav"
                onClick={() => this.handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )
    }

    return null
  }

  render() {
    const { searchQuery, hasSearched } = this.state

    return (
      <div className="apple-search-page">
        <div className="apple-search-container">
          <div className="apple-search-header">
            <h1>Search Movies</h1>
            <p>Find your favorite movies and add them to downloads</p>
          </div>

          <form className="apple-search-form" onSubmit={this.handleSearchSubmit}>
            <div className="apple-search-field">
              <SearchIcon />
              <input
                type="text"
                className="apple-search-input"
                placeholder="Search for movies..."
                value={searchQuery}
                onChange={this.handleSearchChange}
                autoComplete="off"
                spellCheck="false"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="apple-search-clear"
                  onClick={this.handleClearSearch}
                  aria-label="Clear search"
                >
                  <ClearIcon />
                </button>
              )}
            </div>
          </form>

          <div className="apple-search-content">
            {!hasSearched && !searchQuery && this.renderSearchHistory()}
            {this.renderSearchResults()}
          </div>
        </div>

        <AppleMovieModal
          movie={this.state.selectedMovie}
          isOpen={this.state.isModalOpen}
          onClose={this.handleCloseModal}
          onAddToTorrentList={this.handleAddToTorrentList}
        />
      </div>
    )
  }
}

module.exports = AppleSearchPage