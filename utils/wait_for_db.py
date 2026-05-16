import os
import psycopg2
import time
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def wait_for_database(max_retries=30, delay=2):
    logger.info("🔍 Waiting for PostgreSQL to be ready...")
    database_url = os.getenv("DATABASE_URL")
    
    for attempt in range(max_retries):
        try:
            if database_url:
                conn = psycopg2.connect(database_url, connect_timeout=5)
            else:
                conn = psycopg2.connect(
                    host=os.getenv("POSTGRES_HOST", "postgres"),
                    port=os.getenv("POSTGRES_PORT", "5432"),
                    database=os.getenv("POSTGRES_DB", "app_db"),
                    user=os.getenv("POSTGRES_USER", "user"),
                    password=os.getenv("POSTGRES_PASSWORD", "password"),
                    connect_timeout=5
                )
            conn.close()
            logger.info(f"🎉 PostgreSQL is ready! (attempt {attempt + 1})")
            return True
        except Exception as e:
            wait_time = min(delay * (1.5**attempt), 30)
            logger.info(f"⏳ PostgreSQL not ready yet ({e}). Retrying in {wait_time:.1f}s... (attempt {attempt + 1}/{max_retries})")
            time.sleep(wait_time)
            
    logger.error("❌ Failed to connect to PostgreSQL")
    return False

if __name__ == "__main__":
    if wait_for_database():
        sys.exit(0)
    sys.exit(1)
