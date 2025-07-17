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
  if (movie.download_links && movie.download_links.length > 0) {
    console.log('[Adapter] Movie already has download_links, returning as-is')
    return movie
  }
  
  // Transform magnet_links to download_links format
  const adaptedMovie = { ...movie }
  
  if (movie.magnet_links && Array.isArray(movie.magnet_links)) {
    console.log('[Adapter] Converting magnet_links to download_links:', movie.magnet_links)
    // Normalize the magnet link field because backend may use varied keys
    adaptedMovie.download_links = movie.magnet_links
      .map((magnetLink) => {
        // Attempt to locate the actual magnet uri in a variety of common fields
        const uriCandidate =
          magnetLink.link ||
          magnetLink.magnet ||
          magnetLink.url ||
          magnetLink.magnet_link ||
          magnetLink.magnet_url ||
          magnetLink.href ||
          magnetLink.uri ||
          ''

        const magnetUri = typeof uriCandidate === 'string' ? uriCandidate.trim() : ''

        return {
          quality: magnetLink.title || magnetLink.quality || 'HD',
          link: magnetUri,
          type: 'magnet',
          size: magnetLink.size,
          resolution: magnetLink.resolution
        }
      })
      // Filter out any entries where we still failed to find a magnet URI
      .filter((dl) => !!dl.link)
  } else {
    console.log('[Adapter] No magnet_links found in movie data')
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
  
  // Ensure ID field exists
  if (!adaptedMovie.id && movie._id) {
    adaptedMovie.id = movie._id
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