const React = require('react')

const { dispatcher } = require('../lib/dispatcher')
const Popover = require('material-ui/Popover').default
const MenuItem = require('material-ui/MenuItem').default

class Header extends React.Component {
  render () {
    const loc = this.props.state.location
    const currentUrl = loc.url()
    
    return (
      <div
        className='header'
        onMouseMove={dispatcher('mediaMouseMoved')}
        onMouseEnter={dispatcher('mediaControlsMouseEnter')}
        onMouseLeave={dispatcher('mediaControlsMouseLeave')}
        role='navigation'
      >
        {this.getTitle()}
        <div className='nav left float-left'>
          <i
            className={'icon back ' + (loc.hasBack() ? '' : 'disabled')}
            title='Back'
            onClick={dispatcher('back')}
            role='button'
            aria-disabled={!loc.hasBack()}
            aria-label='Back'
          >
            chevron_left
          </i>
          <i
            className={'icon forward ' + (loc.hasForward() ? '' : 'disabled')}
            title='Forward'
            onClick={dispatcher('forward')}
            role='button'
            aria-disabled={!loc.hasForward()}
            aria-label='Forward'
          >
            chevron_right
          </i>
        </div>
        
        {/* Enhanced Navigation buttons with improved styling */}
        <div className='nav center'>
          <button
            className={`nav-button ${currentUrl === 'home' ? 'active' : ''}`}
            onClick={dispatcher('openMovieExploration')}
            title='Browse Movies'
            aria-label='Browse Movies'
          >
            <i className='icon'>home</i>
            <span>Home</span>
          </button>
          
          <button
            className={`nav-button ${currentUrl === 'search' ? 'active' : ''}`}
            onClick={dispatcher('openSearchPage')}
            title='Search Movies'
            aria-label='Search Movies'
          >
            <i className='icon'>search</i>
            <span>Search</span>
          </button>
          
          <button
            className={`nav-button ${currentUrl === 'my-torrents' ? 'active' : ''}`}
            onClick={dispatcher('openMyTorrents')}
            title='My Downloads'
            aria-label='My Downloads'
          >
            <i className='icon'>download</i>
            <span>Downloads</span>
          </button>
        </div>
        
        <div className='nav right float-right'>
          {this.getAddButton()}
        </div>
      </div>
    )
  }

  getTitle () {
    if (process.platform !== 'darwin') return null
    const state = this.props.state
    return (
      <div className='title ellipsis'>
        <span style={{ 
          background: 'linear-gradient(135deg, #e50914 0%, #f40612 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontWeight: 'bold'
        }}>
          StreamHaven
        </span>
      </div>
    )
  }

  getAddButton () {
    const state = this.props.state
    if (state.location.url() !== 'my-torrents') return null
    
    return (
      <AddDropdownButton />
    )
  }
}

// Enhanced dropdown button for Add
class AddDropdownButton extends React.Component {
  constructor (props) {
    super(props)
    this.state = { open: false, anchorEl: null }
    this.handleClick = this.handleClick.bind(this)
    this.handleRequestClose = this.handleRequestClose.bind(this)
    this.handleUpload = this.handleUpload.bind(this)
    this.handleMagnet = this.handleMagnet.bind(this)
  }

  handleClick (event) {
    event.preventDefault()
    this.setState({ open: true, anchorEl: event.currentTarget })
  }

  handleRequestClose () {
    this.setState({ open: false })
  }

  handleUpload () {
    this.setState({ open: false })
    require('../lib/dispatcher').dispatch('openFiles')
  }

  handleMagnet () {
    this.setState({ open: false })
    require('../lib/dispatcher').dispatch('openTorrentAddress')
  }

  render () {
    return (
      <span>
        <button
          className='nav-button add-button'
          onClick={this.handleClick}
          title='Add Torrent'
          aria-label='Add Torrent'
          style={{
            background: 'linear-gradient(135deg, #e50914 0%, #f40612 100%)',
            border: 'none',
            borderRadius: '25px',
            padding: '10px 20px',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 2px 8px rgba(229, 9, 20, 0.3)',
            fontWeight: '600'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #f40612 0%, #ff1e2d 100%)'
            e.target.style.transform = 'translateY(-2px)'
            e.target.style.boxShadow = '0 4px 15px rgba(229, 9, 20, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'linear-gradient(135deg, #e50914 0%, #f40612 100%)'
            e.target.style.transform = 'translateY(0)'
            e.target.style.boxShadow = '0 2px 8px rgba(229, 9, 20, 0.3)'
          }}
        >
          <i className='icon' style={{ marginRight: '5px' }}>add</i>
          <span>Add</span>
        </button>
        <Popover
          open={this.state.open}
          anchorEl={this.state.anchorEl}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          targetOrigin={{ horizontal: 'right', vertical: 'top' }}
          onRequestClose={this.handleRequestClose}
          style={{
            marginTop: '10px',
            borderRadius: '15px',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}
        >
          <MenuItem 
            primaryText='Upload Torrent File' 
            onClick={this.handleUpload}
            style={{ 
              padding: '15px 20px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#FAFAFA',
              fontWeight: '500'
            }}
          />
          <MenuItem 
            primaryText='Enter Magnet Link' 
            onClick={this.handleMagnet}
            style={{ 
              padding: '15px 20px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#FAFAFA',
              fontWeight: '500'
            }}
          />
        </Popover>
      </span>
    )
  }
}

module.exports = Header
