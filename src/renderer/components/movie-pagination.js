const React = require('react')
const FlatButton = require('material-ui/FlatButton')
const IconButton = require('material-ui/IconButton')
const NavigateBefore = require('material-ui/svg-icons/image/navigate-before')
const NavigateNext = require('material-ui/svg-icons/image/navigate-next')
const FirstPage = require('material-ui/svg-icons/navigation/first-page')
const LastPage = require('material-ui/svg-icons/navigation/last-page')
const colors = require('material-ui/styles/colors')

class MoviePagination extends React.Component {
  constructor(props) {
    super(props)
    
    this.handlePageChange = this.handlePageChange.bind(this)
  }

  handlePageChange(page) {
    if (page >= 1 && page <= this.props.totalPages && page !== this.props.currentPage) {
      this.props.onPageChange(page)
    }
  }

  renderPageNumbers() {
    const { currentPage, totalPages } = this.props
    const pages = []
    
    // Calculate visible page range
    let startPage = Math.max(1, currentPage - 2)
    let endPage = Math.min(totalPages, currentPage + 2)
    
    // Adjust range if we're at the beginning or end
    if (currentPage <= 3) {
      endPage = Math.min(5, totalPages)
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(totalPages - 4, 1)
    }
    
    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(
        <FlatButton
          key={1}
          label="1"
          onClick={() => this.handlePageChange(1)}
          className="pagination-button"
        />
      )
      
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis-start" className="pagination-ellipsis">...</span>
        )
      }
    }
    
    // Add visible page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <FlatButton
          key={i}
          label={i.toString()}
          onClick={() => this.handlePageChange(i)}
          primary={i === currentPage}
          className={`pagination-button ${i === currentPage ? 'active' : ''}`}
        />
      )
    }
    
    // Add ellipsis and last page if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis-end" className="pagination-ellipsis">...</span>
        )
      }
      
      pages.push(
        <FlatButton
          key={totalPages}
          label={totalPages.toString()}
          onClick={() => this.handlePageChange(totalPages)}
          className="pagination-button"
        />
      )
    }
    
    return pages
  }

  render() {
    const { currentPage, totalPages } = this.props
    
    if (totalPages <= 1) return null
    
    return (
      <div className="movie-pagination">
        <div className="pagination-controls">
          <IconButton
            onClick={() => this.handlePageChange(1)}
            disabled={currentPage === 1}
            tooltip="First Page"
          >
            <FirstPage />
          </IconButton>
          
          <IconButton
            onClick={() => this.handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            tooltip="Previous Page"
          >
            <NavigateBefore />
          </IconButton>
          
          <div className="pagination-numbers">
            {this.renderPageNumbers()}
          </div>
          
          <IconButton
            onClick={() => this.handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            tooltip="Next Page"
          >
            <NavigateNext />
          </IconButton>
          
          <IconButton
            onClick={() => this.handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            tooltip="Last Page"
          >
            <LastPage />
          </IconButton>
        </div>
        
        <div className="pagination-info">
          Page {currentPage} of {totalPages}
        </div>
      </div>
    )
  }
}

module.exports = MoviePagination 