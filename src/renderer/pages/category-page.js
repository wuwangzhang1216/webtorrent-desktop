const React = require('react')
const { useState, useEffect, useCallback } = React
const AppleMovieCard = require('../components/apple-movie-card')
const AppleMovieModal = require('../components/apple-movie-modal')
const { scrollToTop } = require('../lib/smooth-scroll')
const { adaptMovieList } = require('../lib/movie-data-adapter')

// SVG Icons for categories
const CategoryIcons = {
  action: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19.82 2H4.18C2.97 2 2 2.97 2 4.18v15.64C2 21.03 2.97 22 4.18 22h15.64A2.18 2.18 0 0022 19.82V4.18A2.18 2.18 0 0019.82 2z"/>
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
    </svg>
  ),
  comedy: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>
    </svg>
  ),
  romance: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ),
  scifi: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
      <path d="M12 8v4M12 16h.01"/>
    </svg>
  ),
  drama: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 15s1.5-2 4-2 4 2 4 2M9 9h.01M15 9h.01"/>
    </svg>
  ),
  suspense: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  ),
  war: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 20l3-9 3 9M12 3v8M6 7l6-2 6 2"/>
    </svg>
  ),
  horror: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
      <path d="M8 9h1M15 9h1M9 15s1.5 2 3 2 3-2 3-2"/>
    </svg>
  ),
  disaster: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"/>
      <path d="M3 9h18M9 21V9"/>
    </svg>
  ),
  series: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
      <polyline points="17 2 12 7 7 2"/>
    </svg>
  ),
  anime: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  variety: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <circle cx="12" cy="12" r="8"/>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2v8M12 14v8M2 12h8M14 12h8"/>
    </svg>
  ),
  anime_series: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="3"/>
      <path d="M12 2v6M12 11v2M8 16l4 4 4-4M6 12h12"/>
    </svg>
  ),
  series: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
      <path d="M17 2l-5 5-5-5"/>
    </svg>
  )
}

// Category configuration - mapped to backend categories
const CATEGORIES = {
  // Movie categories (using string IDs from app_online.py)
  'action': { name: '动作片', type: 'movie', icon: CategoryIcons.action },
  'comedy': { name: '喜剧片', type: 'movie', icon: CategoryIcons.comedy },
  'romance': { name: '爱情片', type: 'movie', icon: CategoryIcons.romance },
  'scifi': { name: '科幻片', type: 'movie', icon: CategoryIcons.scifi },
  'drama': { name: '剧情片', type: 'movie', icon: CategoryIcons.drama },
  'suspense': { name: '悬疑片', type: 'movie', icon: CategoryIcons.suspense },
  'war': { name: '战争片', type: 'movie', icon: CategoryIcons.war },
  'horror': { name: '恐怖片', type: 'movie', icon: CategoryIcons.horror },
  'disaster': { name: '灾难片', type: 'movie', icon: CategoryIcons.disaster },
  // Other categories
  'anime': { name: '动漫', type: 'other', icon: CategoryIcons.anime },
  'anime_series': { name: '连载动漫', type: 'other', icon: CategoryIcons.anime_series }
}

// Loading skeleton component
const MovieSkeleton = () => (
  <div className="apple-movie-card movie-skeleton">
    <div className="apple-movie-poster skeleton-poster"></div>
    <div className="apple-movie-info">
      <div className="skeleton-title"></div>
      <div className="skeleton-meta"></div>
    </div>
  </div>
)

// Empty state component
const EmptyState = ({ category }) => {
  const Icon = CATEGORIES[category]?.icon || CategoryIcons.action
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon />
      </div>
      <h3>No movies found</h3>
      <p>No movies available in this category yet.</p>
    </div>
  )
}

// Error state component
const ErrorState = ({ error, onRetry }) => (
  <div className="error-state">
    <div className="error-icon">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <h3>Something went wrong</h3>
    <p>{error.message || 'Failed to load movies'}</p>
    <button className="retry-button" onClick={onRetry}>
      Retry
    </button>
  </div>
)

// Pagination component
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  const pages = []
  const maxVisiblePages = 5
  
  let start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  let end = Math.min(totalPages, start + maxVisiblePages - 1)
  
  if (end - start < maxVisiblePages - 1) {
    start = Math.max(1, end - maxVisiblePages + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return (
    <div className="pagination">
      <button 
        className="page-button page-nav"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      
      {start > 1 && (
        <>
          <button className="page-button" onClick={() => onPageChange(1)}>1</button>
          {start > 2 && <span className="page-dots">...</span>}
        </>
      )}
      
      {pages.map(page => (
        <button
          key={page}
          className={`page-button ${page === currentPage ? 'active' : ''}`}
          onClick={() => onPageChange(page)}
        >
          {page}
        </button>
      ))}
      
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="page-dots">...</span>}
          <button className="page-button" onClick={() => onPageChange(totalPages)}>
            {totalPages}
          </button>
        </>
      )}
      
      <button 
        className="page-button page-nav"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  )
}

