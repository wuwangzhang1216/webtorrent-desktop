const React = require('react')
const CircularProgress = require('material-ui/CircularProgress')
const Snackbar = require('material-ui/Snackbar')
const Paper = require('material-ui/Paper')
const { Tabs, Tab } = require('material-ui/Tabs')
const TextField = require('material-ui/TextField')
const IconButton = require('material-ui/IconButton')
const SearchIcon = require('material-ui/svg-icons/action/search')
const RefreshIcon = require('material-ui/svg-icons/navigation/refresh')
const colors = require('material-ui/styles/colors')

const movieAPI = require('../lib/movie-api')
const MovieGrid = require('../components/movie-grid')
const MovieCategories = require('../components/movie-categories')
const { dispatcher } = require('../lib/dispatcher')

class MovieExplorationPage extends React.Component {
  constructor(props) {
    super(props)
    
    this.state = {
      currentTab: 'latest',
      categories: [],
      movies: [],
      loading: false,
      error: null,
      searchKeyword: '',
      currentPage: 1,
      totalPages: 1,
      selectedCategory: null,
      apiAvailable: false
    }

    this.handleTabChange = this.handleTabChange.bind(this)
    this.handleSearch = this.handleSearch.bind(this)
    this.handleKeywordChange = this.handleKeywordChange.bind(this)
    this.handleCategorySelect = this.handleCategorySelect.bind(this)
    this.handlePageChange = this.handlePageChange.bind(this)
    this.handleRefresh = this.handleRefresh.bind(this)
    this.handleAddToTorrentList = this.handleAddToTorrentList.bind(this)
    this.checkApiAvailability = this.checkApiAvailability.bind(this)
  }

  componentDidMount() {
    this.checkApiAvailability()
  }

  async checkApiAvailability() {
    try {
      const isAvailable = await movieAPI.isApiAvailable()
      this.setState({ apiAvailable: isAvailable })
      
      if (isAvailable) {
        await this.loadCategories()
        await this.loadLatestMovies()
      }
    } catch (error) {
      this.setState({ 
        apiAvailable: false,
        error: 'Failed to connect to movie API. Please ensure the Flask server is running on localhost:8080.'
      })
    }
  }

