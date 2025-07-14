const React = require('react')
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

const MovieCard = require('./movie-card')
const MoviePagination = require('./movie-pagination')
const MovieDetailsModal = require('./movie-details-modal')

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
  }

  handleCloseModal() {
    this.setState({
      selectedMovie: null,
      isModalOpen: false
    })
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
          {movies.map((movie, index) => (
            <MovieCard
              key={movie.id || index}
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

        <MovieDetailsModal
          movie={this.state.selectedMovie}
          isOpen={this.state.isModalOpen}
          onClose={this.handleCloseModal}
          onAddToTorrentList={onAddToTorrentList}
        />
      </div>
    )
  }
}

module.exports = MovieGrid 