// Main category page component
function CategoryPage({ state }) {
  const selectedCategory = state.selectedCategory
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(selectedCategory || 'action')

  // Fetch movies by category
  const fetchMovies = useCallback(async (category, page = 1) => {
    setLoading(true)
    setError(null)
    
    try {
      // Get category type from CATEGORIES config
      const categoryConfig = CATEGORIES[category]
      if (!categoryConfig) {
        throw new Error('Invalid category')
      }
      
      const response = await fetch(
        `http://localhost:8080/api/movies/${categoryConfig.type}/${category}?page=${page}`
      )
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.status === 'success' && data.data) {
        // Adapt movie data to legacy format
        const adaptedMovies = adaptMovieList(data.data.movies || [])
        setMovies(adaptedMovies)
        setTotalPages(data.data.pagination?.total_pages || 1)
        setCurrentPage(page)
      } else {
        throw new Error(data.message || 'Failed to load movies')
      }
    } catch (err) {
      console.error('Error fetching movies:', err)
      setError(err)
      setMovies([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle category change
  const handleCategoryChange = useCallback((category) => {
    setActiveCategory(category)
    setCurrentPage(1)
    fetchMovies(category, 1)
    scrollToTop()
  }, [fetchMovies])

  // Handle page change
  const handlePageChange = useCallback((page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      fetchMovies(activeCategory, page)
      scrollToTop()
    }
  }, [activeCategory, currentPage, totalPages, fetchMovies])

  // Handle movie click
  const handleMovieClick = useCallback((movie) => {
    setSelectedMovie(movie)
    setIsModalOpen(true)
  }, [])

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setSelectedMovie(null)
  }, [])

  // Initial load
  useEffect(() => {
    fetchMovies(activeCategory, 1)
  }, [activeCategory, fetchMovies])

  // Update active category if prop changes
  useEffect(() => {
    if (selectedCategory && selectedCategory !== activeCategory) {
      handleCategoryChange(selectedCategory)
      // Clear the selectedCategory from state after using it
      state.selectedCategory = null
    }
  }, [selectedCategory, activeCategory, handleCategoryChange, state])

  return (
    <div className="category-page">
      {/* Category Navigation */}
      <div className="category-nav">
        <div className="category-tabs" id="category-tabs">
          {Object.entries(CATEGORIES).map(([key, config]) => {
            return (
              <button
                key={key}
                className={`category-tab ${activeCategory === key ? 'active' : ''}`}
                data-category={key}
                onClick={() => handleCategoryChange(key)}
              >
                <span className="category-name">{config.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          {CATEGORIES[activeCategory]?.name}
        </h1>
        <div className="page-info">
          {!loading && movies.length > 0 && (
            <span className="movie-count">
              {movies.length} titles
            </span>
          )}
        </div>
      </div>

      {/* Movies Grid */}
      <div className="movies-container">
        {loading ? (
          <div className="apple-movies-row">
            <div className="apple-movies-grid">
              {[...Array(12)].map((_, i) => (
                <MovieSkeleton key={i} />
              ))}
            </div>
          </div>
        ) : error ? (
          <ErrorState 
            error={error} 
            onRetry={() => fetchMovies(activeCategory, currentPage)} 
          />
        ) : movies.length === 0 ? (
          <EmptyState category={activeCategory} />
        ) : (
          <>
            <div className="apple-movies-row">
              <div className="apple-movies-grid">
                {movies.map((movie) => (
                  <AppleMovieCard
                    key={movie.id}
                    movie={movie}
                    onMovieClick={handleMovieClick}
                    onAddToTorrentList={(movie) => {
                      const magnetLink = movie.download_links?.find(link => link.type === 'magnet')
                      if (magnetLink) {
                        const { dispatch } = require('../lib/dispatcher')
                        dispatch('addTorrent', magnetLink.link)
                      }
                    }}
                  />
                ))}
              </div>
            </div>
            
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Movie Details Modal */}
      {selectedMovie && (
        <AppleMovieModal
          movie={selectedMovie}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAddToTorrentList={(movie) => {
            console.log('[CategoryPage] onAddToTorrentList called with movie:', movie)
            const magnetLink = movie.download_links?.find(link => link.type === 'magnet')
            console.log('[CategoryPage] Found magnetLink:', magnetLink)
            if (magnetLink) {
              const { dispatch } = require('../lib/dispatcher')
              console.log('[CategoryPage] Dispatching addTorrent')
              dispatch('addTorrent', magnetLink.link)
            }
          }}
        />
      )}
    </div>
  )
}

module.exports = CategoryPage