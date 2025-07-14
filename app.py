from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin, quote
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

app = Flask(__name__)
CORS(app)

# Configure Flask to not escape Unicode characters in JSON
app.config['JSON_AS_ASCII'] = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_URL = "https://www.piaohua.com"

# Category mappings
CATEGORIES = {
    'action': 'dongzuo',      # 动作片
    'comedy': 'xiju',         # 喜剧片
    'romance': 'aiqing',      # 爱情片
    'scifi': 'kehuan',        # 科幻片
    'drama': 'juqing',        # 剧情片
    'suspense': 'xuannian',   # 悬疑片
    'war': 'zhanzheng',       # 战争片
    'horror': 'kongbu',       # 恐怖片
    'disaster': 'zainan',     # 灾难片
    'series': 'lianxuju',     # 连续剧
    'anime': 'dongman',       # 动漫
    'variety': 'zongyijiemu', # 综艺片
    'anime_series': 'lianzaidongman'  # 连载动漫
}

# Thread pool for parallel processing
executor = ThreadPoolExecutor(max_workers=10)

def get_soup(url, timeout=10):
    """Helper function to get BeautifulSoup object from URL"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.encoding = 'utf-8'
        return BeautifulSoup(response.text, 'html.parser')
    except Exception as e:
        logger.error(f"Error fetching {url}: {str(e)}")
        return None

def extract_movie_details(movie_url):
    """Extract full movie details including download links"""
    if not movie_url.startswith('http'):
        movie_url = urljoin(BASE_URL, movie_url)
    
    soup = get_soup(movie_url, timeout=8)
    if not soup:
        return {}
    
    movie_detail = {}
    
    # Get main content
    main_content = soup.find('div', class_='m-text1')
    if main_content:
        # Title
        h1 = main_content.find('h1')
        if h1:
            movie_detail['full_title'] = h1.get_text(strip=True)
        
        # Basic info
        info_div = main_content.find('div', class_='info')
        if info_div:
            spans = info_div.find_all('span')
            for span in spans:
                text = span.get_text(strip=True)
                if '片名：' in text:
                    movie_detail['name'] = text.replace('片名：', '').strip()
                elif '发布时间：' in text:
                    movie_detail['publish_date'] = text.replace('发布时间：', '').strip()
        
        # Detailed info and poster
        txt_div = main_content.find('div', class_='txt')
        if txt_div:
            # Get poster image
            img = txt_div.find('img')
            if img:
                movie_detail['poster_hd'] = img.get('src', '')
            
            # Parse detailed info
            content = txt_div.get_text(separator='\n', strip=True)
            lines = content.split('\n')
            
            info_dict = {}
            cast_list = []
            collecting_cast = False
            
            for line in lines:
                if '◎' in line:
                    collecting_cast = False
                    parts = line.split('　')
                    if len(parts) >= 2:
                        key = parts[0].replace('◎', '').strip()
                        value = '　'.join(parts[1:]).strip()
                        
                        # Map Chinese keys to English
                        key_mapping = {
                            '译名': 'translated_name',
                            '片名': 'original_name',
                            '年代': 'year',
                            '产地': 'country',
                            '类别': 'genre',
                            '语言': 'language',
                            '字幕': 'subtitles',
                            '上映日期': 'release_date',
                            '文件格式': 'format',
                            '视频尺寸': 'resolution',
                            '文件大小': 'file_size',
                            '片长': 'duration',
                            '导演': 'director',
                            '主演': 'cast',
                            '简介': 'synopsis'
                        }
                        
                        for cn_key, en_key in key_mapping.items():
                            if cn_key in key:
                                if en_key == 'cast':
                                    collecting_cast = True
                                    if value:
                                        cast_list.append(value)
                                else:
                                    info_dict[en_key] = value
                                break
                elif collecting_cast and line.strip() and not line.startswith('◎'):
                    cast_list.append(line.strip())
            
            movie_detail.update(info_dict)
            if cast_list:
                movie_detail['cast_list'] = cast_list
        
        # Get download links
        download_links = []
        bot_div = main_content.find('div', class_='bot')
        if bot_div:
            all_links = bot_div.find_all('a')
            for link in all_links:
                href = link.get('href', '')
                text = link.get_text(strip=True)
                
                if href and href != 'javascript: void(0);':
                    # Determine link type
                    if href.startswith('magnet:'):
                        link_type = 'magnet'
                    elif href.startswith('ftp://'):
                        link_type = 'ftp'
                    else:
                        link_type = 'http'
                    
                    download_links.append({
                        'quality': text,
                        'link': href,
                        'type': link_type
                    })
                elif 'magnet:?' in str(link.next_sibling):
                    # Check next sibling for magnet link
                    next_text = str(link.next_sibling)
                    magnet_match = re.search(r'(magnet:\?[^\s<]+)', next_text)
                    if magnet_match:
                        download_links.append({
                            'quality': text or 'Magnet',
                            'link': magnet_match.group(1),
                            'type': 'magnet'
                        })
            
            # Also check for magnet links in ul/li structure
            uls = bot_div.find_all('ul')
            for ul in uls:
                lis = ul.find_all('li')
                for li in lis:
                    li_text = li.get_text()
                    if 'magnet:?' in li_text:
                        magnet_match = re.search(r'(magnet:\?[^\s<]+)', li_text)
                        if magnet_match:
                            quality = 'Magnet'
                            a_tag = li.find('a')
                            if a_tag:
                                quality = a_tag.get_text(strip=True) or 'Magnet'
                            
                            # Check if this magnet link already exists
                            magnet_link = magnet_match.group(1)
                            if not any(dl['link'] == magnet_link for dl in download_links):
                                download_links.append({
                                    'quality': quality,
                                    'link': magnet_link,
                                    'type': 'magnet'
                                })
        
        movie_detail['download_links'] = download_links
    
    return movie_detail

def parse_movie_list_item_basic(item):
    """Parse basic movie info from list item"""
    try:
        movie = {}
        
        # Get image and link
        pic_div = item.find('div', class_='pic')
        if pic_div and pic_div.find('a'):
            link = pic_div.find('a')['href']
            movie['link'] = urljoin(BASE_URL, link)
            movie['relative_link'] = link
            movie['id'] = link.split('/')[-1].replace('.html', '')
            
            img = pic_div.find('img')
            if img:
                movie['poster'] = img.get('src', '')
                # Clean title
                title = img.get('alt', '')
                title = re.sub(r'<[^>]+>', '', title)  # Remove HTML tags
                movie['title'] = title
        
        # Get text info
        txt_div = item.find('div', class_='txt')
        if txt_div:
            # Title and quality
            h3 = txt_div.find('h3')
            if h3:
                title_text = h3.get_text(strip=True)
                em = h3.find('em')
                if em:
                    movie['quality'] = em.get_text(strip=True)
                    movie['title'] = title_text.replace(movie.get('quality', ''), '').strip()
                else:
                    movie['title'] = title_text
            
            # Description
            p = txt_div.find('p')
            if p:
                movie['description'] = p.get_text(strip=True)
            
            # Update time
            span = txt_div.find('span')
            if span:
                update_text = span.get_text(strip=True)
                if '更新时间：' in update_text:
                    movie['update_date'] = update_text.replace('更新时间：', '').split('点击下载')[0].strip()
        
        return movie
    except Exception as e:
        logger.error(f"Error parsing movie item: {str(e)}")
        return None

def parse_latest_movie_item(item):
    """Parse movie info from latest movies page structure"""
    try:
        movie = {}
        
        # Get the main link
        main_link = item.find('a')
        if not main_link:
            return None
        
        link = main_link['href']
        movie['link'] = urljoin(BASE_URL, link)
        movie['relative_link'] = link
        movie['id'] = link.split('/')[-1].replace('.html', '')
        
        # Get image and title from pic div
        pic_div = main_link.find('div', class_='pic')
        if pic_div:
            img = pic_div.find('img')
            if img:
                movie['poster'] = img.get('src', '')
                # Clean title from alt attribute
                title = img.get('alt', '')
                title = re.sub(r'<[^>]+>', '', title)  # Remove HTML tags
                title = re.sub(r'&lt;[^&]*&gt;', '', title)  # Remove encoded HTML tags
                movie['title'] = title.strip()
        
        # Get text info
        txt_div = main_link.find('div', class_='txt')
        if txt_div:
            # Title and quality from h3
            h3 = txt_div.find('h3')
            if h3:
                title_text = h3.get_text(strip=True)
                # Remove HTML color tags
                title_text = re.sub(r'<[^>]+>', '', title_text)
                movie['full_title'] = title_text
                
                # Extract base title (remove quality info)
                # Usually the title is at the beginning, quality info is at the end
                if movie.get('title'):
                    # Use the title from alt attribute as the clean title
                    pass
                else:
                    # Extract title from h3 text
                    movie['title'] = title_text
            
            # Get date from span
            span = txt_div.find('span')
            if span:
                date_text = span.get_text(strip=True)
                movie['update_date'] = date_text
        
        return movie
    except Exception as e:
        logger.error(f"Error parsing latest movie item: {str(e)}")
        return None

def enrich_movies_with_details(movies):
    """Fetch details for all movies in parallel"""
    enriched_movies = []
    
    # Create a future for each movie
    future_to_movie = {}
    for movie in movies:
        if movie and 'relative_link' in movie:
            future = executor.submit(extract_movie_details, movie['relative_link'])
            future_to_movie[future] = movie
    
    # Process completed futures
    for future in as_completed(future_to_movie):
        movie = future_to_movie[future]
        try:
            details = future.result()
            # Merge details with basic info
            enriched_movie = {**movie, **details}
            enriched_movies.append(enriched_movie)
        except Exception as e:
            logger.error(f"Error fetching details for {movie.get('title', 'Unknown')}: {str(e)}")
            # Still include the movie with basic info if details fetch fails
            enriched_movies.append(movie)
    
    return enriched_movies

def filter_movies_with_magnet_links(movies):
    """Filter movies to only include those with magnet links"""
    filtered_movies = []
    
    for movie in movies:
        download_links = movie.get('download_links', [])
        has_magnet_link = any(link.get('type') == 'magnet' for link in download_links)
        
        if has_magnet_link:
            filtered_movies.append(movie)
        else:
            logger.debug(f"Filtered out movie '{movie.get('title', 'Unknown')}' - no magnet link")
    
    return filtered_movies

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all available categories"""
    return jsonify({
        'status': 'success',
        'data': {
            'categories': [
                {'key': k, 'name_cn': v, 'name_en': k} 
                for k, v in {
                    'action': '动作片',
                    'comedy': '喜剧片',
                    'romance': '爱情片',
                    'scifi': '科幻片',
                    'drama': '剧情片',
                    'suspense': '悬疑片',
                    'war': '战争片',
                    'horror': '恐怖片',
                    'disaster': '灾难片',
                    'series': '连续剧',
                    'anime': '动漫',
                    'variety': '综艺片',
                    'anime_series': '连载动漫'
                }.items()
            ]
        }
    })

