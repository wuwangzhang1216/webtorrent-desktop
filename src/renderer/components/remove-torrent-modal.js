const React = require('react')

const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch, dispatcher } = require('../lib/dispatcher')

module.exports = class RemoveTorrentModal extends React.Component {
  render () {
    const state = this.props.state
    const message = 'Are you sure you want to remove this torrent and delete its files?'
    const buttonText = 'REMOVE'

    return (
      <div>
        <p><strong>{message}</strong></p>
        <ModalOKCancel
          cancelText='CANCEL'
          onCancel={dispatcher('exitModal')}
          okText={buttonText}
          onOK={handleRemove}
        />
      </div>
    )

    function handleRemove () {
      dispatch('deleteTorrent', state.modal.infoHash, state.modal.deleteData)
      dispatch('exitModal')
    }
  }
}
