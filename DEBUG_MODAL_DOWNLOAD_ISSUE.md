# Modal Download Button Debug Summary

## Issue
The download button in the AppleMovieModal doesn't work in the search page but works in the category page.

## Root Causes Identified

1. **Missing URL for detail fetching**: 
   - The modal tries to fetch additional movie details when opened
   - Search results might not include `page_url` or `link` fields needed for the detail API call
   - Without these fields, the detail fetch would fail silently

2. **Inconsistent callback parameters**:
   - The modal's `onAddToTorrentList` can be called with either:
     - `(movie)` - when there's a single magnet link
     - `(movie, magnetLink)` - when there are multiple links (2-4)
   - The search page handler wasn't handling both cases

3. **Data adaptation issues**:
   - The API might return `magnet_links` instead of `download_links`
   - The adapter needs to properly convert between formats
   - Missing fallbacks for different field names (link, magnet, url)

## Fixes Applied

### 1. Added fallback when movie detail fetch fails
```javascript
// In AppleMovieModal.fetchMovieDetails()
if (!url) {
  console.warn('[AppleMovieModal] No URL available for movie details, using original movie data')
  this.setState({ 
    loading: false,
    detailedMovie: movie // Use original movie data as fallback
  })
  return
}
```

### 2. Updated search page handler to support both callback signatures
```javascript
onAddToTorrentList={(movie, directMagnetLink) => {
  // Use direct magnet link if provided (from modal's single link case)
  let magnetLinkToUse = directMagnetLink
  
  if (!magnetLinkToUse) {
    // Otherwise find the first magnet link
    const magnetLink = movie.download_links?.find(link => link.type === 'magnet')
    magnetLinkToUse = magnetLink?.link
  }
  
  if (magnetLinkToUse) {
    dispatch('addTorrent', magnetLinkToUse)
  }
}}
```

### 3. Enhanced movie data adapter
```javascript
// Added multiple fallbacks for magnet link fields
adaptedMovie.download_links = movie.magnet_links.map(magnetLink => ({
  quality: magnetLink.title || magnetLink.quality || 'HD',
  link: magnetLink.link || magnetLink.magnet || magnetLink.url,
  type: 'magnet',
  size: magnetLink.size,
  resolution: magnetLink.resolution
}))

// Added ID field fallback
if (!adaptedMovie.id && movie._id) {
  adaptedMovie.id = movie._id
}
```

### 4. Added comprehensive logging
- Search page: Logs raw API response and adapted movie data
- Modal: Logs movie details fetching and download button clicks
- Adapter: Logs data transformation process

## Testing Instructions

1. Open the app and go to the search page
2. Search for a movie
3. Click on a movie to open the modal
4. Check the browser console for debug logs
5. Try clicking the download button

The console logs will show:
- What data structure the search API returns
- How the adapter transforms the data
- Whether the modal can fetch additional details
- What happens when the download button is clicked

## Next Steps

If the issue persists after these fixes:
1. Check the console logs to see where the process fails
2. Verify the API response structure matches expectations
3. Ensure the backend is returning proper magnet links in search results