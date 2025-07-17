from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import logging
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from functools import lru_cache
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, quote

app = Flask(__name__)
CORS(app)

# Configure Flask
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache configuration
CACHE_DURATION_MINUTES = 30
CACHE_MAX_SIZE = 1000

# Base URL
BASE_URL = "https://www.piaohua.com"

# Categories mapping
CATEGORIES = {
    'action': {'name': '动作片', 'path': 'dongzuo'},
    'comedy': {'name': '喜剧片', 'path': 'xiju'},
    'romance': {'name': '爱情片', 'path': 'aiqing'},
    'scifi': {'name': '科幻片', 'path': 'kehuan'},
    'drama': {'name': '剧情片', 'path': 'juqing'},
    'suspense': {'name': '悬疑片', 'path': 'xuanyi'},
    'war': {'name': '战争片', 'path': 'zhanzheng'},
    'horror': {'name': '恐怖片', 'path': 'kongbu'},
    'disaster': {'name': '灾难片', 'path': 'zainan'},
    'series': {'name': '连续剧', 'path': 'lianxuju'},
    'anime': {'name': '动漫', 'path': 'dongman'},
    'variety': {'name': '综艺节目', 'path': 'zongyi'},
}

# HTTP headers
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

class PiaohuaScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
    
    def get_soup(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch page and return BeautifulSoup object"""
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            response.encoding = 'utf-8'
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None
    
    def parse_home_page(self) -> List[Dict]:
        """Parse home page movies from ul-imgtxt1"""
        soup = self.get_soup(BASE_URL)
        if not soup:
            return []
        
        movies = []
        movie_list = soup.find('ul', class_='ul-imgtxt1')
        if not movie_list:
            return []
        
        for li in movie_list.find_all('li'):
            try:
                a = li.find('a')
                if not a:
                    continue
                
                link = urljoin(BASE_URL, a['href'])
                img = li.find('img')
                txt = li.find('div', class_='txt')
                
                movie = {
                    'id': self.extract_movie_id(link),
                    'link': link,
                    'title': txt.find('h3').text.strip() if txt and txt.find('h3') else '',
                    'date': txt.find('span').text.strip() if txt and txt.find('span') else '',
                    'poster': img['src'] if img else ''
                }
                
                # Clean title (remove quality info)
                movie['title'] = re.sub(r'(HD|BD|DVD|高清|中字|国语|双语).*$', '', movie['title']).strip()
                
                movies.append(movie)
            except Exception as e:
                logger.error(f"Error parsing home movie: {str(e)}")
                continue
        
        return movies
    
    def parse_category_page(self, category_path: str, page: int = 1) -> tuple[List[Dict], int]:
        """Parse category page movies from ul-imgtxt2"""
        if page == 1:
            url = f"{BASE_URL}/html/{category_path}/index.html"
        else:
            url = f"{BASE_URL}/html/{category_path}/list_{page}.html"
        
        soup = self.get_soup(url)
        if not soup:
            return [], 0
        
        movies = []
        movie_list = soup.find('ul', class_='ul-imgtxt2')
        if not movie_list:
            return [], 0
        
        for li in movie_list.find_all('li'):
            try:
                pic_div = li.find('div', class_='pic')
                txt_div = li.find('div', class_='txt')
                
                if not pic_div or not txt_div:
                    continue
                
                a = pic_div.find('a')
                img = pic_div.find('img')
                h3 = txt_div.find('h3')
                p = txt_div.find('p')
                spans = txt_div.find_all('span')
                
                link = urljoin(BASE_URL, a['href']) if a else ''
                
                movie = {
                    'id': self.extract_movie_id(link),
                    'link': link,
                    'title': h3.text.strip() if h3 else '',
                    'poster': img['src'] if img else '',
                    'synopsis': p.text.strip() if p else '',
                    'date': spans[-1].text.replace('更新时间：', '').strip() if spans else ''
                }
                
                # Clean title
                movie['title'] = re.sub(r'<[^>]+>', '', movie['title'])  # Remove HTML tags
                movie['title'] = re.sub(r'(HD|BD|DVD|高清|中字|国语|双语).*$', '', movie['title']).strip()
                
                movies.append(movie)
            except Exception as e:
                logger.error(f"Error parsing category movie: {str(e)}")
                continue
        
        # Get total pages from pagination
        total_pages = self.get_total_pages(soup)
        
        return movies, total_pages
    
    def parse_search_results(self, keyword: str, page: int = 1) -> tuple[List[Dict], int]:
        """Parse search results"""
        params = {
            'kwtype': '0',
            'keyword': keyword,
            'searchtype': '影视搜索',
            'PageNo': str(page) if page > 1 else '',
            'pagesize': '10',
            'typeid': '0',
            'orderby': '',
            'channeltype': '0'
        }
        
        # Build URL
        if page == 1:
            url = f"{BASE_URL}/plus/search.php"
        else:
            # For page > 1, need to include TotalResult parameter
            url = f"{BASE_URL}/plus/search.php?keyword={quote(keyword)}&searchtype=titlekeyword&channeltype=0&orderby=&kwtype=0&pagesize=10&typeid=0&PageNo={page}"
        
        if page == 1:
            soup = self.get_soup(url + '?' + '&'.join([f"{k}={quote(str(v))}" for k, v in params.items() if v]))
        else:
            soup = self.get_soup(url)
        
        if not soup:
            return [], 0
        
        movies = []
        movie_list = soup.find('ul', class_='ul-imgtxt2')
        if not movie_list:
            return [], 0
        
        for li in movie_list.find_all('li'):
            try:
                pic_div = li.find('div', class_='pic')
                txt_div = li.find('div', class_='txt')
                
                if not pic_div or not txt_div:
                    continue
                
                a = pic_div.find('a')
                img = pic_div.find('img')
                h3 = txt_div.find('h3')
                p = txt_div.find('p')
                spans = txt_div.find_all('span')
                
                link = urljoin(BASE_URL, a['href']) if a else ''
                
                movie = {
                    'id': self.extract_movie_id(link),
                    'link': link,
                    'title': h3.text.strip() if h3 else '',
                    'poster': img['src'] if img else '',
                    'synopsis': p.text.strip() if p else '',
                    'date': spans[-1].text.replace('更新时间：', '').strip() if spans else ''
                }
                
                # Clean title
                movie['title'] = re.sub(r'<[^>]+>', '', movie['title'])
                movie['title'] = re.sub(r'(HD|BD|DVD|高清|中字|国语|双语).*$', '', movie['title']).strip()
                
                movies.append(movie)
            except Exception as e:
                logger.error(f"Error parsing search result: {str(e)}")
                continue
        
        # Get total pages from search results
        total_pages = self.get_search_total_pages(soup)
        
        return movies, total_pages
    
    def parse_movie_detail(self, movie_url: str) -> Dict:
        """Parse movie detail page"""
        soup = self.get_soup(movie_url)
        if not soup:
            return {}
        
        detail = {
            'id': self.extract_movie_id(movie_url),
            'link': movie_url
        }
        
        # Extract genre from breadcrumb navigation
        breadcrumb = soup.find('div', class_='cur')
        if breadcrumb:
            # Find all links in breadcrumb
            links = breadcrumb.find_all('a')
            if len(links) >= 2:
                # The second link is usually the category/genre
                genre_text = links[1].text.strip()
                detail['genre_from_breadcrumb'] = genre_text
                # Map Chinese genre names to categories
                for cat_id, cat_info in CATEGORIES.items():
                    if cat_info['name'] == genre_text:
                        detail['category_id'] = cat_id
                        break
        
        # Find main content
        m_text = soup.find('div', class_='m-text1')
        if not m_text:
            return detail
        
        # Title
        h1 = m_text.find('h1')
        if h1:
            detail['title'] = re.sub(r'(HD|BD|DVD|高清|中字|国语|双语).*$', '', h1.text).strip()
            detail['full_title'] = h1.text.strip()
        
        # Info spans
        info_div = m_text.find('div', class_='info')
        if info_div:
            spans = info_div.find_all('span')
            for span in spans:
                text = span.text.strip()
                if text.startswith('片名：'):
                    detail['movie_name'] = text.replace('片名：', '').strip()
                elif text.startswith('发布时间：'):
                    detail['publish_date'] = text.replace('发布时间：', '').strip()
        
        # Content
        txt_div = m_text.find('div', class_='txt')
        if txt_div:
            # Find poster
            img = txt_div.find('img')
            if img:
                detail['poster'] = img['src']
            
            # Get all text content
            content = txt_div.get_text(separator='\n', strip=True)
            detail['content'] = content
            
            # Parse structured info
            lines = content.split('\n')
            for line in lines:
                line = line.strip()
                if '◎译　　名' in line:
                    detail['alt_titles'] = line.split('◎译　　名')[-1].strip()
                elif '◎年　　代' in line:
                    detail['year'] = line.split('◎年　　代')[-1].strip()
                elif '◎产　　地' in line:
                    detail['country'] = line.split('◎产　　地')[-1].strip()
                elif '◎类　　别' in line:
                    # Only set genre from content if we didn't get it from breadcrumb
                    if 'genre_from_breadcrumb' not in detail:
                        detail['genre'] = line.split('◎类　　别')[-1].strip()
                elif '◎语　　言' in line:
                    detail['language'] = line.split('◎语　　言')[-1].strip()
                elif '◎字　　幕' in line:
                    detail['subtitles'] = line.split('◎字　　幕')[-1].strip()
                elif '◎上映日期' in line:
                    detail['release_date'] = line.split('◎上映日期')[-1].strip()
                elif '◎IMDb评分' in line:
                    detail['imdb_rating'] = line.split('◎IMDb评分')[-1].strip()
                elif '◎片　　长' in line:
                    detail['duration'] = line.split('◎片　　长')[-1].strip()
                elif '◎导　　演' in line:
                    detail['director'] = line.split('◎导　　演')[-1].strip()
                elif '◎主　　演' in line:
                    detail['cast'] = line.split('◎主　　演')[-1].strip()
                elif '◎简　　介' in line:
                    # Get synopsis - everything after 简介
                    idx = content.find('◎简　　介')
                    if idx != -1:
                        synopsis_text = content[idx + len('◎简　　介'):].strip()
                        # Stop at screenshot marker
                        screenshot_idx = synopsis_text.find('◎影片截图')
                        if screenshot_idx != -1:
                            synopsis_text = synopsis_text[:screenshot_idx].strip()
                        detail['synopsis'] = synopsis_text
        
        # Download links - only magnet links
        bot_div = m_text.find('div', class_='bot')
        if bot_div:
            magnet_links = []
            for a in bot_div.find_all('a'):
                href = a.get('href', '')
                if href.startswith('magnet:'):
                    magnet_links.append({
                        'link': href,
                        'title': a.text.strip()
                    })
            detail['magnet_links'] = magnet_links
        
        return detail
    
    def extract_movie_id(self, url: str) -> str:
        """Extract movie ID from URL"""
        # Extract from URL like /html/dongzuo/2025/0628/58013.html
        match = re.search(r'/(\d+)\.html', url)
        if match:
            return match.group(1)
        return ''
    
    def get_total_pages(self, soup: BeautifulSoup) -> int:
        """Get total pages from pagination"""
        try:
            # Look for pagination div with class "pages"
            page_div = soup.find('div', class_='pages')
            if page_div:
                # Method 1: Find the "total" li element with text like "共196页2744条"
                total_li = page_div.find('li', class_='total')
                if total_li:
                    # Check span inside total li for "共找到30条记录/最大显示3页" format
                    total_span = total_li.find('span')
                    if total_span:
                        total_text = total_span.get_text()
                        # Try to match "最大显示3页" format
                        match = re.search(r'最大显示(\d+)页', total_text)
                        if match:
                            return int(match.group(1))
                    
                    # Try regular format "共196页"
                    total_text = total_li.get_text()
                    match = re.search(r'共(\d+)页', total_text)
                    if match:
                        return int(match.group(1))
                
                # Method 2: Find the "end" li element with last page link
                end_li = page_div.find('li', class_='end')
                if end_li:
                    end_link = end_li.find('a')
                    if end_link and end_link.get('href'):
                        match = re.search(r'list_(\d+)\.html', end_link['href'])
                        if match:
                            return int(match.group(1))
                
                # Method 3: Find all page links and get the maximum
                page_links = page_div.find_all('a', href=True)
                page_numbers = []
                
                # Also check for current page in <li class="on">
                on_li = page_div.find('li', class_='on')
                if on_li:
                    on_a = on_li.find('a')
                    if on_a and on_a.get_text().strip().isdigit():
                        page_numbers.append(int(on_a.get_text().strip()))
                
                for link in page_links:
                    # Check for list_N.html format
                    match = re.search(r'list_(\d+)\.html', link['href'])
                    if match:
                        page_numbers.append(int(match.group(1)))
                    # Also check if the link text itself is a number
                    elif link.get_text().strip().isdigit():
                        page_numbers.append(int(link.get_text().strip()))
                
                if page_numbers:
                    return max(page_numbers)
            
            return 1
        except Exception as e:
            logger.error(f"Error parsing pagination: {str(e)}")
            return 1
    
    def get_search_total_pages(self, soup: BeautifulSoup) -> int:
        """Get total pages from search results"""
        try:
            # Search results might use similar pagination structure
            page_div = soup.find('div', class_='pages')
            if page_div:
                # Method 1: Find total info
                total_li = page_div.find('li', class_='total')
                if total_li:
                    # Check span inside total li for "共找到30条记录/最大显示3页" format
                    total_span = total_li.find('span')
                    if total_span:
                        total_text = total_span.get_text()
                        # Try to match "最大显示3页" format
                        match = re.search(r'最大显示(\d+)页', total_text)
                        if match:
                            return int(match.group(1))
                    
                    # Try regular format "共N页"
                    total_text = total_li.get_text()
                    match = re.search(r'共(\d+)页', total_text)
                    if match:
                        return int(match.group(1))
                
                # Method 2: Find end page link
                end_li = page_div.find('li', class_='end')
                if end_li:
                    end_link = end_li.find('a')
                    if end_link and end_link.get('href'):
                        # For search results, might have PageNo parameter
                        match = re.search(r'PageNo=(\d+)', end_link['href'])
                        if match:
                            return int(match.group(1))
                
                # Method 3: Find all page numbers
                page_links = page_div.find_all('a', href=True)
                page_numbers = []
                
                # Also check for current page in <li class="on">
                on_li = page_div.find('li', class_='on')
                if on_li:
                    on_a = on_li.find('a')
                    if on_a and on_a.get_text().strip().isdigit():
                        page_numbers.append(int(on_a.get_text().strip()))
                
                for link in page_links:
                    # Check for PageNo parameter in search URLs
                    match = re.search(r'PageNo=(\d+)', link['href'])
                    if match:
                        page_numbers.append(int(match.group(1)))
                    # Also check if the link text itself is a number
                    elif link.get_text().strip().isdigit():
                        page_numbers.append(int(link.get_text().strip()))
                
                if page_numbers:
                    return max(page_numbers)
            
            return 1
        except Exception as e:
            logger.error(f"Error parsing search pagination: {str(e)}")
            return 1

# Initialize scraper
scraper = PiaohuaScraper()

# Cache functions
@lru_cache(maxsize=CACHE_MAX_SIZE)
def get_cached_data(cache_type: str, key: str, cache_time: str) -> Optional[Dict]:
    """Generic cache getter"""
    return None

def set_cached_data(cache_type: str, key: str, data: Dict, cache_time: str):
    """Generic cache setter"""
    get_cached_data.cache_clear()
    get_cached_data(cache_type, key, cache_time)
    get_cached_data.__wrapped__.__defaults__ = (data,)

def get_cache_key() -> str:
    """Generate cache key based on time window"""
    now = datetime.now()
    minutes = (now.minute // CACHE_DURATION_MINUTES) * CACHE_DURATION_MINUTES
    cache_time = now.replace(minute=minutes, second=0, microsecond=0)
    return cache_time.strftime("%Y%m%d%H%M")

def format_movie_response(movie: Dict, category: str = None) -> Dict:
    """Format movie data for API response"""
    return {
        'id': movie.get('id', ''),
        'title': movie.get('title', ''),
        'full_title': movie.get('full_title', movie.get('title', '')),
        'poster': movie.get('poster', ''),
        'synopsis': movie.get('synopsis', ''),
        'date': movie.get('date') or movie.get('publish_date', ''),
        'link': movie.get('link', ''),
        'category': category or movie.get('category_id'),
        'category_id': movie.get('category_id'),
        'year': movie.get('year'),
        'country': movie.get('country'),
        'genre': movie.get('genre_from_breadcrumb') or movie.get('genre'),
        'language': movie.get('language'),
        'subtitles': movie.get('subtitles'),
        'release_date': movie.get('release_date'),
        'imdb_rating': movie.get('imdb_rating'),
        'duration': movie.get('duration'),
        'director': movie.get('director'),
        'cast': movie.get('cast'),
        'magnet_links': movie.get('magnet_links', [])
    }

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all categories"""
    categories = {
        'movies': [],
        'other': []
    }
    
    for cat_id, cat_info in CATEGORIES.items():
        cat_data = {
            'id': cat_id,
            'name': cat_info['name'],
            'path': cat_info['path'],
            'count': 0  # Real-time, no pre-counted data
        }
        
        if cat_id in ['series', 'anime', 'variety']:
            categories['other'].append(cat_data)
        else:
            categories['movies'].append(cat_data)
    
    return jsonify({
        'status': 'success',
        'data': categories
    })

@app.route('/api/movies/<category_type>/<category>', methods=['GET'])
def get_movies_by_category(category_type, category):
    """Get movies by category"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 14, type=int)
    
    # Validate
    per_page = min(max(per_page, 1), 30)
    
    # Check cache
    cache_key = get_cache_key()
    cache_data = get_cached_data('category', f"{category}_{page}", cache_key)
    if cache_data:
        logger.info(f"Returning cached data for {category} page {page}")
        return jsonify(cache_data)
    
    try:
        # Get category info
        if category not in CATEGORIES:
            return jsonify({
                'status': 'error',
                'message': f'Unknown category: {category}'
            }), 404
        
        cat_info = CATEGORIES[category]
        logger.info(f"Fetching {category} page {page} from web...")
        
        # Fetch movies
        movies, total_pages = scraper.parse_category_page(cat_info['path'], page)
        
        # Format response
        formatted_movies = [format_movie_response(movie, category) for movie in movies]
        
        response_data = {
            'status': 'success',
            'data': {
                'category_type': category_type,
                'category': category,
                'category_name': cat_info['name'],
                'movies': formatted_movies[:per_page],
                'pagination': {
                    'current_page': page,
                    'total_pages': total_pages,
                    'total_movies': len(formatted_movies),
                    'per_page': per_page,
                    'has_next': page < total_pages,
                    'has_prev': page > 1
                },
                'cached': False,
                'cache_expires': (datetime.now() + timedelta(minutes=CACHE_DURATION_MINUTES)).isoformat()
            }
        }
        
        # Cache the response
        set_cached_data('category', f"{category}_{page}", response_data, cache_key)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error fetching category {category}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch movies'
        }), 500

@app.route('/api/movie/<movie_id>', methods=['GET'])
def get_movie_detail(movie_id):
    """Get movie detail"""
    # Check cache
    cache_key = get_cache_key()
    cache_data = get_cached_data('movie', movie_id, cache_key)
    if cache_data:
        logger.info(f"Returning cached data for movie {movie_id}")
        return jsonify(cache_data)
    
    try:
        # Get movie URL from request
        movie_url = request.args.get('url')
        if not movie_url:
            # Try to construct URL (this might not work without proper category)
            return jsonify({
                'status': 'error',
                'message': 'Movie URL is required'
            }), 400
        
        logger.info(f"Fetching movie {movie_id} detail from {movie_url}")
        
        # Fetch movie detail
        movie_detail = scraper.parse_movie_detail(movie_url)
        
        if not movie_detail or not movie_detail.get('title'):
            return jsonify({
                'status': 'error',
                'message': 'Movie not found'
            }), 404
        
        # Format response
        formatted_movie = format_movie_response(movie_detail)
        
        response_data = {
            'status': 'success',
            'data': formatted_movie,
            'cached': False,
            'cache_expires': (datetime.now() + timedelta(minutes=CACHE_DURATION_MINUTES)).isoformat()
        }
        
        # Cache the response
        set_cached_data('movie', movie_id, response_data, cache_key)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error fetching movie {movie_id}: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch movie details'
        }), 500

@app.route('/api/search', methods=['GET'])
def search_movies():
    """Search movies"""
    keyword = request.args.get('keyword', '').strip()
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    
    if not keyword:
        return jsonify({
            'status': 'error',
            'message': 'Keyword is required'
        }), 400
    
    # Check cache
    cache_key = get_cache_key()
    cache_data = get_cached_data('search', f"{keyword}_{page}", cache_key)
    if cache_data:
        logger.info(f"Returning cached search results for '{keyword}' page {page}")
        return jsonify(cache_data)
    
    try:
        logger.info(f"Searching for '{keyword}' page {page}")
        
        # Search movies
        movies, total_pages = scraper.parse_search_results(keyword, page)
        
        # Format response
        formatted_movies = [format_movie_response(movie) for movie in movies]
        
        # Handle edge case: if no movies found and page > 1, adjust total_pages
        if not movies and page > 1:
            # Try to get first page to determine actual total pages
            first_page_movies, actual_total_pages = scraper.parse_search_results(keyword, 1)
            if not first_page_movies:
                # No results at all, set total_pages to 1
                total_pages = 1
                page = 1  # Reset to page 1
            else:
                total_pages = actual_total_pages
        
        # Ensure current_page doesn't exceed total_pages
        if page > total_pages and total_pages > 0:
            page = total_pages
        
        response_data = {
            'status': 'success',
            'data': {
                'keyword': keyword,
                'movies': formatted_movies[:per_page],
                'pagination': {
                    'current_page': page,
                    'total_pages': total_pages,
                    'total_movies': len(formatted_movies),
                    'per_page': per_page,
                    'has_next': page < total_pages,
                    'has_prev': page > 1
                },
                'cached': False,
                'cache_expires': (datetime.now() + timedelta(minutes=CACHE_DURATION_MINUTES)).isoformat()
            }
        }
        
        # Cache the response
        set_cached_data('search', f"{keyword}_{page}", response_data, cache_key)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error searching for '{keyword}': {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to search movies'
        }), 500

@app.route('/api/latest', methods=['GET'])
def get_latest_movies():
    """Get latest movies"""
    limit = request.args.get('limit', 12, type=int)
    limit = min(max(limit, 1), 30)
    
    # Check cache
    cache_key = get_cache_key()
    cache_data = get_cached_data('latest', 'all', cache_key)
    if cache_data:
        logger.info("Returning cached latest movies")
        return jsonify(cache_data)
    
    try:
        all_movies = []
        
        # Fetch first page from popular categories
        popular_categories = ['action', 'comedy', 'scifi', 'drama']
        
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            
            for category in popular_categories[:3]:
                cat_info = CATEGORIES[category]
                future = executor.submit(scraper.parse_category_page, cat_info['path'], 1)
                futures.append((category, future))
            
            for category, future in futures:
                try:
                    movies, _ = future.result()
                    for movie in movies[:4]:  # Take first 4 from each category
                        formatted = format_movie_response(movie, category)
                        all_movies.append(formatted)
                except Exception as e:
                    logger.error(f"Error fetching latest from {category}: {str(e)}")
        
        # Sort by date (newest first)
        all_movies.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        response_data = {
            'status': 'success',
            'data': {
                'movies': all_movies[:limit],
                'total': len(all_movies),
                'cached': False,
                'cache_expires': (datetime.now() + timedelta(minutes=CACHE_DURATION_MINUTES)).isoformat()
            }
        }
        
        # Cache the response
        set_cached_data('latest', 'all', response_data, cache_key)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error fetching latest movies: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch latest movies'
        }), 500

@app.route('/api/home', methods=['GET'])
def get_home_data():
    """Get home page data"""
    # Check cache
    cache_key = get_cache_key()
    cache_data = get_cached_data('home', 'all', cache_key)
    if cache_data:
        logger.info("Returning cached home data")
        return jsonify(cache_data)
    
    try:
        logger.info("Fetching home page data...")
        
        # Get home page movies
        home_movies = scraper.parse_home_page()
        
        # Format movies
        formatted_home_movies = [format_movie_response(movie) for movie in home_movies]
        
        # Pick featured movie
        featured = formatted_home_movies[0] if formatted_home_movies else None
        
        # Create sections
        sections = []
        
        # Add latest updates section from home page
        if formatted_home_movies:
            sections.append({
                'title': '最新更新 Latest Updates',
                'type': 'movie',
                'movies': formatted_home_movies[:20]  # Increased from 12 to 20
            })
        
        # Fetch movies from different categories
        categories_to_fetch = [
            ('action', '动作片 Action Movies'),
            ('comedy', '喜剧片 Comedy Movies'),
            ('scifi', '科幻片 Sci-Fi Movies'),
            ('drama', '剧情片 Drama Movies'),
            ('horror', '恐怖片 Horror Movies'),
            ('romance', '爱情片 Romance Movies')
        ]
        
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = []
            
            for cat_id, title in categories_to_fetch:
                cat_info = CATEGORIES.get(cat_id)
                if cat_info:
                    future = executor.submit(scraper.parse_category_page, cat_info['path'], 1)
                    futures.append((cat_id, title, future))
            
            for cat_id, title, future in futures:
                try:
                    movies, _ = future.result(timeout=10)
                    if movies:
                        formatted_movies = [format_movie_response(movie, cat_id) for movie in movies[:15]]
                        if formatted_movies:
                            sections.append({
                                'title': title,
                                'type': 'movie',
                                'category': cat_id,
                                'movies': formatted_movies
                            })
                except Exception as e:
                    logger.error(f"Error fetching category {cat_id}: {str(e)}")
        
        response_data = {
            'status': 'success',
            'data': {
                'featured_movie': featured,
                'sections': sections,
                'statistics': {
                    'note': 'Statistics not available in online mode'
                },
                'cached': False,
                'cache_expires': (datetime.now() + timedelta(minutes=CACHE_DURATION_MINUTES)).isoformat()
            }
        }
        
        # Cache the response
        set_cached_data('home', 'all', response_data, cache_key)
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Error fetching home data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch home data'
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """Statistics are not available in online mode"""
    return jsonify({
        'status': 'success',
        'data': {
            'note': 'Statistics are not available in online mode',
            'mode': 'online',
            'cache_duration_minutes': CACHE_DURATION_MINUTES,
            'categories': list(CATEGORIES.keys())
        }
    })

@app.route('/', methods=['GET'])
def home():
    """API documentation"""
    return jsonify({
        'name': 'Piaohua Movie API (Online Mode)',
        'version': '2.0',
        'description': 'RESTful API for Piaohua movies with real-time web scraping',
        'mode': 'online',
        'cache_duration_minutes': CACHE_DURATION_MINUTES,
        'endpoints': {
            'categories': {
                'url': '/api/categories',
                'description': 'Get all categories'
            },
            'movies_by_category': {
                'url': '/api/movies/<category_type>/<category>',
                'description': 'Get movies by category (real-time scraping)',
                'parameters': {
                    'category_type': 'movie or other',
                    'category': 'Category ID (e.g., action, comedy, scifi)',
                    'page': 'Page number (default: 1)',
                    'per_page': 'Items per page (default: 14, max: 30)'
                },
                'example': '/api/movies/movie/action?page=1'
            },
            'movie_detail': {
                'url': '/api/movie/<movie_id>',
                'description': 'Get single movie details',
                'parameters': {
                    'url': 'Full movie URL (required)'
                },
                'example': '/api/movie/58013?url=https://www.piaohua.com/html/dongzuo/2025/0628/58013.html'
            },
            'search': {
                'url': '/api/search',
                'description': 'Search movies',
                'parameters': {
                    'keyword': 'Search keyword (required)',
                    'page': 'Page number (default: 1)',
                    'per_page': 'Items per page (default: 10)'
                },
                'example': '/api/search?keyword=007'
            },
            'latest': {
                'url': '/api/latest',
                'description': 'Get latest movies from popular categories',
                'parameters': {
                    'limit': 'Number of results (max: 30)'
                }
            },
            'home': {
                'url': '/api/home',
                'description': 'Get home page data'
            },
            'stats': {
                'url': '/api/stats',
                'description': 'Limited statistics in online mode'
            }
        },
        'notes': [
            'This API fetches data in real-time from piaohua.com',
            'Responses are cached for 30 minutes to reduce load',
            'Movie detail requires the full URL parameter',
            'Some features are optimized for performance'
        ]
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'status': 'error',
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    logger.info("Starting Piaohua Movie API in ONLINE mode")
    logger.info(f"Cache duration: {CACHE_DURATION_MINUTES} minutes")
    logger.info("Data will be fetched in real-time from piaohua.com")
    
    app.run(debug=False, port=8080, host='0.0.0.0')