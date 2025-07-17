// Smooth scroll utility functions

// Scroll to top with smooth animation
function scrollToTop() {
  const contentElement = document.querySelector('.content')
  if (contentElement) {
    contentElement.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    })
  } else {
    // Fallback to window scroll if no content element found
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    })
  }
}

// Scroll to specific element
function scrollToElement(element, offset = 0) {
  if (!element) return
  
  const contentElement = document.querySelector('.content')
  if (contentElement) {
    const elementPosition = element.getBoundingClientRect().top + contentElement.scrollTop
    const offsetPosition = elementPosition - offset
    
    contentElement.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })
  } else {
    // Fallback to window scroll
    const elementPosition = element.getBoundingClientRect().top + window.pageYOffset
    const offsetPosition = elementPosition - offset
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    })
  }
}

// Scroll to position
function scrollToPosition(x, y) {
  const contentElement = document.querySelector('.content')
  if (contentElement) {
    contentElement.scrollTo({
      top: y,
      left: x,
      behavior: 'smooth'
    })
  } else {
    // Fallback to window scroll
    window.scrollTo({
      top: y,
      left: x,
      behavior: 'smooth'
    })
  }
}

module.exports = {
  scrollToTop,
  scrollToElement,
  scrollToPosition
}