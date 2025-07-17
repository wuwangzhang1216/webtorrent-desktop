from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import json
import logging
import os
from functools import lru_cache

app = Flask(__name__)
CORS(app)

# Configure Flask
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_PRETTYPRINT_REGULAR'] = True

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database path
DB_PATH = os.path.join(os.path.dirname(__file__), 'movies.db')

# Category mappings
MOVIE_CATEGORIES = {
    '0': '剧情片',
    '1': '喜剧片',
    '2': '动作片',
    '3': '爱情片',
    '4': '科幻片',
    '5': '动画片',
    '6': '悬疑片',
    '7': '惊悚片',
    '8': '恐怖片',
    '9': '纪录片',
    '11': '音乐歌舞题材电影',
    '12': '传记片',
    '13': '历史片',
    '14': '战争片',
    '15': '犯罪片',
    '16': '奇幻电影',
    '17': '冒险电影',
    '18': '灾难片',
    '19': '武侠片',
    '20': '古装片'
}


OTHER_CATEGORIES = {
    'zongyi2013': '综艺',
    'dongman': '动漫资源'
}

def get_db_connection():
    """Create a database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only = ON")
    return conn

def safe_json_loads(json_str, default=None):
    """Safely parse JSON string"""
    if not json_str:
        return default
    try:
        return json.loads(json_str)
    except:
        return default

def parse_movie_row(row):
    """Convert database row to movie dictionary"""
    movie = dict(row)
    
    # Parse JSON fields
    movie['genre_list'] = safe_json_loads(movie.get('genre'), [])
    movie['cast_list'] = safe_json_loads(movie.get('cast'), [])
    movie['screenshots'] = safe_json_loads(movie.get('screenshots'), [])
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get download links
    cursor.execute('''
        SELECT quality, link, type
        FROM download_links 
        WHERE movie_id = ?
        ORDER BY 
            CASE type 
                WHEN 'magnet' THEN 1 
                WHEN 'ftp' THEN 2 
                ELSE 3 
            END
    ''', (movie['id'],))
    
    download_links = []
    for link_row in cursor.fetchall():
        link_data = {
            'quality': link_row['quality'],
            'link': link_row['link'],
            'type': link_row['type']
        }
        download_links.append(link_data)
    
    conn.close()
    
    # Get category name
    category_name = ''
    if movie.get('category_type') == 'movie':
        category_name = MOVIE_CATEGORIES.get(movie.get('category'), '')
    elif movie.get('category_type') == 'other':
        category_name = OTHER_CATEGORIES.get(movie.get('category'), '')
    
    # Build response
    return {
        'id': movie.get('id'),
        'title': movie.get('title'),
        'translated_name': movie.get('translated_name'),
        'original_name': movie.get('original_name'),
        'year': movie.get('year'),
        'country': movie.get('country'),
        'genre': movie.get('genre'),
        'genre_list': movie.get('genre_list', []),
        'language': movie.get('language'),
        'subtitles': movie.get('subtitles'),
        'release_date': movie.get('release_date'),
        'imdb_rating': movie.get('imdb_rating'),
        'douban_rating': movie.get('douban_rating'),
        'file_format': movie.get('file_format'),
        'video_size': movie.get('video_size'),
        'file_size': movie.get('file_size'),
        'duration': movie.get('duration'),
        'director': movie.get('director'),
        'cast': movie.get('cast'),
        'cast_list': movie.get('cast_list', []),
        'synopsis': movie.get('synopsis'),
        'poster': movie.get('poster'),
        'screenshots': movie.get('screenshots', []),
        'category': movie.get('category'),
        'category_type': movie.get('category_type'),
        'category_name': category_name,
        'publish_date': movie.get('publish_date'),
        'page_url': movie.get('page_url'),
        'download_links': download_links,
        
        # Convenience flags
        'has_magnet': any(link['type'] == 'magnet' for link in download_links),
        'has_ftp': any(link['type'] == 'ftp' for link in download_links)
    }

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get all categories with counts"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get counts by category
    cursor.execute('''
        SELECT category, category_type, COUNT(*) as count 
        FROM movies 
        GROUP BY category, category_type
    ''')
    
    category_counts = {}
    for row in cursor.fetchall():
        key = f"{row['category_type']}_{row['category']}"
        category_counts[key] = row['count']
    
    conn.close()
    
    # Build response
    categories = {
        'movies': [],
        'other': []
    }
    
    # Movie categories
    for cat_id, cat_name in MOVIE_CATEGORIES.items():
        categories['movies'].append({
            'id': cat_id,
            'name': cat_name,
            'count': category_counts.get(f"movie_{cat_id}", 0),
            'url': f"/{cat_id}/"
        })
    
    # Other categories
    for cat_key, cat_name in OTHER_CATEGORIES.items():
        categories['other'].append({
            'id': cat_key,
            'name': cat_name,
            'count': category_counts.get(f"other_{cat_key}", 0),
            'url': f"/html/{cat_key}/"
        })
    
    return jsonify({
        'status': 'success',
        'data': categories
    })

@app.route('/api/movies/<category_type>/<category>', methods=['GET'])
def get_movies_by_category(category_type, category):
    """Get movies by category type and ID"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    sort = request.args.get('sort', 'publish')  # publish, year, rating
    
    # Validate
    per_page = min(max(per_page, 1), 100)
    
    # Sort options
    sort_options = {
        'publish': 'publish_date DESC, id DESC',
        'year': 'publish_date DESC, year DESC',
        'imdb': 'publish_date DESC, CAST(SUBSTR(imdb_rating, 1, 3) AS REAL) DESC',
        'douban': 'publish_date DESC, CAST(douban_rating AS REAL) DESC'
    }
    order_by = sort_options.get(sort, sort_options['publish'])
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get total count
    cursor.execute('''
        SELECT COUNT(*) as total 
        FROM movies 
        WHERE category_type = ? AND category = ?
    ''', (category_type, category))
    total = cursor.fetchone()['total']
    total_pages = (total + per_page - 1) // per_page
    
    # Get movies
    offset = (page - 1) * per_page
    cursor.execute(f'''
        SELECT * FROM movies 
        WHERE category_type = ? AND category = ?
        ORDER BY {order_by}
        LIMIT ? OFFSET ?
    ''', (category_type, category, per_page, offset))
    
    movies = []
    for row in cursor.fetchall():
        movies.append(parse_movie_row(row))
    
    conn.close()
    
    # Get category name
    category_name = ''
    if category_type == 'movie':
        category_name = MOVIE_CATEGORIES.get(category, category)
    elif category_type == 'other':
        category_name = OTHER_CATEGORIES.get(category, category)
    
    return jsonify({
        'status': 'success',
        'data': {
            'category_type': category_type,
            'category': category,
            'category_name': category_name,
            'movies': movies,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_movies': total,
                'per_page': per_page,
                'has_next': page < total_pages,
                'has_prev': page > 1
            },
            'sort': sort
        }
    })