  async loadCategories() {
    try {
      const response = await movieAPI.getCategories()
      this.setState({ 
        categories: response.data.categories || []
      })
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  async loadLatestMovies() {
    this.setState({ loading: true })
    try {
      const response = await movieAPI.getLatestMovies(20)
      this.setState({ 
        movies: response.data.movies || [],
        loading: false,
        error: null
      })
    } catch (error) {
      this.setState({ 
        loading: false,
        error: 'Failed to load latest movies. Please try again.'
      })
    }
  }

  async loadMoviesByCategory(category, page = 1) {
    this.setState({ loading: true })
    try {
      const response = await movieAPI.getMoviesByCategory(category, page)
      this.setState({ 
        movies: response.data.movies || [],
        currentPage: response.data.pagination.current_page,
        totalPages: response.data.pagination.total_pages,
        loading: false,
        error: null
      })
    } catch (error) {
      this.setState({ 
        loading: false,
        error: `Failed to load ${category} movies. Please try again.`
      })
    }
  }

  async searchMovies(keyword, page = 1) {
    this.setState({ loading: true })
    try {
      const response = await movieAPI.searchMovies(keyword, page)
      this.setState({ 
        movies: response.data.movies || [],
        currentPage: response.data.pagination.current_page,
        totalPages: response.data.pagination.total_pages,
        loading: false,
        error: null
      })
    } catch (error) {
      this.setState({ 
        loading: false,
        error: `Failed to search for "${keyword}". Please try again.`
      })
    }
  }

  handleTabChange(value) {
    this.setState({ 
      currentTab: value,
      selectedCategory: null,
      searchKeyword: '',
      currentPage: 1
    })
    
    if (value === 'latest') {
      this.loadLatestMovies()
    }
  }

  handleSearch(e) {
    e.preventDefault()
    if (this.state.searchKeyword.trim()) {
      this.setState({ currentTab: 'search' })
      this.searchMovies(this.state.searchKeyword.trim())
    }
  }

  handleKeywordChange(e) {
    this.setState({ searchKeyword: e.target.value })
  }

  handleCategorySelect(category) {
    this.setState({ 
      selectedCategory: category,
      currentTab: 'categories',
      currentPage: 1
    })
    this.loadMoviesByCategory(category.key)
  }

  handlePageChange(page) {
    if (this.state.currentTab === 'search' && this.state.searchKeyword) {
      this.searchMovies(this.state.searchKeyword, page)
    } else if (this.state.selectedCategory) {
      this.loadMoviesByCategory(this.state.selectedCategory.key, page)
    }
  }

  handleRefresh() {
    if (this.state.currentTab === 'latest') {
      this.loadLatestMovies()
    } else if (this.state.currentTab === 'search' && this.state.searchKeyword) {
      this.searchMovies(this.state.searchKeyword, this.state.currentPage)
    } else if (this.state.selectedCategory) {
      this.loadMoviesByCategory(this.state.selectedCategory.key, this.state.currentPage)
    }
  }

  handleAddToTorrentList(movie, magnetLink) {
    if (magnetLink) {
      // Add the magnet link to the torrent list
      dispatcher('addTorrent', magnetLink)
      
      // Show success message
      this.setState({
        error: null,
        snackbarMessage: `"${movie.title}" added to torrent list!`
      })
    } else {
      this.setState({
        error: 'No magnet link available for this movie.'
      })
    }
  }

  render() {
    const { 
      currentTab, 
      categories, 
      movies, 
      loading, 
      error, 
      searchKeyword, 
      currentPage, 
      totalPages,
      selectedCategory,
      apiAvailable
    } = this.state

    if (!apiAvailable) {
      return (
        <div className="movie-exploration-page">
          <div className="api-error">
            <h2>Movie API Unavailable</h2>
            <p>Please ensure the Flask movie API server is running on localhost:8080</p>
            <p>Run: <code>python app.py</code></p>
            <IconButton onClick={this.checkApiAvailability} tooltip="Retry Connection">
              <RefreshIcon />
            </IconButton>
          </div>
        </div>
      )
    }

    return (
      <div className="movie-exploration-page">
        <Paper className="movie-header">
          <div className="search-section">
            <form onSubmit={this.handleSearch} className="search-form">
              <TextField
                hintText="Search movies..."
                value={searchKeyword}
                onChange={this.handleKeywordChange}
                className="search-input"
                fullWidth
              />
              <IconButton 
                type="submit" 
                onClick={this.handleSearch}
                tooltip="Search"
              >
                <SearchIcon />
              </IconButton>
            </form>
            <IconButton onClick={this.handleRefresh} tooltip="Refresh">
              <RefreshIcon />
            </IconButton>
          </div>

          <Tabs
            value={currentTab}
            onChange={this.handleTabChange}
            className="movie-tabs"
          >
            <Tab label="Latest" value="latest" />
            <Tab label="Categories" value="categories" />
            {searchKeyword && <Tab label="Search Results" value="search" />}
          </Tabs>
        </Paper>

        <div className="movie-content">
          {loading && (
            <div className="loading-container">
              <CircularProgress size={50} />
              <p>Loading movies...</p>
            </div>
          )}

          {!loading && currentTab === 'categories' && !selectedCategory && (
            <MovieCategories
              categories={categories}
              onCategorySelect={this.handleCategorySelect}
            />
          )}

          {!loading && (currentTab === 'latest' || currentTab === 'search' || selectedCategory) && (
            <MovieGrid
              movies={movies}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={this.handlePageChange}
              onAddToTorrentList={this.handleAddToTorrentList}
              categoryName={selectedCategory ? selectedCategory.name_cn : null}
            />
          )}
        </div>

        {error && (
          <Snackbar
            open={!!error}
            message={error}
            autoHideDuration={4000}
            onRequestClose={() => this.setState({ error: null })}
          />
        )}
      </div>
    )
  }
}

module.exports = MovieExplorationPage 