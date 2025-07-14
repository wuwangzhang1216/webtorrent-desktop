const React = require('react')
const Drawer = require('material-ui/Drawer')
const { List, ListItem } = require('material-ui/List')
const Divider = require('material-ui/Divider')
const IconButton = require('material-ui/IconButton')
const MovieIcon = require('material-ui/svg-icons/av/movie')
const DownloadIcon = require('material-ui/svg-icons/file/file-download')
const MenuIcon = require('material-ui/svg-icons/navigation/menu')
const ChevronLeft = require('material-ui/svg-icons/navigation/chevron-left')
const colors = require('material-ui/styles/colors')

const { dispatcher } = require('../lib/dispatcher')

class Sidebar extends React.Component {
  constructor(props) {
    super(props)
    
    this.toggleSidebar = this.toggleSidebar.bind(this)
    this.handleNavigate = this.handleNavigate.bind(this)
  }

  toggleSidebar() {
    const { dispatch } = require('../lib/dispatcher')
    const newIsOpen = !this.props.state.saved.ui.sidebarOpen
    dispatch('updateUIPreference', 'sidebarOpen', newIsOpen)
    
    // Update app content margin
    const appContent = document.querySelector('.app-content')
    if (appContent) {
      appContent.style.marginLeft = newIsOpen ? '240px' : '60px'
    }
  }

  handleNavigate(route) {
    const { dispatch } = require('../lib/dispatcher')
    if (route === 'explore') {
      dispatch('openMovieExploration')
    } else if (route === 'downloads') {
      dispatch('openMyTorrents')
    }
  }

  componentDidMount() {
    // Set initial app content margin
    const appContent = document.querySelector('.app-content')
    if (appContent) {
      const isOpen = this.props.state.saved.ui.sidebarOpen
      appContent.style.marginLeft = isOpen ? '240px' : '60px'
    }
  }

  render() {
    const { state } = this.props
    const isOpen = state.saved.ui.sidebarOpen
    const currentUrl = state.location.url()
    
    const sidebarWidth = isOpen ? 240 : 60
    
    // Create style objects once per render to avoid Material-UI prepareStyles warning
    const drawerContainerStyle = {
      backgroundColor: 'rgb(30, 30, 30)',
      borderRight: '1px solid rgb(60, 60, 60)',
      transition: 'width 0.3s ease'
    }
    
    const iconButtonStyle = { padding: 8 }
    const iconButtonIconStyle = { color: '#FAFAFA' }
    const dividerStyle = { backgroundColor: 'rgb(60, 60, 60)' }
    const dividerFooterStyle = { backgroundColor: 'rgb(60, 60, 60)', marginBottom: 10 }
    
    const homeItemStyle = {
      backgroundColor: currentUrl === 'home' ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
      borderRadius: isOpen ? '0 25px 25px 0' : '50%',
      margin: isOpen ? '4px 8px 4px 0' : '4px',
      minHeight: 48,
      color: '#FAFAFA'
    }
    
    const homeItemInnerStyle = {
      paddingLeft: isOpen ? 16 : 20,
      color: '#FAFAFA'
    }
    
    const downloadsItemStyle = {
      backgroundColor: currentUrl === 'my-torrents' ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
      borderRadius: isOpen ? '0 25px 25px 0' : '50%',
      margin: isOpen ? '4px 8px 4px 0' : '4px',
      minHeight: 48,
      color: '#FAFAFA'
    }
    
    const downloadsItemInnerStyle = {
      paddingLeft: isOpen ? 16 : 20,
      color: '#FAFAFA'
    }
    
    return (
      <div className="sidebar-container">
        <Drawer
          open={true}
          width={sidebarWidth}
          containerStyle={drawerContainerStyle}
        >
          <div className="sidebar-header">
            <IconButton 
              onClick={this.toggleSidebar}
              iconStyle={iconButtonIconStyle}
              style={iconButtonStyle}
            >
              {isOpen ? <ChevronLeft /> : <MenuIcon />}
            </IconButton>
            {isOpen && (
              <div className="sidebar-title">
                <span>StreamHaven</span>
              </div>
            )}
          </div>
          
          <Divider style={dividerStyle} />
          
          <List className="sidebar-nav">
            <ListItem
              primaryText={isOpen ? "Explore Movies" : ""}
              leftIcon={<MovieIcon color={currentUrl === 'home' ? colors.blue500 : '#FAFAFA'} />}
              onClick={() => this.handleNavigate('explore')}
              className={`sidebar-item ${currentUrl === 'home' ? 'active' : ''}`}
              style={homeItemStyle}
              innerDivStyle={homeItemInnerStyle}
            />
            
            <ListItem
              primaryText={isOpen ? "My Downloads" : ""}
              leftIcon={<DownloadIcon color={currentUrl === 'my-torrents' ? colors.green500 : '#FAFAFA'} />}
              onClick={() => this.handleNavigate('downloads')}
              className={`sidebar-item ${currentUrl === 'my-torrents' ? 'active' : ''}`}
              style={downloadsItemStyle}
              innerDivStyle={downloadsItemInnerStyle}
            />
          </List>
          
          {isOpen && (
            <div className="sidebar-footer">
              <Divider style={dividerFooterStyle} />
              <div className="sidebar-status">
                <div className="status-item">
                  <span className="status-label">Torrents:</span>
                  <span className="status-value">{state.saved.torrents.length}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Active:</span>
                  <span className="status-value">
                    {state.saved.torrents.filter(t => t.status === 'downloading' || t.status === 'seeding').length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Drawer>
      </div>
    )
  }
}

module.exports = Sidebar 