@app.route('/api/movies/<category>', methods=['GET'])
def get_movies_by_category(category):
    """Get movie list by category with full details"""
    start_time = time.time()
    page = request.args.get('page', 1, type=int)
    
    if category not in CATEGORIES:
        return jsonify({
            'status': 'error',
            'message': 'Invalid category'
        }), 400
    
    category_path = CATEGORIES[category]
    
    if page == 1:
        url = f"{BASE_URL}/html/{category_path}/index.html"
    else:
        url = f"{BASE_URL}/html/{category_path}/list_{page}.html"
    
    soup = get_soup(url)
    if not soup:
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch data'
        }), 500
    
    # Parse basic movie info
    basic_movies = []
    movie_list = soup.find('ul', class_='ul-imgtxt2 row')
    
    if movie_list:
        items = movie_list.find_all('li', class_='col-md-6')
        for item in items:
            movie = parse_movie_list_item_basic(item)
            if movie:
                basic_movies.append(movie)
    
    # Enrich with details in parallel
    enriched_movies = enrich_movies_with_details(basic_movies)
    
    # Filter to only include movies with magnet links
    movies = filter_movies_with_magnet_links(enriched_movies)
    
    # Try to get total pages from pagination
    total_pages = 1
    pages_div = soup.find('div', class_='pages')
    if pages_div:
        page_links = pages_div.find_all('a')
        for link in page_links:
            if 'list_' in link.get('href', ''):
                try:
                    page_num = int(re.search(r'list_(\d+)', link['href']).group(1))
                    total_pages = max(total_pages, page_num)
                except:
                    pass
    
    processing_time = time.time() - start_time
    
    return jsonify({
        'status': 'success',
        'data': {
            'movies': movies,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_movies': len(movies)
            },
            'processing_time': f"{processing_time:.2f} seconds"
        }
    })

