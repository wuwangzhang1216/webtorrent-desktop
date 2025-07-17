/**
 * Adapter to transform movie data between different API formats
 */

/**
 * Transform new API format to legacy format
 * @param {Object} movie - Movie object from new API
 * @returns {Object} Movie object in legacy format
 */
function adaptMovieData(movie) {
  if (!movie) return movie
  
  // If movie already has download_links, it's in legacy format
  if (movie.download_links) return movie
  
  // Transform magnet_links to download_links format
  const adaptedMovie = { ...movie }
  
  if (movie.magnet_links && Array.isArray(movie.magnet_links)) {
    adaptedMovie.download_links = movie.magnet_links.map(magnetLink => ({
      quality: magnetLink.title || 'HD',
      link: magnetLink.link,
      type: 'magnet'
    }))
  } else {
    adaptedMovie.download_links = []
  }
  
  // Ensure required fields exist
  if (!adaptedMovie.poster && adaptedMovie.image) {
    adaptedMovie.poster = adaptedMovie.image
  }
  
  if (!adaptedMovie.synopsis && adaptedMovie.description) {
    adaptedMovie.synopsis = adaptedMovie.description
  }
  
  // Add page_url from link if available
  if (movie.link && !adaptedMovie.page_url) {
    adaptedMovie.page_url = movie.link
  }
  
  return adaptedMovie
}

/**
 * Transform a list of movies
 * @param {Array} movies - Array of movie objects
 * @returns {Array} Array of adapted movie objects
 */
function adaptMovieList(movies) {
  if (!Array.isArray(movies)) return []
  return movies.map(adaptMovieData)
}

module.exports = {
  adaptMovieData,
  adaptMovieList
}