import asyncio
import yfinance as yf
import datetime
import numpy as np
import pandas as pd
import scipy.stats

from django.conf import settings
from .models import StockData
from django.db import connection
from arch import arch_model

async def fetch_and_process_stock_data(ticker_symbol="AAPL", period="1d", interval="60m"):
    """
    Stateless stock data fetching and processing.
    Fetches data from Yahoo Finance, processes in memory, returns immediately.
    NO database storage - pure in-memory processing for fast response.
    """
    print(f"🚀 Fetching {ticker_symbol} data: period={period}, interval={interval}")
    
    # Create ticker object (no anti-rate limiting needed for stateless approach)
    ticker = yf.Ticker(ticker_symbol)

    try:
        # Fetch price data
        print(f"📊 Fetching price history...")
        price_data = await asyncio.to_thread(ticker.history, period=period, interval=interval)
        
        if price_data.empty:
            print(f"❌ No price data available for {ticker_symbol}")
            return None
            
        print(f"✅ Fetched {len(price_data)} price records for {ticker_symbol}")
        
        # Fetch financial info for accurate metrics
        print(f"📊 Fetching financial info...")
        info = await asyncio.to_thread(lambda: ticker.info)
        
        # Extract real financial metrics using correct yfinance field identifiers
        market_cap_base = info.get('marketCap', None)  # Base market cap
        trailing_pe_base = info.get('trailingPE', None)  # Base P/E ratio (TTM)
        trailing_eps = info.get('trailingEps', None)  # EPS (same for all days)
        shares_outstanding = info.get('sharesOutstanding', None)  # For market cap calculation
        
        print(f"📊 Base financial metrics - Market Cap: {market_cap_base}, P/E: {trailing_pe_base}, EPS: {trailing_eps}")
        
        # Process data in memory (no database storage)
        from datetime import datetime
        from django.utils import timezone
        
        time_series = []
        fin_data = []
        
        # Calculate percentage change
        price_data['pct_change'] = price_data['Close'].pct_change().fillna(0) * 100
        
        for timestamp, row in price_data.iterrows():
            # Format timestamp properly
            dt = timestamp.to_pydatetime()
            if dt.tzinfo is None:
                dt = timezone.make_aware(dt, timezone.utc)
            time_str = dt.strftime("%Y-%m-%d")
            
            current_price = float(row['Close'])
            
            # Time series data
            time_series.append({
                "time": time_str,
                "close_price": round(current_price, 2),
                "volume": int(row['Volume'])
            })
            
            # Calculate time series financial metrics
            # Market Cap = Current Price × Shares Outstanding (changes with price)
            daily_market_cap = (current_price * shares_outstanding) if shares_outstanding else market_cap_base
            
            # P/E Ratio = Current Price ÷ EPS (changes with price)  
            daily_pe = (current_price / trailing_eps) if trailing_eps and trailing_eps > 0 else trailing_pe_base
            
            fin_data.append({
                "time": time_str,
                "eps": trailing_eps,  # EPS stays same (company metric)
                "market_cap": daily_market_cap,  # Changes with stock price
                "pct_change": round(float(row['pct_change']), 2),
                "pe": daily_pe  # Changes with stock price
            })
        
        print(f"✅ Processed {len(time_series)} records with real financial metrics")
        
        return {
            "time_series": time_series,
            "fin_data": fin_data
        }
        
    except Exception as e:
        print(f"❌ Error fetching data for {ticker_symbol}: {e}")
        return None

# Keep original function for backward compatibility if needed
async def fetch_price_av():
    # Placeholder for async implementation for Alpha Vantage or similar.
    pass

