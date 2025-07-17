const React = require('react')

const ModalOKCancel = require('./modal-ok-cancel')
const { dispatch, dispatcher } = require('../lib/dispatcher')

module.exports = class DeleteAllTorrentsModal extends React.Component {
  render () {
    const { state: { modal: { deleteData } } } = this.props
    const message = 'Are you sure you want to remove all torrents and delete their files?'
    const buttonText = 'REMOVE ALL'

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
      dispatch('deleteAllTorrents', true) // Always delete files
      dispatch('exitModal')
    }
  }
}
