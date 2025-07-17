const React = require('react')
const { useState, useEffect, useCallback } = React
const AppleMovieCard = require('../components/apple-movie-card')
const AppleMovieModal = require('../components/apple-movie-modal')
const { adaptMovieList } = require('../lib/movie-data-adapter')

// SVG Icons
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
)

const ClearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
)

function SearchPage() {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [movies, setMovies] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedMovie, setSelectedMovie] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Search movies
  const handleSearch = useCallback(async (e, page = 1) => {
    if (e && e.preventDefault) e.preventDefault()
    
    const keyword = searchKeyword.trim()
    if (!keyword) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`http://localhost:8080/api/search?keyword=${encodeURIComponent(keyword)}&page=${page}`)
      const data = await response.json()
      console.log('[SearchPage] Raw API response:', data)
      
      if (data.status === 'success') {
        const adaptedMovies = adaptMovieList(data.data?.movies || [])
        console.log('[SearchPage] Adapted movies:', adaptedMovies)
        setMovies(adaptedMovies)
        setCurrentPage(data.data?.pagination?.current_page || 1)
        setTotalPages(data.data?.pagination?.total_pages || 1)
      } else {
        setError(data.message || 'Search failed')
        setMovies([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setError('Failed to search movies')
      setMovies([])
    } finally {
      setLoading(false)
    }
  }, [searchKeyword])

  const handleClearSearch = () => {
    setSearchKeyword('')
    setMovies([])
    setCurrentPage(1)
    setTotalPages(1)
    setError(null)
  }

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      handleSearch(null, page)
      window.scrollTo(0, 0)
    }
  }

  const handleMovieClick = (movie) => {
    setSelectedMovie(movie)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setSelectedMovie(null)
    setIsModalOpen(false)
  }

  return (
    <div className="search-page">
      <div className="search-header">
        <h1>Search Movies</h1>
        
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Enter movie title..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              disabled={loading}
            />
            {searchKeyword && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClearSearch}
                disabled={loading}
              >
                <ClearIcon />
              </button>
            )}
            <button
              type="submit"
              className="search-submit-btn"
              disabled={!searchKeyword.trim() || loading}
            >
              <SearchIcon />
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <div className="search-loading">
          <div className="loading-spinner" />
          <p>Searching for "{searchKeyword}"...</p>
        </div>
      )}

      {error && (
        <div className="search-error">
          <p>{error}</p>
        </div>
      )}

      {!loading && movies.length === 0 && searchKeyword && (
        <div className="search-empty">
          <p>No movies found for "{searchKeyword}"</p>
        </div>
      )}

      {!loading && movies.length > 0 && (
        <>
          <div className="movies-grid">
            {movies.map((movie, index) => (
              <AppleMovieCard
                key={index}
                movie={movie}
                onMovieClick={handleMovieClick}
                onAddToTorrentList={(movie, magnetLink) => {
                  const { dispatch } = require('../lib/dispatcher')
                  if (magnetLink) {
                    dispatch('addTorrent', magnetLink)
                  } else {
                    const link = movie.download_links?.find(link => link.type === 'magnet')
                    if (link) {
                      dispatch('addTorrent', link.link)
                    }
                  }
                }}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                Previous
              </button>
              
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Movie Details Modal */}
      {selectedMovie && (
        <AppleMovieModal
          movie={selectedMovie}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onAddToTorrentList={(movie, directMagnetLink) => {
            console.log('[SearchPage] onAddToTorrentList called with:', { movie, directMagnetLink })
            const { dispatch } = require('../lib/dispatcher')

            // Prefer the direct link if supplied (modal case with a single link)
            let magnetUri = typeof directMagnetLink === 'string' ? directMagnetLink : null

            // Fallback: Attempt to extract the first valid magnet URI from the movie object
            if (!magnetUri && movie && Array.isArray(movie.download_links)) {
              const firstMagnet = movie.download_links.find(l => l && l.type === 'magnet' && typeof l.link === 'string' && l.link.startsWith('magnet:'))
              magnetUri = firstMagnet ? firstMagnet.link : null
            }

            if (magnetUri) {
              console.log('[SearchPage] Dispatching addTorrent with magnet URI:', magnetUri)
              dispatch('addTorrent', magnetUri)
            } else {
              console.error('[SearchPage] Unable to locate a valid magnet URI for:', movie)
            }
          }}
        />
      )}
    </div>
  )
}

module.exports = SearchPage