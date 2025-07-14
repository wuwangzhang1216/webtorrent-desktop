const React = require('react')
const { Card, CardActions, CardMedia, CardTitle, CardText } = require('material-ui/Card')
const FlatButton = require('material-ui/FlatButton')
const { GridList, GridTile } = require('material-ui/GridList')
const ActionMovie = require('material-ui/svg-icons/av/movie')
const colors = require('material-ui/styles/colors')

class MovieCategories extends React.Component {
  constructor(props) {
    super(props)
    
    this.handleCategoryClick = this.handleCategoryClick.bind(this)
  }

  handleCategoryClick(category) {
    this.props.onCategorySelect(category)
  }

  getCategoryIcon(categoryKey) {
    // You can add different icons for different categories
    const icons = {
      'action': '🎬',
      'comedy': '😄',
      'romance': '❤️',
      'scifi': '🚀',
      'drama': '🎭',
      'suspense': '🔍',
      'war': '⚔️',
      'horror': '😱',
      'disaster': '🌪️',
      'series': '📺',
      'anime': '🎌',
      'variety': '🎪',
      'anime_series': '📺🎌'
    }
    return icons[categoryKey] || '🎬'
  }

  render() {
    const { categories } = this.props

    if (!categories || categories.length === 0) {
      return (
        <div className="categories-empty">
          <h3>No categories available</h3>
          <p>Please check your connection to the movie API.</p>
        </div>
      )
    }

    return (
      <div className="movie-categories-container">
        <div className="categories-header">
          <h2>Browse by Category</h2>
          <p>Select a category to explore movies</p>
        </div>
        
        <div className="categories-grid">
          {categories.map((category) => (
            <Card 
              key={category.key} 
              className="category-card"
              onClick={() => this.handleCategoryClick(category)}
            >
              <CardMedia className="category-icon">
                <div className="category-icon-content">
                  <span className="category-emoji">
                    {this.getCategoryIcon(category.key)}
                  </span>
                </div>
              </CardMedia>
              <CardTitle
                title={category.name_cn}
                subtitle={category.name_en}
                className="category-title"
              />
              <CardActions>
                <FlatButton 
                  label="Browse"
                  primary={true}
                  onClick={() => this.handleCategoryClick(category)}
                />
              </CardActions>
            </Card>
          ))}
        </div>
      </div>
    )
  }
}

module.exports = MovieCategories 