@app.route('/api/search', methods=['GET'])
def search_movies():
    """Search for movies with full details"""
    start_time = time.time()
    keyword = request.args.get('keyword', '').strip()
    page = request.args.get('page', 1, type=int)
    
    if not keyword:
        return jsonify({
            'status': 'error',
            'message': 'Keyword is required'
        }), 400
    
    # Encode keyword for URL using UTF-8 (not GB2312)
    encoded_keyword = quote(keyword.encode('utf-8'))
    encoded_searchtype = quote('影视搜索'.encode('utf-8'))
    search_url = f"{BASE_URL}/plus/search.php?kwtype=0&keyword={encoded_keyword}&searchtype={encoded_searchtype}"
    
    if page > 1:
        search_url += f"&PageNo={page}"
    
    soup = get_soup(search_url)
    if not soup:
        return jsonify({
            'status': 'error',
            'message': 'Failed to search'
        }), 500
    
    # Parse basic movie info
    basic_movies = []
    search_results = soup.find('div', class_='m-film')
    
    if search_results:
        movie_list = search_results.find('ul', class_='ul-imgtxt2 row')
        if movie_list:
            items = movie_list.find_all('li', class_='col-md-6')
            for item in items:
                movie = parse_movie_list_item_basic(item)
                if movie:
                    # Add category info from search results
                    category_span = item.find('span', text=re.compile('影片分类：'))
                    if category_span:
                        category_link = category_span.find('a')
                        if category_link:
                            movie['category'] = category_link.get_text(strip=True)
                    
                    basic_movies.append(movie)
    
    # Enrich with details in parallel
    enriched_movies = enrich_movies_with_details(basic_movies)
    
    # Filter to only include movies with magnet links
    movies = filter_movies_with_magnet_links(enriched_movies)
    
    # Get pagination info
    total_pages = 1
    total_results = 0
    pages_div = soup.find('div', class_='pages')
    if pages_div:
        pages_text = pages_div.get_text(strip=True)
        # Parse "共X页/Y条记录"
        match = re.search(r'共(\d+)页/(\d+)条记录', pages_text)
        if match:
            total_pages = int(match.group(1))
            total_results = int(match.group(2))
    
    processing_time = time.time() - start_time
    
    return jsonify({
        'status': 'success',
        'data': {
            'keyword': keyword,
            'movies': movies,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_results': total_results
            },
            'processing_time': f"{processing_time:.2f} seconds"
        }
    })

