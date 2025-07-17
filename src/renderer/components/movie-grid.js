const React = require('react')
const { memo } = React
const { Card, CardMedia, CardTitle, CardText, CardActions } = require('material-ui/Card')
const RaisedButton = require('material-ui/RaisedButton').default
const FlatButton = require('material-ui/FlatButton').default
const IconButton = require('material-ui/IconButton').default
const { Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarTitle } = require('material-ui/Toolbar')
const Divider = require('material-ui/Divider').default
const Dialog = require('material-ui/Dialog').default
const Chip = require('material-ui/Chip').default
const CloseIcon = require('material-ui/svg-icons/navigation/close').default
const DownloadIcon = require('material-ui/svg-icons/file/file-download').default

const AppleMovieCard = require('./apple-movie-card')
const MoviePagination = require('./movie-pagination')
const AppleMovieModal = require('./apple-movie-modal')

class MovieGrid extends React.Component {
  constructor(props) {
    super(props)
    
    this.state = {
      selectedMovie: null,
      isModalOpen: false
    }

    this.handleMovieClick = this.handleMovieClick.bind(this)
    this.handleCloseModal = this.handleCloseModal.bind(this)
  }

  handleMovieClick(movie) {
    this.setState({
      selectedMovie: movie,
      isModalOpen: true
    })
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden'
  }

  handleCloseModal() {
    this.setState({
      selectedMovie: null,
      isModalOpen: false
    })
    // Restore body scrolling when modal closes
    document.body.style.overflow = ''
  }
  
  componentWillUnmount() {
    // Clean up body scroll lock if component unmounts while modal is open
    document.body.style.overflow = ''
  }

  render() {
    const { 
      movies, 
      currentPage, 
      totalPages, 
      onPageChange, 
      onAddToTorrentList,
      categoryName 
    } = this.props

    if (!movies || movies.length === 0) {
      return (
        <div className="movie-grid-empty">
          <h3>No movies found</h3>
          <p>Try searching for something else or check a different category.</p>
        </div>
      )
    }

    return (
      <div className="movie-grid-container">
        {categoryName && (
          <div className="category-header">
            <h2>{categoryName}</h2>
            <Divider />
          </div>
        )}
        
        <div className="movie-grid">
          {movies.map((movie) => (
            <AppleMovieCard
              key={movie.id || `${movie.title}-${movie.year}`}
              movie={movie}
              onMovieClick={this.handleMovieClick}
              onAddToTorrentList={onAddToTorrentList}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <MoviePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        )}

        <AppleMovieModal
          movie={this.state.selectedMovie}
          isOpen={this.state.isModalOpen}
          onClose={this.handleCloseModal}
          onAddToTorrentList={onAddToTorrentList}
        />
      </div>
    )
  }
}

// Memoize the component to prevent unnecessary re-renders
module.exports = memo(MovieGrid, (prevProps, nextProps) => {
  // Custom comparison function for shallow equality
  return (
    prevProps.currentPage === nextProps.currentPage &&
    prevProps.totalPages === nextProps.totalPages &&
    prevProps.categoryName === nextProps.categoryName &&
    prevProps.movies === nextProps.movies && // Reference equality check
    prevProps.onPageChange === nextProps.onPageChange &&
    prevProps.onAddToTorrentList === nextProps.onAddToTorrentList
  )
}) 