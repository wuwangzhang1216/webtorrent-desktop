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

# Pydantic models for Gemini
class DownloadLink(BaseModel):
    quality: str
    link: str
    type: str  # 'magnet', 'ftp', 'http', 'player'


class MovieDetail(BaseModel):
    title: str
    translated_name: Optional[str] = None
    original_name: Optional[str] = None
    year: Optional[str] = None
    country: Optional[str] = None
    genre: Optional[List[str]] = Field(default_factory=list)
    language: Optional[str] = None
    subtitles: Optional[str] = None
    release_date: Optional[str] = None
    imdb_rating: Optional[str] = None
    douban_rating: Optional[str] = None
    file_format: Optional[str] = None
    video_size: Optional[str] = None
    file_size: Optional[str] = None
    duration: Optional[str] = None
    director: Optional[str] = None
    cast: Optional[List[str]] = Field(default_factory=list)
    synopsis: Optional[str] = None
    poster: Optional[str] = None
    screenshots: Optional[List[str]] = Field(default_factory=list)
    download_links: List[DownloadLink] = Field(default_factory=list)  # 下载链接

class DYTT8899Scraper:
    """
    分阶段电影抓取器:
    阶段1: 收集所有category的movie list并保存到JSON文件
    阶段2: 逐个处理category，获取详细信息并保存到数据库
    """
    def __init__(self, db_path='movies.db', gemini_api_key=None, data_dir='scrape_data'):
        self.db_path = db_path
        self.data_dir = data_dir
        self.base_url = 'https://www.dytt8899.com'
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate',
        })
        
        # Initialize Gemini for detail parsing
        self.gemini_client = genai.Client(api_key=gemini_api_key) if gemini_api_key else None
        self.init_database()
        self.db_lock = threading.Lock()
        
        # Create data directory for intermediate files
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Category mappings - 只保留电影分类
        self.movie_categories = {
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
    
    def init_database(self):
        """Initialize SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS movies (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                translated_name TEXT,
                original_name TEXT,
                year TEXT,
                country TEXT,
                genre TEXT,
                language TEXT,
                subtitles TEXT,
                release_date TEXT,
                imdb_rating TEXT,
                douban_rating TEXT,
                file_format TEXT,
                video_size TEXT,
                file_size TEXT,
                duration TEXT,
                director TEXT,
                cast TEXT,
                synopsis TEXT,
                poster TEXT,
                screenshots TEXT,
                category TEXT,
                category_type TEXT,
                publish_date TEXT,
                page_url TEXT,
                scrape_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_movies_category_type ON movies (category_type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_download_links_movie_id ON download_links (movie_id)')
        
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")
    
    def get_soup(self, url, encoding='gb2312'):
        """Get BeautifulSoup object from URL"""
        try:
            response = self.session.get(url, timeout=30)
            response.encoding = encoding
            return BeautifulSoup(response.text, 'html.parser')
        except Exception as e:
            logger.error(f"Error fetching {url}: {str(e)}")
            return None
    
    def parse_movie_list(self, soup):
        """Parse movie list from page using BeautifulSoup"""
        movies = []
        
        # Find all movie tables
        tables = soup.find_all('table', class_='tbspan')
        
        for table in tables:
            try:
                movie = {}
                
                # Find title and link
                title_link = table.find('a', class_='ulink', href=re.compile(r'/i/\d+\.html'))
                if not title_link:
                    continue
                
                movie['title'] = title_link.get('title', '').strip()
                movie['link'] = title_link.get('href', '')
                movie['id'] = re.search(r'/i/(\d+)\.html', movie['link']).group(1)
                
                if movie.get('id'):
                    movies.append(movie)
                    
            except Exception as e:
                logger.error(f"Error parsing movie item: {str(e)}")
                continue
        
        return movies
    
    def get_total_pages(self, soup):
        """Extract total pages from pagination"""
        try:
            # Look for pagination select
            select = soup.find('select', {'name': 'select'})
            if select:
                options = select.find_all('option')
                if options:
                    return len(options)
            
            # Alternative: look for page text
            page_text = soup.find('p', text=re.compile(r'页次：\d+/\d+'))
            if page_text:
                match = re.search(r'页次：\d+/(\d+)', page_text.text)
                if match:
                    return int(match.group(1))
        except:
            pass
        
        return 1
    
    def collect_category_movie_list(self, category_id, max_pages=None):
        """收集指定分类的电影列表（不获取详细信息）"""
        category_name = self.movie_categories.get(category_id, f'Category {category_id}')
        logger.info(f"收集电影分类列表: {category_name} (ID: {category_id})")
        
        all_movies = []
        page = 1
        
        # Get first page to determine total pages
        first_url = f"{self.base_url}/{category_id}/"
        soup = self.get_soup(first_url)
        if not soup:
            return []
        
        total_pages = self.get_total_pages(soup)
        if max_pages:
            total_pages = min(total_pages, max_pages)
        
        logger.info(f"分类 {category_name} 共有 {total_pages} 页")
        
        # Parse first page
        movies = self.parse_movie_list(soup)
        for movie in movies:
            movie['category'] = category_id
            movie['category_type'] = 'movie'
            movie['category_name'] = category_name
        all_movies.extend(movies)
        
        # Parse remaining pages
        for page in range(2, total_pages + 1):
            url = f"{self.base_url}/{category_id}/index_{page}.html"
            logger.info(f"收集 {category_name} 第 {page}/{total_pages} 页")
            
            soup = self.get_soup(url)
            if not soup:
                continue
            
            movies = self.parse_movie_list(soup)
            for movie in movies:
                movie['category'] = category_id
                movie['category_type'] = 'movie'
                movie['category_name'] = category_name
            all_movies.extend(movies)
            
            time.sleep(1)  # Rate limiting
        
        logger.info(f"分类 {category_name} 收集到 {len(all_movies)} 部电影")
        return all_movies
    
    def save_movie_lists_to_file(self, movie_lists):
        """将电影列表保存到JSON文件"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"movie_lists_{timestamp}.json"
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
            categories = list(self.movie_categories.keys())
        
        all_movie_lists = {}
        
        for category_id in categories:
            try:
                movie_list = self.collect_category_movie_list(category_id, max_pages)
                if movie_list:
                    all_movie_lists[category_id] = movie_list
                time.sleep(2)  # 分类间延迟
            except Exception as e:
                logger.error(f"收集分类 {category_id} 失败: {str(e)}")
                continue
        
        # 保存到文件
        filepath = self.save_movie_lists_to_file(all_movie_lists)
        
        logger.info("=== 阶段1 完成 ===")
        return filepath
    
    def parse_detail_with_gemini(self, html_content):
        """Use Gemini to parse movie detail page"""
        if not self.gemini_client:
            logger.error("Gemini client not initialized")
            return None
        
        prompt = """
        You are given the raw HTML (GB2312/GBK encoded) of a movie detail page.
        Your task is to return a JSON object that conforms to the MovieDetail schema.

        Focus on WHAT to extract, not WHERE to extract it from – the HTML structure varies greatly.
        Parse with best effort and fill in any of the following keys when the information is discoverable:

        • title – primary title of the movie
        • translated_name / original_name – alternative titles if present
        • year, country, genres (split into list), language, subtitles, release_date
        • ratings – Douban, IMDb, or site-specific rating values
        • technical info – file_format, video_size, file_size, duration
        • crew – director, cast (cast may span multiple lines; build a list)
        • synopsis – concise plot summary
        • images – poster (pick a representative big image) and screenshots (list)

        Download links – scan the entire HTML for any of the following URI schemes:
        • magnet:?xt= (magnet links)
        • ftp://   (FTP links)
        • http:// or https://  (direct downloads / web players)

        For each link, also try to infer:
        • quality (e.g. 1080p, 720p, WEB-DL, etc.)

        Be careful that do not include any html tags or representation like \t, \n, etc in the final json output

        Be tolerant to noisy or unconventional HTML. Use cues such as leading "◎" markers, Chinese field names, or colon separators, but do NOT rely on fixed selectors.
        If a field is missing, omit it or leave it null. Ensure the final JSON strictly matches the MovieDetail schema.
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
            logger.error(f"Gemini parsing error: {str(e)}")
            return None
    
    def enrich_movie_details(self, movie, max_retries: int = 2):
        """Fetch and parse detailed movie information with retry on Gemini errors"""
        # 如果缺少链接字段直接返回
        if not movie.get('link'):
            return movie
        
        full_url = urljoin(self.base_url, movie['link'])
        logger.debug(f"获取详细信息: {movie['title']} - {full_url}")
        
        # 抓取 HTML（一次即可，重试仅针对 Gemini 解析）
        try:
            response = self.session.get(full_url, timeout=30)
            response.encoding = 'gb2312'
            html = response.text
            time.sleep(1)  # Fetch delay
        except Exception as e:
            logger.error(f"获取详细信息失败: {str(e)}")
            return movie
        
        # Gemini 解析，带自动重试
        for attempt in range(max_retries + 1):
            details = self.parse_detail_with_gemini(html)
            if details:
                detail_dict = details.model_dump()
                # Merge details
                movie['page_url'] = full_url  # 保留原页面链接
                for key, value in detail_dict.items():
                    if value is not None and (value != [] if isinstance(value, list) else True):
                        movie[key] = value
                # 若已获取到下载链接则视为成功
                if movie.get('download_links'):
                    break
            if attempt < max_retries:
                logger.warning(f"Gemini 解析失败或无下载链接，重试 {attempt + 1}/{max_retries} - {movie.get('title')}")
                time.sleep(2 + attempt)  # 递增等待
        
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
                    # Skip if no download links
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
                    genre_str = json.dumps(movie.get('genre', []), ensure_ascii=False) if isinstance(movie.get('genre'), list) else movie.get('genre', '')
                    cast_str = json.dumps(movie.get('cast', []), ensure_ascii=False) if isinstance(movie.get('cast'), list) else movie.get('cast', '')
                    screenshots_str = json.dumps(movie.get('screenshots', []), ensure_ascii=False) if movie.get('screenshots') else None
                    
                    # Insert or update movie
                    if is_update:
                        cursor.execute('''
                            UPDATE movies SET 
                                title = ?, translated_name = ?, original_name = ?, year = ?, country = ?,
                                genre = ?, language = ?, subtitles = ?, release_date = ?, imdb_rating = ?,
                                douban_rating = ?, file_format = ?, video_size = ?, file_size = ?, duration = ?,
                                director = ?, cast = ?, synopsis = ?, poster = ?, screenshots = ?, category = ?,
                                category_type = ?, publish_date = ?, page_url = ?, raw_data = ?
                            WHERE id = ?
                        ''', (
                            movie.get('title', ''),
                            movie.get('translated_name', ''),
                            movie.get('original_name', ''),
                            movie.get('year', ''),
                            movie.get('country', ''),
                            genre_str,
                            movie.get('language', ''),
                            movie.get('subtitles', ''),
                            movie.get('release_date', ''),
                            movie.get('imdb_rating', ''),
                            movie.get('douban_rating', ''),
                            movie.get('file_format', ''),
                            movie.get('video_size', ''),
                            movie.get('file_size', ''),
                            movie.get('duration', ''),
                            movie.get('director', ''),
                            cast_str,
                            movie.get('synopsis', ''),
                            movie.get('poster', ''),
                            screenshots_str,
                            movie.get('category', ''),
                            movie.get('category_type', ''),
                            movie.get('publish_date', ''),
                            movie.get('page_url', ''),
                            json.dumps(movie, ensure_ascii=False),
                            movie_id
                        ))
                    else:
                        cursor.execute('''
                            INSERT INTO movies (
                                id, title, translated_name, original_name, year, country,
                                genre, language, subtitles, release_date, imdb_rating,
                                douban_rating, file_format, video_size, file_size, duration,
                                director, cast, synopsis, poster, screenshots, category,
                                category_type, publish_date, page_url, raw_data
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            movie_id,
                            movie.get('title', ''),
                            movie.get('translated_name', ''),
                            movie.get('original_name', ''),
                            movie.get('year', ''),
                            movie.get('country', ''),
                            genre_str,
                            movie.get('language', ''),
                            movie.get('subtitles', ''),
                            movie.get('release_date', ''),
                            movie.get('imdb_rating', ''),
                            movie.get('douban_rating', ''),
                            movie.get('file_format', ''),
                            movie.get('video_size', ''),
                            movie.get('file_size', ''),
                            movie.get('duration', ''),
                            movie.get('director', ''),
                            cast_str,
                            movie.get('synopsis', ''),
                            movie.get('poster', ''),
                            screenshots_str,
                            movie.get('category', ''),
                            movie.get('category_type', ''),
                            movie.get('publish_date', ''),
                            movie.get('page_url', ''),
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
    
    def save_category_progress(self, category_id, processed_count, total_count):
        """保存分类处理进度"""
        progress_file = os.path.join(self.data_dir, f'progress_{category_id}.json')
        progress_data = {
            'category_id': category_id,
            'processed_count': processed_count,
            'total_count': total_count,
            'timestamp': datetime.now().isoformat(),
            'percentage': (processed_count / total_count) * 100 if total_count > 0 else 0
        }
        
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress_data, f, ensure_ascii=False, indent=2)
    
    def load_category_progress(self, category_id):
        """加载分类处理进度"""
        progress_file = os.path.join(self.data_dir, f'progress_{category_id}.json')
        if os.path.exists(progress_file):
            with open(progress_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def stage2_process_category(self, category_id, movie_list, max_workers=2, resume=True):
        """阶段2: 处理单个分类的电影详细信息"""
        category_name = self.movie_categories.get(category_id, f'Category {category_id}')
        
        # 检查是否需要断点续传
        start_index = 0
        if resume:
            progress = self.load_category_progress(category_id)
            if progress:
                start_index = progress['processed_count']
                logger.info(f"断点续传: 分类 {category_name} 从第 {start_index} 个电影开始处理")
        
        total_count = len(movie_list)
        logger.info(f"=== 处理分类: {category_name} ({start_index}/{total_count}) ===")
        
        # 处理电影列表
        processed_movies = []
        batch_size = 64  # 每批次处理的数量
        
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
            self.save_category_progress(category_id, current_processed, total_count)
            
            logger.info(f"分类 {category_name} 进度: {current_processed}/{total_count} ({(current_processed/total_count)*100:.1f}%)")
            
            # 批次间休息
            time.sleep(3)
        
        logger.info(f"=== 分类 {category_name} 处理完成，共处理 {len(processed_movies)} 部电影 ===")
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
        
        for category_id in categories:
            if category_id not in movie_lists:
                logger.warning(f"分类 {category_id} 不存在于文件中")
                continue
            
            try:
                movie_list = movie_lists[category_id]
                processed_count = self.stage2_process_category(
                    category_id, movie_list, max_workers, resume
                )
                results[category_id] = processed_count
                total_processed += processed_count
                
                # 分类间休息
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"处理分类 {category_id} 失败: {str(e)}")
                results[category_id] = 0
        
        # 输出总结
        logger.info(f"\n{'='*60}")
        logger.info(f"阶段2 处理完成!")
        logger.info(f"总共处理电影: {total_processed}")
        logger.info(f"数据库文件: {self.db_path}")
        logger.info(f"\n各分类处理结果:")
        for category_id, count in results.items():
            category_name = self.movie_categories.get(category_id, category_id)
            logger.info(f"  {category_name} ({category_id}): {count} 部电影")
        logger.info(f"{'='*60}")
        
        return total_processed
    
    def get_stats(self):
        """Get database statistics"""
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
            cat_name = self.movie_categories.get(category, category)
            print(f"  {cat_name} ({category}): {count}")
        print(f"\n下载链接类型:")
        for link_type, count in link_stats:
            print(f"  {link_type}: {count} 部电影")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='DYTT8899 分阶段电影抓取器')
    parser.add_argument('--gemini-key', help='Gemini API key (或设置 GEMINI_API_KEY 环境变量)')
    parser.add_argument('--db', default='movies.db', help='数据库文件路径')
    parser.add_argument('--data-dir', default='scrape_data', help='中间数据文件目录')
    parser.add_argument('--max-pages', type=int, help='每个分类最大页数 (用于测试)')
    parser.add_argument('--max-workers', type=int, default=2, help='最大并发工作线程数')
    parser.add_argument('--categories', nargs='+', help='指定要处理的分类ID列表')
    
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
    scraper = DYTT8899Scraper(
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
#    python tiantang.py --stage1 --max-pages 2
#
# 2. 处理已收集的电影列表 (阶段2):
#    python tiantang.py --stage2 scrape_data/movie_lists_20250715_173350.json
#
# 3. 完整流程 (测试模式):
#    python tiantang.py --max-pages 1 --max-workers 2
#
# 4. 只处理特定分类:
#    python tiantang.py --stage1 --categories 2 15 4
#    python tiantang.py --stage2 scrape_data/movie_lists_xxx.json --categories 2 15
#
# 5. 查看统计信息:
#    python tiantang.py --stats-only