async def unusual_ranges(data):
    """
    Asynchronously identify unusual date ranges using a GARCH-based volatility test 
    and a Central Limit Theorem test on daily price changes.

    Parameters:
        data (dict): Dictionary with keys "time", "price", and optionally "volume".
                     - "time": list of date strings (format "YYYY-MM-DD")
                     - "price": list of price values (floats)
                     - "volume": list of volumes (ignored in this function)
    Returns:
        List of tuples, where each tuple contains two strings representing the start 
        and end dates ("YYYY-MM-DD") of an unusual range. Each range will span at least 2 days.
    """
    # Verify that required keys exist.
    if not data or "time" not in data or "price" not in data:
        raise ValueError("Data must contain 'time' and 'price' arrays")
    
    # Convert the time strings to numpy.datetime64 objects.
    times = np.array([np.datetime64(t) for t in data["time"]])
    prices = np.array(data["price"], dtype=float)
    
    if len(prices) < 2:
        raise ValueError("Not enough price data to compute daily changes.")
    
    # Compute daily changes as the difference between consecutive prices.
    # The daily change corresponding to a day is taken as the difference from the previous day.
    daily_changes = np.diff(prices)
    # The corresponding dates for these daily changes are the dates from the second element onward.
    daily_dates = times[1:]
    
    # Compute the critical value for a two-tailed 95% confidence interval.
    crit_value = scipy.stats.norm.ppf(1 - 0.05 / 2)
    
    # Offload the GARCH model fitting to a separate thread.
    garch_fit = await asyncio.to_thread(
        lambda: arch_model(daily_changes, vol='Garch', p=1, q=1).fit(disp='off')
    )
    forecast = garch_fit.conditional_volatility  # same length as daily_changes
    
    # Calculate basic statistics.
    mean = np.mean(daily_changes)
    stdev = np.std(daily_changes)
    
    # Apply the combined test to determine unusual days.
    mask = (np.abs(daily_changes) > (crit_value * forecast))
    mask = mask & ((np.abs(daily_changes - mean) / stdev) > crit_value)
    unusual_dates = daily_dates[mask]
    
    if unusual_dates.size == 0:
        raise Exception("No unusual dates found with combined tests")
    
    # Sort the unusual dates.
    unusual_dates = np.sort(unusual_dates)
    # Compute the gaps between consecutive unusual dates.
    gaps = np.diff(unusual_dates)
    # Convert gaps to days (as integers) for comparison.
    gaps_in_days = gaps.astype('timedelta64[D]').astype(int)
    median_gap = np.median(gaps_in_days)
    # Identify indices where the gap is greater than the median gap.
    gap_indices = np.where(gaps_in_days > median_gap)[0]
    
    # Group consecutive unusual dates into ranges.
    if gap_indices.size == 0:
        ranges = [(unusual_dates[0], unusual_dates[-1])]
    else:
        start_indices = np.r_[0, gap_indices + 1]
        end_indices = np.r_[gap_indices, unusual_dates.size - 1]
        ranges = [(unusual_dates[s], unusual_dates[e]) for s, e in zip(start_indices, end_indices) if s != e]
    
    # Sort the ranges by duration (in days) in descending order.
    ranges.sort(key=lambda pair: (pair[1] - pair[0]).astype('timedelta64[D]').astype(int), reverse=True)
    
    # Convert the numpy.datetime64 objects to strings in "YYYY-MM-DD" format.
    formatted_ranges = [(str(start.astype('M8[D]')), str(end.astype('M8[D]'))) for start, end in ranges]
    
    # --- Ensure each range spans at least 2 days ---
    # Determine the maximum date in the input (to avoid extending beyond available data).
    max_date = times.max()
    adjusted_ranges = []
    for start_str, end_str in formatted_ranges:
        start_date = np.datetime64(start_str)
        end_date = np.datetime64(end_str)
        if start_date == end_date:
            # If start is not the maximum date, extend by one day.
            if start_date < max_date:
                end_date = start_date + np.timedelta64(1, 'D')
            else:
                # Otherwise, if start is the maximum date, shift the range back by one day.
                start_date = start_date - np.timedelta64(1, 'D')
        adjusted_ranges.append((str(start_date.astype('M8[D]')), str(end_date.astype('M8[D]'))))
    
    return adjusted_ranges

async def get_stock_metadata_info(ticker_symbol="AAPL"):
    """
    Asynchronously fetch stock metadata using yfinance and extract:
      - currency
      - exchangeName
      - longName
      - last close price (using 'previousClose')
    
    Parameters:
        ticker_symbol (str): The stock ticker symbol (default "AAPL").
    
    Returns:
        dict: A dictionary with the extracted information.
    """
    # Create the Ticker object
    ticker = yf.Ticker(ticker_symbol)
    
    # Run the synchronous call in a separate thread.
    metadata = await asyncio.to_thread(ticker.get_history_metadata)
    
    # Navigate the nested metadata structure.
    # Typically the useful info is nested inside the 'chart' key.
    currency = metadata["currency"]
    exchangeName = metadata["fullExchangeName"]
    longName = metadata["longName"]
    hist = ticker.history(period="1d")
    lastClose = hist.index[-1].date()  
    # Calculate monthly percentage change:
    # Retrieve approximately 35 days of data to cover "30 days ago".
    hist_month = await asyncio.to_thread(ticker.history, period="35d")
    if not hist_month.empty:
        price_today_month = hist_month["Close"].iloc[-1]
        price_30_days_ago = hist_month["Close"].iloc[0]
        monthly_pct_change = (price_today_month / price_30_days_ago) - 1
    else:
        monthly_pct_change = None

    # Calculate annual percentage change:
    # Retrieve approximately 400 days of data to cover "365 days ago".
    hist_year = await asyncio.to_thread(ticker.history, period="400d")
    if not hist_year.empty:
        price_today_year = hist_year["Close"].iloc[-1]
        price_365_days_ago = hist_year["Close"].iloc[0]
        yearly_pct_change = (price_today_year / price_365_days_ago) - 1
    else:
        yearly_pct_change = None

    return {
        "currency": currency,
        "exchangeName": exchangeName,
        "longName": longName,
        "lastClose": lastClose,
        "montly_pct_change": monthly_pct_change,
        "yearly_pct_change": yearly_pct_change
    }