const React = require('react')

const { dispatcher } = require('../lib/dispatcher')
const Popover = require('material-ui/Popover').default
const MenuItem = require('material-ui/MenuItem').default

class Header extends React.Component {
  render () {
    const loc = this.props.state.location
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
        <div className='nav right float-right'>
          {this.getAddButton()}
        </div>
      </div>
    )
  }

  getTitle () {
    if (process.platform !== 'darwin') return null
    const state = this.props.state
    return (<div className='title ellipsis'>{state.window.title}</div>)
  }

  getAddButton () {
    const state = this.props.state
    if (state.location.url() !== 'home') return null
    return null // Remove add button from header
  }
}

// Dropdown button for Add
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
        <i
          className='icon add'
          title='Add torrent'
          onClick={this.handleClick}
          role='button'
        >
          add
        </i>
        <Popover
          open={this.state.open}
          anchorEl={this.state.anchorEl}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          targetOrigin={{ horizontal: 'right', vertical: 'top' }}
          onRequestClose={this.handleRequestClose}
        >
          <MenuItem primaryText='Upload torrent file' onClick={this.handleUpload} />
          <MenuItem primaryText='Enter magnet link' onClick={this.handleMagnet} />
        </Popover>
      </span>
    )
  }
}

module.exports = Header
