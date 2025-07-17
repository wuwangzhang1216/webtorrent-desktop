const React = require('react')
const { adaptMovieList } = require('../lib/movie-data-adapter')

class SimpleMoviePage extends React.Component {
  constructor(props) {
    super(props)
    
    this.state = {
      movies: [],
      loading: true,
      error: null
    }
  }

  componentDidMount() {
    this.loadMovies()
  }

  async loadMovies() {
    try {
      // 简单的API测试
      const response = await fetch('http://localhost:8080/api/latest?limit=5')
      const data = await response.json()
      
      const adaptedMovies = adaptMovieList(data.data?.movies || [])
      this.setState({
        movies: adaptedMovies,
        loading: false,
        error: null
      })
    } catch (error) {
      this.setState({
        loading: false,
        error: 'Failed to load movies: ' + error.message
      })
    }
  }

  render() {
    const { movies, loading, error } = this.state

    return (
      <div style={{ 
        padding: '20px', 
        color: '#FAFAFA', 
        backgroundColor: 'rgb(40, 40, 40)',
        minHeight: '100vh'
      }}>
        <h1>Movie Exploration (Simple)</h1>
        
        {loading && <p>Loading movies...</p>}
        
        {error && (
          <div style={{ 
            color: '#ff6b6b', 
            backgroundColor: 'rgb(50, 50, 50)', 
            padding: '10px', 
            borderRadius: '5px',
            margin: '10px 0'
          }}>
            <p>Error: {error}</p>
            <p>Make sure the Flask server is running on localhost:8080</p>
          </div>
        )}
        
        {!loading && !error && movies.length === 0 && (
          <p>No movies found.</p>
        )}
        
        {movies.length > 0 && (
          <div>
            <h2>Latest Movies ({movies.length})</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {movies.map((movie, index) => (
                <div key={index} style={{
                  backgroundColor: 'rgb(50, 50, 50)',
                  borderRadius: '8px',
                  padding: '15px',
                  border: '1px solid rgb(60, 60, 60)'
                }}>
                  <h3 style={{ color: '#FAFAFA', marginTop: 0 }}>
                    {movie.title || movie.full_title || 'Unknown Title'}
                  </h3>
                  
                  {movie.poster && (
                    <img 
                      src={movie.poster} 
                      alt={movie.title}
                      style={{
                        width: '100%',
                        maxHeight: '200px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        marginBottom: '10px'
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  )}
                  
                  {movie.description && (
                    <p style={{ color: '#B0B0B0', fontSize: '14px' }}>
                      {movie.description.length > 150 
                        ? movie.description.substring(0, 150) + '...'
                        : movie.description
                      }
                    </p>
                  )}
                  
                  <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
                    {movie.year && <span>📅 {movie.year} </span>}
                    {movie.genre && <span>🎭 {movie.genre.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()} </span>}
                    {movie.duration && <span>⏱️ {movie.duration}</span>}
                  </div>
                  
                  {movie.download_links && movie.download_links.length > 0 && (
                    <div>
                      <p style={{ color: '#FAFAFA', margin: '10px 0 5px 0', fontSize: '14px' }}>
                        Download Links: {movie.download_links.length}
                      </p>
                      {movie.download_links
                        .filter(link => link.type === 'magnet')
                        .slice(0, 1)
                        .map((link, linkIndex) => (
                          <button
                            key={linkIndex}
                            onClick={() => this.handleAddToTorrentList(movie, link)}
                            style={{
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              padding: '8px 16px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '14px',
                              marginRight: '5px'
                            }}
                          >
                            📥 Add to Downloads ({link.quality || 'Magnet'})
                          </button>
                        ))
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  handleAddToTorrentList(movie, link) {
    if (link && link.link) {
      // 使用现有的dispatcher来添加torrent
      const { dispatch } = require('../lib/dispatcher')
      dispatch('addTorrent', link.link)
      
      // 简单的反馈
      alert(`"${movie.title}" has been added to download list!`)
    }
  }
}

module.exports = SimpleMoviePage 