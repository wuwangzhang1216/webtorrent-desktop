// Utility functions for string manipulation and cleaning

// Clean JSON-formatted strings (remove brackets and quotes)
function cleanJsonString(str) {
  if (!str) return ''
  // Remove square brackets and quotes, replace tabs with spaces
  return str.replace(/[\[\]"']/g, '').replace(/\\t/g, ' ').trim()
}

// Extract title from within 《》 brackets, fallback to full title
function extractCleanTitle(fullTitle, maxLength = 80) {
  if (!fullTitle) return ''
  
  // Extract content within 《》 brackets
  const bracketMatch = fullTitle.match(/《([^》]+)》/)
  if (bracketMatch) {
    return bracketMatch[1]
  }
  
  // If no brackets found, use full title with length limit
  return fullTitle.length > maxLength ? fullTitle.substring(0, maxLength) + '...' : fullTitle
}

// Decode HTML entities
function decodeHtmlEntities(text) {
  if (!text) return ''
  
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&middot;': '·',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™'
  }
  
  return text.replace(/&[a-zA-Z0-9#]+;/g, (match) => entities[match] || match)
}

module.exports = {
  cleanJsonString,
  extractCleanTitle,
  decodeHtmlEntities
}