@app.route('/api/latest', methods=['GET'])
def get_latest_movies():
    """Get latest movies from latest movies page with full details"""
    start_time = time.time()
    limit = request.args.get('limit', 20, type=int)
    
    # Use the correct URL for latest movies
    latest_url = f"{BASE_URL}/html/dianying.html"
    soup = get_soup(latest_url)
    if not soup:
        return jsonify({
            'status': 'error',
            'message': 'Failed to fetch latest movies page'
        }), 500
    
    # Parse basic movie info using the correct structure
    basic_movies = []
    movie_list = soup.find('ul', class_='ul-imgtxt1 row')
    
    if movie_list:
        items = movie_list.find_all('li', class_='col-sm-4')
        for item in items[:limit]:  # Limit results
            movie = parse_latest_movie_item(item)
            if movie:
                basic_movies.append(movie)
    
    # Enrich with details in parallel
    enriched_movies = enrich_movies_with_details(basic_movies)
    
    # Filter to only include movies with magnet links
    movies = filter_movies_with_magnet_links(enriched_movies)
    
    processing_time = time.time() - start_time
    
    return jsonify({
        'status': 'success',
        'data': {
            'movies': movies,
            'total': len(movies),
            'processing_time': f"{processing_time:.2f} seconds"
        }
    })

