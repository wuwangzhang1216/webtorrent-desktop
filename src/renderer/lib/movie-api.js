const config = require('../../config')

// Configuration for the movie API
const API_BASE_URL = 'http://localhost:8080/api'

class MovieAPI {
  constructor() {
    this.baseURL = API_BASE_URL
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    }

    try {
      const response = await fetch(url, config)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'API request failed')
      }
      
      return data
    } catch (error) {
      console.error('Movie API Error:', error)
      throw error
    }
  }

  /**
   * Get all available movie categories
   * @returns {Promise<Object>} Categories data
   */
  async getCategories() {
    return this.request('/categories')
  }

  /**
   * Get movies by category
   * @param {string} category - Category key (e.g., 'action', 'comedy')
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Movies data with pagination
   */
  async getMoviesByCategory(category, page = 1) {
    return this.request(`/movies/${category}?page=${page}`)
  }

  /**
   * Search for movies
   * @param {string} keyword - Search keyword
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Search results with pagination
   */
  async searchMovies(keyword, page = 1) {
    const encodedKeyword = encodeURIComponent(keyword)
    return this.request(`/search?keyword=${encodedKeyword}&page=${page}`)
  }

  /**
   * Get latest movies
   * @param {number} limit - Number of movies to fetch (default: 20)
   * @returns {Promise<Object>} Latest movies data
   */
  async getLatestMovies(limit = 20) {
    return this.request(`/latest?limit=${limit}`)
  }

  /**
   * Check if API is available
   * @returns {Promise<boolean>} True if API is reachable
   */
  async isApiAvailable() {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/`)
      return response.ok
    } catch (error) {
      return false
    }
  }
}

module.exports = new MovieAPI() 