@app.route('/api/movie/<movie_id>', methods=['GET'])
def get_movie_detail(movie_id):
    """Get single movie detail"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM movies WHERE id = ?', (movie_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({
            'status': 'error',
            'message': 'Movie not found'
        }), 404
    
    movie = parse_movie_row(row)
    
    # Get related movies
    cursor.execute('''
        SELECT * FROM movies 
        WHERE category_type = ? AND category = ? AND id != ?
        ORDER BY publish_date DESC, RANDOM()
        LIMIT 8
    ''', (row['category_type'], row['category'], movie_id))
    
    related = []
    for related_row in cursor.fetchall():
        related.append(parse_movie_row(related_row))
    
    conn.close()
    
    movie['related_movies'] = related
    
    return jsonify({
        'status': 'success',
        'data': movie
    })




@app.route('/api/search', methods=['GET'])
def search_movies():
    """Search movies"""
    keyword = request.args.get('keyword', '').strip()
    category_type = request.args.get('type', '')  # movie, other, or empty for all
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 30, type=int)
    
    if not keyword:
        return jsonify({
            'status': 'error',
            'message': 'Keyword is required'
        }), 400
    
    per_page = min(max(per_page, 1), 100)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Build query
    search_pattern = f'%{keyword}%'
    
    # Build search query with proper parameter placeholders
    search_conditions = "(title LIKE ? OR translated_name LIKE ? OR original_name LIKE ? OR director LIKE ? OR \"cast\" LIKE ? OR synopsis LIKE ? OR genre LIKE ? OR country LIKE ?)"
    
    # Set up parameters for the search
    params = [search_pattern] * 8
    
    # Build complete WHERE clause
    if category_type:
        query_count = 'SELECT COUNT(*) as total FROM movies WHERE ' + search_conditions + ' AND category_type = ?'
        query_select = 'SELECT * FROM movies WHERE ' + search_conditions + ' AND category_type = ? ORDER BY publish_date DESC LIMIT ? OFFSET ?'
        params.append(category_type)
    else:
        query_count = 'SELECT COUNT(*) as total FROM movies WHERE ' + search_conditions
        query_select = 'SELECT * FROM movies WHERE ' + search_conditions + ' ORDER BY publish_date DESC LIMIT ? OFFSET ?'
    
    # Get total
    cursor.execute(query_count, params)
    total = cursor.fetchone()['total']
    total_pages = (total + per_page - 1) // per_page
    
    # Get results
    offset = (page - 1) * per_page
    # Rebuild params for the select query (need to add limit and offset)
    select_params = [search_pattern] * 8
    if category_type:
        select_params.append(category_type)
    select_params.extend([per_page, offset])
    
    cursor.execute(query_select, select_params)
    
    movies = []
    for row in cursor.fetchall():
        movies.append(parse_movie_row(row))
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'data': {
            'keyword': keyword,
            'category_type': category_type,
            'movies': movies,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_results': total,
                'per_page': per_page,
                'has_next': page < total_pages,
                'has_prev': page > 1
            }
        }
    })

@app.route('/api/latest', methods=['GET'])
def get_latest_movies():
    """Get latest movies"""
    category_type = request.args.get('type', '')  # movie, other, or empty for all
    limit = request.args.get('limit', 30, type=int)
    
    limit = min(max(limit, 1), 100)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if category_type:
        cursor.execute('''
            SELECT * FROM movies 
            WHERE category_type = ?
            ORDER BY publish_date DESC, id DESC
            LIMIT ?
        ''', (category_type, limit))
    else:
        cursor.execute('''
            SELECT * FROM movies 
            ORDER BY publish_date DESC, id DESC
            LIMIT ?
        ''', (limit,))
    
    movies = []
    for row in cursor.fetchall():
        movies.append(parse_movie_row(row))
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'data': {
            'movies': movies,
            'total': len(movies),
            'category_type': category_type
        }
    })

@app.route('/api/home', methods=['GET'])
def get_home_data():
    """Get home page data"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    sections = []
    
    # Latest releases
    cursor.execute('''
        SELECT * FROM movies 
        ORDER BY publish_date DESC, id DESC
        LIMIT 12
    ''')
    latest_movies = []
    for row in cursor.fetchall():
        latest_movies.append(parse_movie_row(row))
    
    if latest_movies:
        sections.append({
            'title': '最新发布 Latest Releases',
            'type': 'latest',
            'movies': latest_movies
        })
    
    # Popular movie categories
    popular_movie_cats = ['2', '15', '4', '1', '8']  # Action, Crime, Sci-fi, Comedy, Horror
    for cat_id in popular_movie_cats:
        cursor.execute('''
            SELECT * FROM movies 
            WHERE category_type = 'movie' AND category = ?
            ORDER BY 
                publish_date DESC,
                CASE 
                    WHEN imdb_rating IS NOT NULL AND imdb_rating != '' 
                    THEN CAST(SUBSTR(imdb_rating, 1, 3) AS REAL) 
                    ELSE 0 
                END DESC
            LIMIT 12
        ''', (cat_id,))
        
        cat_movies = []
        for row in cursor.fetchall():
            cat_movies.append(parse_movie_row(row))
        
        if cat_movies:
            sections.append({
                'title': f"{MOVIE_CATEGORIES.get(cat_id, 'Movies')}",
                'type': 'movie',
                'category': cat_id,
                'movies': cat_movies
            })
    
    
    # Statistics
    cursor.execute('''
        SELECT 
            COUNT(*) as total_movies,
            COUNT(DISTINCT category) as total_categories,
            COUNT(CASE WHEN category_type = 'movie' THEN 1 END) as total_movies_type,
            COUNT(CASE WHEN imdb_rating IS NOT NULL AND imdb_rating != '' THEN 1 END) as with_imdb,
            COUNT(CASE WHEN douban_rating IS NOT NULL AND douban_rating != '' THEN 1 END) as with_douban
        FROM movies
    ''')
    stats = dict(cursor.fetchone())
    
    conn.close()
    
    # Pick featured movie
    featured = None
    if latest_movies:
        # Prefer movie with poster and good rating
        for movie in latest_movies:
            if movie.get('poster') and movie.get('synopsis'):
                if movie.get('imdb_rating') or movie.get('douban_rating'):
                    featured = movie
                    break
        if not featured:
            featured = latest_movies[0]
    
    return jsonify({
        'status': 'success',
        'data': {
            'featured_movie': featured,
            'sections': sections,
            'statistics': stats
        }
    })

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """Get database statistics"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Overall stats
    cursor.execute('''
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT category) as categories,
            COUNT(DISTINCT year) as years,
            MIN(year) as min_year,
            MAX(year) as max_year
        FROM movies
    ''')
    overall = dict(cursor.fetchone())
    
    # By type
    cursor.execute('''
        SELECT category_type, COUNT(*) as count 
        FROM movies 
        GROUP BY category_type
    ''')
    by_type = []
    for row in cursor.fetchall():
        by_type.append(dict(row))
    
    
    # Top categories
    cursor.execute('''
        SELECT category, category_type, COUNT(*) as count 
        FROM movies 
        GROUP BY category, category_type
        ORDER BY count DESC
        LIMIT 10
    ''')
    top_categories = []
    for row in cursor.fetchall():
        item = dict(row)
        # Add category name
        if item['category_type'] == 'movie':
            item['name'] = MOVIE_CATEGORIES.get(item['category'], item['category'])
        else:
            item['name'] = OTHER_CATEGORIES.get(item['category'], item['category'])
        top_categories.append(item)
    
    # Link types
    cursor.execute('''
        SELECT 
            type, 
            COUNT(DISTINCT movie_id) as movies,
            COUNT(*) as total_links
        FROM download_links 
        GROUP BY type
    ''')
    link_types = []
    for row in cursor.fetchall():
        link_types.append(dict(row))
    
    conn.close()
    
    return jsonify({
        'status': 'success',
        'data': {
            'overall': overall,
            'by_type': by_type,
            'top_categories': top_categories,
            'link_types': link_types,
            'database': {
                'path': DB_PATH,
                'size_mb': round(os.path.getsize(DB_PATH) / (1024 * 1024), 2) if os.path.exists(DB_PATH) else 0
            }
        }
    })

@app.route('/', methods=['GET'])
def home():
    """API documentation"""
    db_exists = os.path.exists(DB_PATH)
    
    return jsonify({
        'name': 'DYTT8899 Movie API',
        'version': '2.0',
        'description': 'RESTful API for DYTT8899 movie database',
        'database': {
            'exists': db_exists,
            'path': DB_PATH
        },
        'endpoints': {
            'categories': {
                'url': '/api/categories',
                'description': 'Get all categories with movie counts'
            },
            'movies_by_category': {
                'url': '/api/movies/<category_type>/<category>',
                'description': 'Get movies by category',
                'parameters': {
                    'category_type': 'movie or other',
                    'category': 'Category ID',
                    'page': 'Page number (default: 1)',
                    'per_page': 'Items per page (default: 30, max: 100)',
                    'sort': 'Sort by: publish, year, imdb, douban'
                },
                'example': '/api/movies/movie/15?page=1&sort=imdb'
            },
            'movie_detail': {
                'url': '/api/movie/<movie_id>',
                'description': 'Get single movie details',
                'example': '/api/movie/115485'
            },
            'search': {
                'url': '/api/search',
                'description': 'Search movies',
                'parameters': {
                    'keyword': 'Search keyword (required)',
                    'type': 'Filter by type: movie, other',
                    'page': 'Page number',
                    'per_page': 'Results per page'
                }
            },
            'latest': {
                'url': '/api/latest',
                'description': 'Get latest movies',
                'parameters': {
                    'type': 'Filter by type: movie, other',
                    'limit': 'Number of results (max: 100)'
                }
            },
            'home': {
                'url': '/api/home',
                'description': 'Get home page data with multiple sections'
            },
            'stats': {
                'url': '/api/stats',
                'description': 'Get detailed database statistics'
            }
        }
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
    if not os.path.exists(DB_PATH):
        logger.warning(f"Database not found at {DB_PATH}")
        logger.warning("Please run tiantang.py to create the database")
    else:
        logger.info(f"Using database at {DB_PATH}")
        
        # Show some stats and check table structure
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Show basic stats
            cursor.execute('SELECT COUNT(*) as total FROM movies')
            total = cursor.fetchone()['total']
            logger.info(f"Database contains {total} movies")
            
            conn.close()
        except Exception as e:
            logger.error(f"Error checking database: {e}")
    
    app.run(debug=False, port=8080, host='0.0.0.0')