@app.route('/api/home', methods=['GET'])
def get_home_data():
    """Get all home page data in a single API call with parallel processing"""
    start_time = time.time()
    
    # Configuration for home page
    FEATURED_LIMIT = 10
    CATEGORY_LIMIT = 12
    HOME_CATEGORIES = ['action', 'comedy', 'drama', 'scifi', 'romance', 'horror']
    
    def fetch_latest_movies():
        """Fetch latest movies for featured section"""
        try:
            latest_url = f"{BASE_URL}/html/dianying.html"
            soup = get_soup(latest_url)
            if not soup:
                return []
            
            basic_movies = []
            movie_list = soup.find('ul', class_='ul-imgtxt1 row')
            
            if movie_list:
                items = movie_list.find_all('li', class_='col-sm-4')
                for item in items[:FEATURED_LIMIT]:
                    movie = parse_latest_movie_item(item)
                    if movie:
                        basic_movies.append(movie)
            
            enriched_movies = enrich_movies_with_details(basic_movies)
            return filter_movies_with_magnet_links(enriched_movies)
        except Exception as e:
            logger.error(f"Error fetching latest movies: {str(e)}")
            return []
    
    def fetch_category_movies(category):
        """Fetch movies for a specific category"""
        try:
            if category not in CATEGORIES:
                return []
            
            category_path = CATEGORIES[category]
            url = f"{BASE_URL}/html/{category_path}/index.html"
            
            soup = get_soup(url)
            if not soup:
                return []
            
            basic_movies = []
            movie_list = soup.find('ul', class_='ul-imgtxt2 row')
            
            if movie_list:
                items = movie_list.find_all('li', class_='col-md-6')
                for item in items[:CATEGORY_LIMIT]:
                    movie = parse_movie_list_item_basic(item)
                    if movie:
                        basic_movies.append(movie)
            
            enriched_movies = enrich_movies_with_details(basic_movies)
            return filter_movies_with_magnet_links(enriched_movies)
        except Exception as e:
            logger.error(f"Error fetching {category} movies: {str(e)}")
            return []
    
    # Create futures for parallel processing
    futures = {}
    
    # Fetch latest movies
    futures['latest'] = executor.submit(fetch_latest_movies)
    
    # Fetch movies for each category
    for category in HOME_CATEGORIES:
        futures[category] = executor.submit(fetch_category_movies, category)
    
    # Collect results
    results = {
        'latest': [],
        'categories': {}
    }
    
    for key, future in futures.items():
        try:
            result = future.result(timeout=30)  # 30 second timeout
            if key == 'latest':
                results['latest'] = result
            else:
                results['categories'][key] = result
        except Exception as e:
            logger.error(f"Error getting result for {key}: {str(e)}")
            if key == 'latest':
                results['latest'] = []
            else:
                results['categories'][key] = []
    
    # Prepare response data
    featured_movie = None
    if results['latest']:
        # Find the best movie for featured section (one with good poster and description)
        for movie in results['latest']:
            if (movie.get('poster_hd') or movie.get('poster')) and movie.get('description'):
                featured_movie = movie
                break
        # If no perfect match, use the first movie
        if not featured_movie:
            featured_movie = results['latest'][0]
    
    # Prepare movie rows
    movie_rows = [
        {
            'title': 'Latest Releases',
            'category': 'latest',
            'movies': results['latest']
        }
    ]
    
    # Add category rows
    category_titles = {
        'action': 'Action Movies',
        'comedy': 'Comedy Movies',
        'drama': 'Drama Movies',
        'scifi': 'Sci-Fi Movies',
        'romance': 'Romance Movies',
        'horror': 'Horror Movies'
    }
    
    for category in HOME_CATEGORIES:
        if category in results['categories'] and results['categories'][category]:
            movie_rows.append({
                'title': category_titles.get(category, category.title() + ' Movies'),
                'category': category,
                'movies': results['categories'][category]
            })
    
    # Calculate total movies
    total_movies = len(results['latest'])
    for category_movies in results['categories'].values():
        total_movies += len(category_movies)
    
    processing_time = time.time() - start_time
    
    return jsonify({
        'status': 'success',
        'data': {
            'featured_movie': featured_movie,
            'movie_rows': movie_rows,
            'statistics': {
                'total_movies': total_movies,
                'categories_loaded': len([cat for cat, movies in results['categories'].items() if movies]),
                'featured_available': bool(featured_movie)
            },
            'processing_time': f"{processing_time:.2f} seconds"
        }
    })

