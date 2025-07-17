const React = require('react')

const { dispatcher } = require('../lib/dispatcher')

class Header extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      scrolled: false
    }
  }

  componentDidMount() {
    window.addEventListener('scroll', this.handleScroll)
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleScroll)
  }

  handleScroll = () => {
    const scrolled = window.scrollY > 10
    if (scrolled !== this.state.scrolled) {
      this.setState({ scrolled })
    }
  }

  render () {
    const loc = this.props.state.location
    const currentUrl = loc.url()
    const { scrolled } = this.state
    
    return (
      <div
        className={`apple-header ${scrolled ? 'scrolled' : ''}`}
        role='navigation'
      >
        <div className='apple-header-content'>
          {/* Left spacer for grid layout */}
          <div className='apple-header-spacer'></div>

          {/* Center Navigation */}
          <nav className='apple-header-nav'>
            <button
              className={`apple-nav-item ${currentUrl === 'home' ? 'active' : ''}`}
              onClick={dispatcher('openMovieExploration')}
              aria-label='Home'
            >
              <span className='nav-item-content'>
                <span className='nav-item-text'>Home</span>
              </span>
            </button>
            
            <button
              className={`apple-nav-item ${currentUrl === 'category' ? 'active' : ''}`}
              onClick={dispatcher('openCategoryPage')}
              aria-label='Categories'
            >
              <span className='nav-item-content'>
                <span className='nav-item-text'>Categories</span>
              </span>
            </button>
            
            <button
              className={`apple-nav-item ${currentUrl === 'search' ? 'active' : ''}`}
              onClick={dispatcher('openSearchPage')}
              aria-label='Search'
            >
              <span className='nav-item-content'>
                <span className='nav-item-text'>Search</span>
              </span>
            </button>
            
            <button
              className={`apple-nav-item ${currentUrl === 'my-torrents' ? 'active' : ''}`}
              onClick={dispatcher('openMyTorrents')}
              aria-label='Downloads'
            >
              <span className='nav-item-content'>
                <span className='nav-item-text'>Downloads</span>
              </span>
            </button>
          </nav>

          {/* Right Actions - History buttons */}
          <div className='apple-header-actions'>
            {this.renderHistoryButtons()}
            {this.renderAddButton()}
          </div>
        </div>
      </div>
    )
  }

  renderHistoryButtons() {
    const loc = this.props.state.location
    
    return (
      <div className='apple-history-buttons'>
        <button
          className={`apple-history-btn ${!loc.hasBack() ? 'disabled' : ''}`}
          onClick={dispatcher('back')}
          disabled={!loc.hasBack()}
          aria-label='Back'
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <button
          className={`apple-history-btn ${!loc.hasForward() ? 'disabled' : ''}`}
          onClick={dispatcher('forward')}
          disabled={!loc.hasForward()}
          aria-label='Forward'
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>
    )
  }

  renderAddButton() {
    // Remove add button from header - it's now in the torrent list toolbar
    return null
  }
}

module.exports = Header
