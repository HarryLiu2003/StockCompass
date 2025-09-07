# newsdata/utils.py
import asyncio
import requests
from datetime import datetime
from django.db import connection
from .models import NewsData

def reset_table(model):
    """
    Synchronously wipes all rows from the model's table and resets the auto-increment counter.
    
    Parameters:
        model: The Django model class whose table you want to truncate.
    """
    table_name = model._meta.db_table  # Get the actual database table name
    with connection.cursor() as cursor:
        if connection.vendor == "postgresql":
            cursor.execute(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE;")
        elif connection.vendor == "mysql":
            cursor.execute(f"TRUNCATE TABLE {table_name};")
        elif connection.vendor == "sqlite":
            cursor.execute(f"DELETE FROM {table_name};")
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table_name}';")
        else:
            cursor.execute(f"DELETE FROM {table_name};")

async def get_news_data(tickers=None, topics=None, time_from=None, time_to=None,
                        sort='LATEST', limit=50, apikey=None):
    """
    Asynchronously fetch news data from the Alpha Vantage NEWS_SENTIMENT API,
    wipe the NewsData table, store the new records, and return the list of articles.
    
    Parameters:
        tickers (str): Optional. A comma-separated list of tickers (e.g., "AAPL" or "COIN,CRYPTO:BTC,FOREX:USD").
        topics (str): Optional. A comma-separated list of topics (e.g., "technology" or "technology,ipo").
        time_from (str): Optional. Start time in YYYYMMDDTHHMM or YYYYMMDDTHHMMSS format.
        time_to (str): Optional. End time in YYYYMMDDTHHMM or YYYYMMDDTHHMMSS format.
        sort (str): Optional. Sorting order ("LATEST" (default), "EARLIEST", or "RELEVANCE").
        limit (int): Optional. Maximum number of articles to return (default: 50).
        apikey (str): **Required.** Your API key for the Alpha Vantage API.
        
    Returns:
        List[dict]: A list of dictionaries, each representing a news article.
    """
    if not apikey:
        raise ValueError("API key is required.")

    # Wipe the NewsData table asynchronously.
    await asyncio.to_thread(reset_table, NewsData)
    print("Existing news data wiped from the database.")

    # Build the API request.
    base_url = "https://www.alphavantage.co/query"
    params = {
        "function": "NEWS_SENTIMENT",
        "apikey": apikey,
        "limit": limit,
        "sort": sort,
    }
    if tickers:
        params["tickers"] = tickers
    if topics:
        params["topics"] = topics
    if time_from:
        params["time_from"] = time_from
    if time_to:
        params["time_to"] = time_to

    # Make the API request asynchronously using asyncio.to_thread.
    response = await asyncio.to_thread(requests.get, base_url, params=params)
    if response.status_code != 200:
        raise Exception(f"Error fetching news data: HTTP {response.status_code}")

    data = response.json()
    if "feed" not in data:
        print("Warning: 'feed' key not found in Alpha Vantage response:", data)
        return []

    news_feed = data["feed"]
    news_list = []

    # Process each article in the feed.
    for item in news_feed:
        title = item.get("title")
        url = item.get("url")
        time_published_str = item.get("time_published")  # e.g., "20250208T162713"
        summary = item.get("summary")
        banner_image = item.get("banner_image")
        source = item.get("source")
        overall_sentiment_score = item.get("overall_sentiment_score")

        # Convert the custom time format to a datetime object.
        try:
            time_published = datetime.strptime(time_published_str, "%Y%m%dT%H%M%S")
        except Exception:
            time_published = None

        # Store the record asynchronously in the database.
        await asyncio.to_thread(
            NewsData.objects.create,
            title=title,
            url=url,
            time_published=time_published,
            summary=summary,
            banner_image=banner_image,
            source=source,
            overall_sentiment_score=overall_sentiment_score
        )

        # Append the article dictionary to our return list.
        news_list.append({
            "title": title,
            "url": url,
            "time_published": time_published_str,
            "summary": summary,
            "banner_image": banner_image,
            "source": source,
            "overall_sentiment_score": overall_sentiment_score,
        })

    print("News data fetched from Alpha Vantage and stored successfully.")
    return news_list
