import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import urljoin
import sqlite3
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from datetime import datetime
import os
import threading

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('piaohua_scraper.log'),
        logging.StreamHandler()
    ]
)
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

class PiaohuaScraper:
    def __init__(self, db_path='piaohua_movies.db'):
        self.db_path = db_path
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.init_database()
        # Thread lock for database writes
        self.db_lock = threading.Lock()
        
    def init_database(self):
        """Initialize SQLite database with tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create movies table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS movies (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                full_title TEXT,
                poster TEXT,
                poster_hd TEXT,
                category TEXT,
                year TEXT,
                country TEXT,
                genre TEXT,
                language TEXT,
                subtitles TEXT,
                director TEXT,
                cast TEXT,
                synopsis TEXT,
                duration TEXT,
                file_size TEXT,
                resolution TEXT,
                format TEXT,
                release_date TEXT,
                update_date TEXT,
                publish_date TEXT,
                scrape_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                movie_url TEXT,
                raw_data TEXT
            )
        ''')
        
        # Create download_links table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS download_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                movie_id TEXT NOT NULL,
                quality TEXT,
                link TEXT NOT NULL,
                type TEXT,
                FOREIGN KEY (movie_id) REFERENCES movies (id)
            )
        ''')
        
        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_movies_category ON movies (category)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_movies_year ON movies (year)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_download_movie_id ON download_links (movie_id)')
        
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")

    def get_soup(self, url, timeout=10):
        """Helper function to get BeautifulSoup object from URL"""
        try:
            response = self.session.get(url, timeout=timeout)
            response.encoding = 'utf-8'
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None

    def extract_movie_details(self, movie_url):
        """Extract full movie details including download links"""
        if not movie_url.startswith('http'):
            movie_url = urljoin(BASE_URL, movie_url)
        
        soup = self.get_soup(movie_url, timeout=8)
        if not soup:
            return {}
        
        movie_detail = {'movie_url': movie_url}
        
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

    def parse_movie_list_item(self, item):
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

    def get_category_pages(self, category):
        """Get total pages for a category"""
        if category not in CATEGORIES:
            return 0
        
        category_path = CATEGORIES[category]
        url = f"{BASE_URL}/html/{category_path}/index.html"
        
        soup = self.get_soup(url)
        if not soup:
            return 0
        
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
        
        logger.info(f"Category {category} has {total_pages} pages")
        return total_pages

    def scrape_category(self, category):
        """Scrape all movies from a category"""
        total_pages = self.get_category_pages(category)
        if total_pages == 0:
            logger.error(f"Failed to get pages for category {category}")
            return []
        
        all_movies = []
        category_path = CATEGORIES[category]
        
        for page in range(1, total_pages + 1):
            logger.info(f"Scraping {category} page {page}/{total_pages}")
            
            if page == 1:
                url = f"{BASE_URL}/html/{category_path}/index.html"
            else:
                url = f"{BASE_URL}/html/{category_path}/list_{page}.html"
            
            soup = self.get_soup(url)
            if not soup:
                continue
            
            # Parse basic movie info
            movie_list = soup.find('ul', class_='ul-imgtxt2 row')
            if movie_list:
                items = movie_list.find_all('li', class_='col-md-6')
                for item in items:
                    movie = self.parse_movie_list_item(item)
                    if movie:
                        movie['category'] = category
                        all_movies.append(movie)
            
            # Add delay to avoid being blocked
            time.sleep(1)
        
        logger.info(f"Found {len(all_movies)} movies in category {category}")
        return all_movies

    def enrich_movies_with_details(self, movies):
        """Fetch details for all movies in parallel"""
        enriched_movies = []
        
        # Create a future for each movie
        future_to_movie = {}
        for movie in movies:
            if movie and 'relative_link' in movie:
                future = executor.submit(self.extract_movie_details, movie['relative_link'])
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

    def save_movies_to_db(self, movies):
        """Save movies to SQLite database (thread-safe)"""
        saved_count = 0
        
        # Use lock to ensure thread-safe database writes
        with self.db_lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for movie in movies:
                try:
                    # Check if movie has magnet links
                    download_links = movie.get('download_links', [])
                    has_magnet = any(link.get('type') == 'magnet' for link in download_links)
                    
                    if not has_magnet:
                        logger.debug(f"Skipping movie '{movie.get('title', 'Unknown')}' - no magnet links")
                        continue
                    
                    # Prepare movie data
                    movie_data = (
                        movie.get('id', ''),
                        movie.get('title', ''),
                        movie.get('full_title', ''),
                        movie.get('poster', ''),
                        movie.get('poster_hd', ''),
                        movie.get('category', ''),
                        movie.get('year', ''),
                        movie.get('country', ''),
                        movie.get('genre', ''),
                        movie.get('language', ''),
                        movie.get('subtitles', ''),
                        movie.get('director', ''),
                        json.dumps(movie.get('cast_list', []), ensure_ascii=False) if movie.get('cast_list') else movie.get('cast', ''),
                        movie.get('synopsis', ''),
                        movie.get('duration', ''),
                        movie.get('file_size', ''),
                        movie.get('resolution', ''),
                        movie.get('format', ''),
                        movie.get('release_date', ''),
                        movie.get('update_date', ''),
                        movie.get('publish_date', ''),
                        movie.get('movie_url', ''),
                        json.dumps(movie, ensure_ascii=False)  # Store raw data as JSON
                    )
                    
                    # Insert or replace movie
                    cursor.execute('''
                        INSERT OR REPLACE INTO movies (
                            id, title, full_title, poster, poster_hd, category,
                            year, country, genre, language, subtitles, director,
                            cast, synopsis, duration, file_size, resolution, format,
                            release_date, update_date, publish_date, movie_url, raw_data
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', movie_data)
                    
                    # Delete existing download links for this movie
                    cursor.execute('DELETE FROM download_links WHERE movie_id = ?', (movie.get('id', ''),))
                    
                    # Insert download links
                    for link in download_links:
                        cursor.execute('''
                            INSERT INTO download_links (movie_id, quality, link, type)
                            VALUES (?, ?, ?, ?)
                        ''', (
                            movie.get('id', ''),
                            link.get('quality', ''),
                            link.get('link', ''),
                            link.get('type', '')
                        ))
                    
                    saved_count += 1
                    
                except Exception as e:
                    logger.error(f"Error saving movie {movie.get('title', 'Unknown')}: {str(e)}")
            
            conn.commit()
            conn.close()
            
        logger.info(f"Saved {saved_count} movies to database")
        return saved_count

    def scrape_category_complete(self, category_key):
        """Complete scraping process for a single category"""
        try:
            logger.info(f"Starting scrape for category: {category_key}")
            
            # Get basic movie info
            movies = self.scrape_category(category_key)
            
            if movies:
                # Enrich with details
                logger.info(f"Fetching detailed information for {len(movies)} movies in {category_key}...")
                enriched_movies = self.enrich_movies_with_details(movies)
                
                # Save to database
                saved = self.save_movies_to_db(enriched_movies)
                logger.info(f"Category {category_key} complete: {saved} movies saved")
                return saved
            else:
                logger.info(f"No movies found in category {category_key}")
                return 0
                
        except Exception as e:
            logger.error(f"Error scraping category {category_key}: {str(e)}")
            return 0
    
    def scrape_all(self, max_category_workers=3):
        """Main function to scrape all categories in parallel"""
        logger.info("Starting complete scrape of Piaohua website")
        logger.info(f"Using {max_category_workers} parallel category workers")
        start_time = time.time()
        
        total_movies_saved = 0
        category_results = {}
        
        # Create a separate executor for category-level parallelism
        with ThreadPoolExecutor(max_workers=max_category_workers) as category_executor:
            # Submit all category scraping tasks
            future_to_category = {
                category_executor.submit(self.scrape_category_complete, category): category
                for category in CATEGORIES.keys()
            }
            
            # Process completed categories
            for future in as_completed(future_to_category):
                category = future_to_category[future]
                try:
                    saved_count = future.result()
                    category_results[category] = saved_count
                    total_movies_saved += saved_count
                    logger.info(f"Category {category} finished with {saved_count} movies")
                except Exception as e:
                    logger.error(f"Category {category} failed: {str(e)}")
                    category_results[category] = 0
        
        elapsed_time = time.time() - start_time
        
        # Print summary
        logger.info(f"\n{'='*50}")
        logger.info(f"Scraping complete!")
        logger.info(f"Total movies saved: {total_movies_saved}")
        logger.info(f"Total time: {elapsed_time/60:.2f} minutes")
        logger.info(f"Database saved to: {self.db_path}")
        logger.info(f"\nResults by category:")
        for category, count in category_results.items():
            logger.info(f"  {category}: {count} movies")
        logger.info(f"{'='*50}")

    def get_stats(self):
        """Get statistics from the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Total movies
        cursor.execute('SELECT COUNT(*) FROM movies')
        total_movies = cursor.fetchone()[0]
        
        # Movies by category
        cursor.execute('SELECT category, COUNT(*) FROM movies GROUP BY category')
        category_stats = cursor.fetchall()
        
        # Movies with magnet links
        cursor.execute('''
            SELECT COUNT(DISTINCT movie_id) 
            FROM download_links 
            WHERE type = 'magnet'
        ''')
        movies_with_magnet = cursor.fetchone()[0]
        
        conn.close()
        
        print(f"\nDatabase Statistics:")
        print(f"Total movies: {total_movies}")
        print(f"Movies with magnet links: {movies_with_magnet}")
        print(f"\nMovies by category:")
        for category, count in category_stats:
            print(f"  {category}: {count}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Piaohua Movie Scraper')
    parser.add_argument('--db', default='piaohua_movies.db', help='Database file path')
    parser.add_argument('--category', help='Scrape specific category only')
    parser.add_argument('--max-category-workers', type=int, default=3, 
                       help='Maximum parallel category workers (default: 3)')
    parser.add_argument('--max-movie-workers', type=int, default=10,
                       help='Maximum parallel movie detail workers (default: 10)')
    parser.add_argument('--stats-only', action='store_true', help='Only show statistics')
    
    args = parser.parse_args()
    
    # Update global executor with specified workers
    executor = ThreadPoolExecutor(max_workers=args.max_movie_workers)
    
    # Create scraper instance
    scraper = PiaohuaScraper(args.db)
    
    if args.stats_only:
        # Just show statistics
        scraper.get_stats()
    elif args.category:
        # Scrape specific category
        logger.info(f"Scraping single category: {args.category}")
        saved = scraper.scrape_category_complete(args.category)
        logger.info(f"Saved {saved} movies from category {args.category}")
        scraper.get_stats()
    else:
        # Scrape all categories
        scraper.scrape_all(max_category_workers=args.max_category_workers)
        
        # Show statistics
        scraper.get_stats()
    
    # Shutdown executor
    executor.shutdown()


# 使用3个并行类别工作线程，10个电影详情工作线程
# python piaohua_scraper.py --max-category-workers 3 --max-movie-workers 7

# 只爬取特定类别
# python piaohua_scraper.py --category action

# 只查看统计信息
# python piaohua_scraper.py --stats-only