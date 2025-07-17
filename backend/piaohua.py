import requests
from bs4 import BeautifulSoup
from google import genai
from pydantic import BaseModel, Field
from typing import List, Optional
import sqlite3
import json
import logging
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import threading
import os
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pydantic models for structured output (for Gemini)
class DownloadLink(BaseModel):
    quality: str
    link: str
    type: str  # 'magnet', 'ftp', or 'http'

class MovieDetail(BaseModel):
    title: str
    full_title: Optional[str] = None
    poster: Optional[str] = None
    poster_hd: Optional[str] = None
    year: Optional[str] = None
    country: Optional[str] = None
    genre: Optional[str] = None
    language: Optional[str] = None
    subtitles: Optional[str] = None
    director: Optional[str] = None
    cast: Optional[List[str]] = Field(default_factory=list)
    synopsis: Optional[str] = None
    duration: Optional[str] = None
    file_size: Optional[str] = None
    resolution: Optional[str] = None
    format: Optional[str] = None
    release_date: Optional[str] = None
    imdb_rating: Optional[str] = None
    screenshots: Optional[List[str]] = Field(default_factory=list)
    download_links: List[DownloadLink] = Field(default_factory=list)
    publish_date: Optional[str] = None

class PiaohuaGeminiScraper:
    """
    分阶段飘花电影抓取器:
    阶段1: 收集所有category的movie list并保存到JSON文件
    阶段2: 逐个处理category，获取详细信息并保存到数据库
    """
    def __init__(self, db_path='piaohua_movies.db', gemini_api_key=None, data_dir='scrape_data'):
        self.db_path = db_path
        self.data_dir = data_dir
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # Initialize Gemini client for detail page parsing only
        self.gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None
        self.init_database()
        self.db_lock = threading.Lock()
        
        # Create data directory for intermediate files
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Categories mapping
        self.categories = {
            'action': 'dongzuo',
            'comedy': 'xiju',
            'romance': 'aiqing',
            'scifi': 'kehuan',
            'drama': 'juqing',
            'suspense': 'xuannian',
            'war': 'zhanzheng',
            'horror': 'kongbu',
            'disaster': 'zainan',
            'series': 'lianxuju',
            'anime': 'dongman',
            'variety': 'zongyijiemu',
            'anime_series': 'lianzaidongman'
        }
    
    def init_database(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
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
                screenshots TEXT,
                imdb_rating TEXT,
                raw_data TEXT
            )
        ''')
        
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
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_download_links_movie_id ON download_links (movie_id)')
        
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")
    
    def get_soup(self, url):
        """Fetch URL and return BeautifulSoup object"""
        try:
            response = self.session.get(url, timeout=30)
            response.encoding = 'utf-8'
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None
    
    def get_html(self, url):
        """Fetch raw HTML content from URL"""
        try:
            response = self.session.get(url, timeout=30)
            response.encoding = 'utf-8'
            return response.text
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None
    
    def parse_movie_list(self, soup, base_url):
        """Parse movie list page using BeautifulSoup"""
        movies = []
        
        # Parse movie items
        movie_list = soup.find('ul', class_='ul-imgtxt2 row')
        if movie_list:
            items = movie_list.find_all('li', class_='col-md-6')
            for item in items:
                try:
                    movie = {}
                    
                    # Get image and link
                    pic_div = item.find('div', class_='pic')
                    if pic_div and pic_div.find('a'):
                        link = pic_div.find('a')['href']
                        movie['link'] = urljoin(base_url, link)
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
                    
                    if 'id' in movie and 'title' in movie:
                        movies.append(movie)
                        
                except Exception as e:
                    logger.error(f"Error parsing movie item: {str(e)}")
                    continue
        
        # Get total pages
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
        
        return movies, total_pages
    
    def collect_category_movie_list(self, category, max_pages=None):
        """收集指定分类的电影列表（不获取详细信息）"""
        if category not in self.categories:
            logger.error(f"Unknown category: {category}")
            return []
        
        category_path = self.categories[category]
        base_url = "https://www.piaohua.com"
        
        logger.info(f"收集电影分类列表: {category}")
        
        all_movies = []
        page = 1
        total_pages = 1
        
        while page <= total_pages:
            if page == 1:
                url = f"{base_url}/html/{category_path}/index.html"
            else:
                url = f"{base_url}/html/{category_path}/list_{page}.html"
            
            logger.info(f"收集 {category} 第 {page}/{total_pages} 页")
            
            soup = self.get_soup(url)
            if not soup:
                break
            
            # Parse with BeautifulSoup (much faster and no API cost)
            movies, pages_count = self.parse_movie_list(soup, base_url)
            
            if page == 1:
                total_pages = pages_count
                if max_pages:
                    total_pages = min(total_pages, max_pages)
                logger.info(f"分类 {category} 共有 {total_pages} 页")
            
            for movie in movies:
                movie['category'] = category
                all_movies.append(movie)
            
            page += 1
            if max_pages and page > max_pages:
                break
            time.sleep(1)  # Rate limiting
        
        logger.info(f"分类 {category} 收集到 {len(all_movies)} 部电影")
        return all_movies
    
    def save_movie_lists_to_file(self, movie_lists):
        """将电影列表保存到JSON文件"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"piaohua_movie_lists_{timestamp}.json"
        filepath = os.path.join(self.data_dir, filename)
        
        # 添加元数据
        data = {
            'timestamp': timestamp,
            'total_categories': len(movie_lists),
            'total_movies': sum(len(movies) for movies in movie_lists.values()),
            'categories': movie_lists
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"电影列表已保存到: {filepath}")
        logger.info(f"总分类数: {data['total_categories']}, 总电影数: {data['total_movies']}")
        
        return filepath
    
    def load_movie_lists_from_file(self, filepath):
        """从JSON文件加载电影列表"""
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logger.info(f"从文件加载电影列表: {filepath}")
        logger.info(f"数据时间戳: {data['timestamp']}")
        logger.info(f"总分类数: {data['total_categories']}, 总电影数: {data['total_movies']}")
        
        return data['categories']
    
    def stage1_collect_all_movie_lists(self, max_pages=None, categories=None):
        """阶段1: 收集所有分类的电影列表"""
        logger.info("=== 阶段1: 收集所有电影分类列表 ===")
        
        if categories is None:
            categories = list(self.categories.keys())
        
        all_movie_lists = {}
        
        for category in categories:
            try:
                movie_list = self.collect_category_movie_list(category, max_pages)
                if movie_list:
                    all_movie_lists[category] = movie_list
                time.sleep(2)  # 分类间延迟
            except Exception as e:
                logger.error(f"收集分类 {category} 失败: {str(e)}")
                continue
        
        # 保存到文件
        filepath = self.save_movie_lists_to_file(all_movie_lists)
        
        logger.info("=== 阶段1 完成 ===")
        return filepath
    
    def parse_movie_detail_with_gemini(self, html_content):
        """Use Gemini to parse movie detail page"""
        if not self.gemini_client:
            logger.error("Gemini client not initialized")
            return None
        
        prompt = """
        Parse the following HTML content from a movie detail page and extract all movie information.
        
        Extract:
        - Basic info: title, full title, publish date
        - Movie details: Look for lines starting with ◎ and extract year, country, genre, language, 
          subtitles, director, cast (can be multiple lines), synopsis, duration, file size, 
          resolution, format, release date, IMDb rating
        - Images: poster (first image) and screenshots (subsequent images)
        - Download links: Extract all download links including magnet links, FTP links, etc.
          For magnet links, check both in <a> tags and in text content
        
        Be thorough in extracting cast members which may span multiple lines after ◎主演.
        
        HTML content:
        """ + html_content
        
        try:
            response = self.gemini_client.models.generate_content(
                model="gemini-2.5-flash-lite-preview-06-17",
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_schema": MovieDetail,
                    "temperature": 0.1,
                }
            )
            return response.parsed
        except Exception as e:
            logger.error(f"Gemini detail parsing error: {str(e)}")
            return None
    
    def enrich_movie_details(self, movie, max_retries: int = 2):
        """Fetch and parse detailed movie information with retry on Gemini errors"""
        if 'link' not in movie:
            return movie
        
        logger.debug(f"获取详细信息: {movie['title']} - {movie['link']}")
        
        try:
            html = self.get_html(movie['link'])
            if not html:
                return movie
            time.sleep(1)
        except Exception as e:
            logger.error(f"获取详细信息失败: {str(e)}")
            return movie
        
        # Gemini 解析重试
        for attempt in range(max_retries + 1):
            details = self.parse_movie_detail_with_gemini(html)
            if details:
                detail_dict = details.model_dump()
                movie['movie_url'] = movie['link']
                for key, value in detail_dict.items():
                    if value is not None and (value != [] if isinstance(value, list) else True):
                        movie[key] = value
                if movie.get('download_links'):
                    break
            if attempt < max_retries:
                logger.warning(f"Gemini 解析失败或无下载链接，重试 {attempt + 1}/{max_retries} - {movie.get('title')}")
                time.sleep(2 + attempt)
        
        return movie
    
    def save_movies_to_db(self, movies):
        """Save movies to database"""
        saved_count = 0
        updated_count = 0
        skipped_count = 0
        
        with self.db_lock:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            for movie in movies:
                try:
                    # Skip if no download links (same logic as tiantang.py)
                    download_links = movie.get('download_links', [])
                    if not download_links:
                        logger.debug(f"跳过电影 '{movie.get('title', 'Unknown')}' - 无下载链接")
                        skipped_count += 1
                        continue
                    
                    movie_id = movie.get('id', '')
                    movie_title = movie.get('title', 'Unknown')
                    
                    # Check if movie already exists
                    cursor.execute('SELECT id, title, scrape_date FROM movies WHERE id = ?', (movie_id,))
                    existing_movie = cursor.fetchone()
                    
                    if existing_movie:
                        logger.debug(f"电影已存在: '{movie_title}' (ID: {movie_id})")
                        is_update = True
                        updated_count += 1
                    else:
                        logger.debug(f"添加新电影: '{movie_title}' (ID: {movie_id})")
                        is_update = False
                        saved_count += 1
                    
                    # Prepare data
                    cast_str = json.dumps(movie.get('cast', []), ensure_ascii=False) if isinstance(movie.get('cast'), list) else movie.get('cast', '')
                    screenshots_str = json.dumps(movie.get('screenshots', []), ensure_ascii=False) if movie.get('screenshots') else None
                    
                    # Insert or update movie
                    if is_update:
                        cursor.execute('''
                            UPDATE movies SET 
                                title = ?, full_title = ?, poster = ?, poster_hd = ?, category = ?,
                                year = ?, country = ?, genre = ?, language = ?, subtitles = ?, director = ?,
                                cast = ?, synopsis = ?, duration = ?, file_size = ?, resolution = ?, format = ?,
                                release_date = ?, update_date = ?, publish_date = ?, movie_url = ?, screenshots = ?,
                                imdb_rating = ?, raw_data = ?
                            WHERE id = ?
                        ''', (
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
                            cast_str,
                            movie.get('synopsis', ''),
                            movie.get('duration', ''),
                            movie.get('file_size', ''),
                            movie.get('resolution', ''),
                            movie.get('format', ''),
                            movie.get('release_date', ''),
                            movie.get('update_date', ''),
                            movie.get('publish_date', ''),
                            movie.get('movie_url', ''),
                            screenshots_str,
                            movie.get('imdb_rating', ''),
                            json.dumps(movie, ensure_ascii=False),
                            movie_id
                        ))
                    else:
                        cursor.execute('''
                            INSERT INTO movies (
                                id, title, full_title, poster, poster_hd, category,
                                year, country, genre, language, subtitles, director,
                                cast, synopsis, duration, file_size, resolution, format,
                                release_date, update_date, publish_date, movie_url, screenshots,
                                imdb_rating, raw_data
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            movie_id,
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
                            cast_str,
                            movie.get('synopsis', ''),
                            movie.get('duration', ''),
                            movie.get('file_size', ''),
                            movie.get('resolution', ''),
                            movie.get('format', ''),
                            movie.get('release_date', ''),
                            movie.get('update_date', ''),
                            movie.get('publish_date', ''),
                            movie.get('movie_url', ''),
                            screenshots_str,
                            movie.get('imdb_rating', ''),
                            json.dumps(movie, ensure_ascii=False)
                        ))
                    
                    # Delete old download links
                    cursor.execute('DELETE FROM download_links WHERE movie_id = ?', (movie_id,))
                    
                    # Process download links
                    for link in download_links:
                        cursor.execute('''
                            INSERT INTO download_links (movie_id, quality, link, type)
                            VALUES (?, ?, ?, ?)
                        ''', (
                            movie_id,
                            link.get('quality', ''),
                            link.get('link', ''),
                            link.get('type', '')
                        ))
                    
                except Exception as e:
                    logger.error(f"保存电影失败 {movie.get('title', 'Unknown')}: {str(e)}")
                    skipped_count += 1
            
            conn.commit()
            conn.close()
        
        logger.info(f"数据库操作完成: {saved_count} 新电影, {updated_count} 更新电影, {skipped_count} 跳过电影")
        return saved_count
    
    def save_category_progress(self, category, processed_count, total_count):
        """保存分类处理进度"""
        progress_file = os.path.join(self.data_dir, f'piaohua_progress_{category}.json')
        progress_data = {
            'category': category,
            'processed_count': processed_count,
            'total_count': total_count,
            'timestamp': datetime.now().isoformat(),
            'percentage': (processed_count / total_count) * 100 if total_count > 0 else 0
        }
        
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress_data, f, ensure_ascii=False, indent=2)
    
    def load_category_progress(self, category):
        """加载分类处理进度"""
        progress_file = os.path.join(self.data_dir, f'piaohua_progress_{category}.json')
        if os.path.exists(progress_file):
            with open(progress_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def stage2_process_category(self, category, movie_list, max_workers=2, resume=True):
        """阶段2: 处理单个分类的电影详细信息"""
        # 检查是否需要断点续传
        start_index = 0
        if resume:
            progress = self.load_category_progress(category)
            if progress:
                start_index = progress['processed_count']
                logger.info(f"断点续传: 分类 {category} 从第 {start_index} 个电影开始处理")
        
        total_count = len(movie_list)
        logger.info(f"=== 处理分类: {category} ({start_index}/{total_count}) ===")
        
        # 处理电影列表
        processed_movies = []
        batch_size = 10  # 每批次处理的数量
        
        for i in range(start_index, total_count, batch_size):
            batch_movies = movie_list[i:i+batch_size]
            logger.info(f"处理批次: {i+1}-{min(i+batch_size, total_count)}/{total_count}")
            
            # 使用线程池获取详细信息
            enriched_movies = []
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_movie = {
                    executor.submit(self.enrich_movie_details, movie): movie
                    for movie in batch_movies
                }
                
                for future in as_completed(future_to_movie):
                    try:
                        enriched_movie = future.result()
                        if enriched_movie:
                            enriched_movies.append(enriched_movie)
                    except Exception as e:
                        logger.error(f"处理电影详细信息失败: {str(e)}")
            
            # 保存到数据库
            if enriched_movies:
                saved_count = self.save_movies_to_db(enriched_movies)
                processed_movies.extend(enriched_movies)
            
            # 更新进度
            current_processed = min(i + batch_size, total_count)
            self.save_category_progress(category, current_processed, total_count)
            
            logger.info(f"分类 {category} 进度: {current_processed}/{total_count} ({(current_processed/total_count)*100:.1f}%)")
            
            # 批次间休息
            time.sleep(3)
        
        logger.info(f"=== 分类 {category} 处理完成，共处理 {len(processed_movies)} 部电影 ===")
        return len(processed_movies)
    
    def stage2_process_from_file(self, filepath, categories=None, max_workers=2, resume=True):
        """阶段2: 从文件加载并处理所有分类"""
        logger.info("=== 阶段2: 处理电影详细信息 ===")
        
        # 加载电影列表
        movie_lists = self.load_movie_lists_from_file(filepath)
        
        if categories is None:
            categories = list(movie_lists.keys())
        
        total_processed = 0
        results = {}
        
        for category in categories:
            if category not in movie_lists:
                logger.warning(f"分类 {category} 不存在于文件中")
                continue
            
            try:
                movie_list = movie_lists[category]
                processed_count = self.stage2_process_category(
                    category, movie_list, max_workers, resume
                )
                results[category] = processed_count
                total_processed += processed_count
                
                # 分类间休息
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"处理分类 {category} 失败: {str(e)}")
                results[category] = 0
        
        # 输出总结
        logger.info(f"\n{'='*60}")
        logger.info(f"阶段2 处理完成!")
        logger.info(f"总共处理电影: {total_processed}")
        logger.info(f"数据库文件: {self.db_path}")
        logger.info(f"\n各分类处理结果:")
        for category, count in results.items():
            logger.info(f"  {category}: {count} 部电影")
        logger.info(f"{'='*60}")
        
        return total_processed
    
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
        
        # Movies with different link types
        cursor.execute('''
            SELECT type, COUNT(DISTINCT movie_id) 
            FROM download_links 
            GROUP BY type
        ''')
        link_stats = cursor.fetchall()
        
        conn.close()
        
        print(f"\n数据库统计:")
        print(f"总电影数: {total_movies}")
        print(f"\n各分类电影数:")
        for category, count in category_stats:
            print(f"  {category}: {count}")
        print(f"\n下载链接类型:")
        for link_type, count in link_stats:
            print(f"  {link_type}: {count} 部电影")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='飘花分阶段电影抓取器')
    parser.add_argument('--gemini-key', help='Gemini API key (或设置 GEMINI_API_KEY 环境变量)')
    parser.add_argument('--db', default='piaohua_movies.db', help='数据库文件路径')
    parser.add_argument('--data-dir', default='scrape_data', help='中间数据文件目录')
    parser.add_argument('--max-pages', type=int, help='每个分类最大页数 (用于测试)')
    parser.add_argument('--max-workers', type=int, default=2, help='最大并发工作线程数')
    parser.add_argument('--categories', nargs='+', help='指定要处理的分类列表')
    
    # 阶段选择
    parser.add_argument('--stage1', action='store_true', help='只执行阶段1: 收集电影列表')
    parser.add_argument('--stage2', help='只执行阶段2: 从文件处理电影详情 (需要提供文件路径)')
    parser.add_argument('--no-resume', action='store_true', help='不使用断点续传')
    parser.add_argument('--stats-only', action='store_true', help='只显示统计信息')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.gemini_key or os.getenv('GEMINI_API_KEY', "AIzaSyCi7WClyjlR7SMm2Br_reit6RVTEU0dmXI")
    
    # 检查API key
    if not api_key and not args.stats_only:
        print("请通过 --gemini-key 参数或 GEMINI_API_KEY 环境变量提供 Gemini API key")
        exit(1)
    
    # 创建抓取器
    scraper = PiaohuaGeminiScraper(
        db_path=args.db, 
        gemini_api_key=api_key,
        data_dir=args.data_dir
    )
    
    if args.stats_only:
        scraper.get_stats()
    elif args.stage1:
        # 只执行阶段1
        filepath = scraper.stage1_collect_all_movie_lists(
            max_pages=args.max_pages,
            categories=args.categories
        )
        print(f"\n阶段1完成！电影列表已保存到: {filepath}")
        print(f"下一步请使用: python {__file__} --stage2 {filepath}")
    elif args.stage2:
        # 只执行阶段2
        total_processed = scraper.stage2_process_from_file(
            args.stage2,
            categories=args.categories,
            max_workers=args.max_workers,
            resume=not args.no_resume
        )
        scraper.get_stats()
    else:
        # 默认: 执行完整的两阶段流程
        print("开始完整的两阶段抓取流程...")
        
        # 阶段1
        filepath = scraper.stage1_collect_all_movie_lists(
            max_pages=args.max_pages,
            categories=args.categories
        )
        
        # 阶段2
        total_processed = scraper.stage2_process_from_file(
            filepath,
            categories=args.categories,
            max_workers=args.max_workers,
            resume=not args.no_resume
        )
        
        # 最终统计
        scraper.get_stats()

# 使用示例:
# 
# 1. 只收集电影列表 (阶段1):
#    python piaohua.py --stage1 --max-pages 2
#
# 2. 处理已收集的电影列表 (阶段2):
#    python piaohua.py --stage2 scrape_data/piaohua_movie_lists_20231201_143022.json
#
# 3. 完整流程 (测试模式):
#    python piaohua.py --max-pages 1 --max-workers 2
#
# 4. 只处理特定分类:
#    python piaohua.py --stage1 --categories action comedy scifi
#    python piaohua.py --stage2 scrape_data/piaohua_movie_lists_xxx.json --categories action comedy
#
# 5. 查看统计信息:
#    python piaohua.py --stats-only