@app.route('/', methods=['GET'])
def home():
    """API documentation"""
    return jsonify({
        'message': 'Piaohua Movie API - Enhanced Edition',
        'version': '2.0',
        'features': [
            'All movie lists now include full details and download links',
            'Parallel processing for faster response times',
            'No separate detail endpoint needed',
            'New home endpoint for single-call home page data',
            'Only returns movies with magnet links available'
        ],
        'endpoints': {
            'home': {
                'url': '/api/home',
                'method': 'GET',
                'description': 'Get all home page data in a single API call',
                'note': 'Returns featured movie and multiple category rows with parallel processing. Only movies with magnet links are included.'
            },
            'categories': {
                'url': '/api/categories',
                'method': 'GET',
                'description': 'Get all available movie categories'
            },
            'movies_by_category': {
                'url': '/api/movies/<category>?page=1',
                'method': 'GET',
                'description': 'Get movies by category with full details',
                'parameters': {
                    'category': 'Category key (e.g., action, comedy, romance)',
                    'page': 'Page number (optional, default: 1)'
                },
                'note': 'Each movie includes full details and download links. Only movies with magnet links are returned.'
            },
            'search': {
                'url': '/api/search?keyword=<keyword>&page=1',
                'method': 'GET',
                'description': 'Search for movies with full details',
                'parameters': {
                    'keyword': 'Search keyword',
                    'page': 'Page number (optional, default: 1)'
                },
                'note': 'Each movie includes full details and download links. Only movies with magnet links are returned.'
            },
            'latest': {
                'url': '/api/latest?limit=20',
                'method': 'GET',
                'description': 'Get latest movies from dianying.html page with full details',
                'parameters': {
                    'limit': 'Number of movies to return (optional, default: 20)'
                },
                'note': 'Each movie includes full details and download links. Only movies with magnet links are returned.'
            }
        }
    })

if __name__ == '__main__':
    app.run(debug=False, port=8080, host='0.0.0.0')