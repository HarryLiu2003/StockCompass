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

async def fetch_price_yf(ticker_symbol="AAPL", period="1d", interval="60m"):
    """
    Asynchronously fetch historical stock data from Yahoo Finance, wipe the existing data,
    and store the new data in the StockData table. Merged data includes:
      - Annual Free Cash Flow from ticker.get_cashflow(freq='yearly')
      - Annual EPS and profit margin from ticker.get_incomestmt() 
          • EPS is extracted from the "BasicEPS" column
          • Profit margin is computed as GrossProfit / TotalRevenue
      - Market Cap computed as Volume * Close
      - PE Ratio computed as Close / EPS (if EPS is None or 0, then PE is 0)
      
    For each historical data row, the free cash flow, EPS, and profit margin values are determined by
    matching the row’s year with the respective annual data. If a year is not found, EPS and profit margin
    default to None while free cash flow defaults to 0.
    
    A percentage change column (pct_change) is also computed for the close price.
    
    Parameters:
        ticker_symbol (str): The stock symbol to fetch data for.
        period (str): Time period (e.g., "1d", "5d", "1mo", etc.).
        interval (str): Data interval (e.g., "1m", "5m", "60m", etc.).
    """
    # Wipe the entire StockData table asynchronously.
    await asyncio.to_thread(reset_table, StockData)
    print("Existing stock data wiped from the database (yfinance).")

    # Create a ticker object using yfinance.
    ticker = yf.Ticker(ticker_symbol)

    # Fetch historical price data as a pandas DataFrame asynchronously.
    data = await asyncio.to_thread(ticker.history, period=period, interval=interval)
    
    # Compute percentage change for the Close price.
    data['pct_change'] = data['Close'].pct_change(periods=-1).fillna(0) * 100

    ##############################################################
    # Retrieve and merge yearly Free Cash Flow from cash flow data #
    ##############################################################
    # Get yearly cash flow data.
    cf_df = await asyncio.to_thread(ticker.get_cashflow, freq='yearly')
    # Use the "FreeCashFlow" row (as shown in your result.txt)
    if "FreeCashFlow" in cf_df.index:
        fcf_series = cf_df.loc["FreeCashFlow"]
    else:
        fcf_series = pd.Series(dtype=float)
    fcf_mapping = {}
    for col in fcf_series.index:
        try:
            year = pd.to_datetime(col).year
        except Exception:
            try:
                year = int(col)
            except Exception:
                continue
        fcf_mapping[year] = fcf_series[col]

    ##############################################################
    # Retrieve and merge annual EPS and profit margin from income stmt #
    ##############################################################
    # Get the income statement once and transpose it.
    income_stmt_df = await asyncio.to_thread(ticker.get_incomestmt)
    income_stmt_transposed = income_stmt_df.T  # now rows correspond to reporting periods

    # Build mappings from year to annual BasicEPS and profit margin.
    eps_mapping = {}
    profit_margin_mapping = {}
    for period_label, row in income_stmt_transposed.iterrows():
        try:
            # Attempt to extract the year from the period label.
            year = pd.to_datetime(period_label).year
        except Exception:
            try:
                year = int(period_label)
            except Exception:
                continue
        # EPS: use the "BasicEPS" value; if missing, default to None.
        eps_mapping[year] = row.get("BasicEPS", None)
        # Profit margin: calculate as GrossProfit / TotalRevenue if possible.
        total_revenue = row.get("TotalRevenue", None)
        gross_profit = row.get("GrossProfit", None)
        if total_revenue and total_revenue != 0:
            profit_margin_mapping[year] = gross_profit / total_revenue
        else:
            profit_margin_mapping[year] = None

    # Helper function to get free cash flow for a given year.
    def get_fcf_for_year(dt):
        return fcf_mapping.get(dt.year, 0)

    # For each timestamp in our historical data, fill in the free cash flow, EPS, and profit margin.
    free_cash_flow_list = []
    eps_list = []
    profit_margin_list = []
    for ts in data.index:
        dt = ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else ts
        free_cash_flow_list.append(get_fcf_for_year(dt))
        eps_list.append(eps_mapping.get(dt.year, None))
        profit_margin_list.append(profit_margin_mapping.get(dt.year, None))
    data['free_cash_flow'] = free_cash_flow_list
    data['eps'] = eps_list
    data['profit_margin'] = profit_margin_list

    #######################################################
    # Compute additional financial metrics                #
    # - Market Cap = Volume * Close                       #
    # - PE Ratio = Close / EPS (if EPS is missing or 0, then 0)
    #######################################################
    data['market_cap'] = data['Volume'] * data['Close']
    data['pe'] = data.apply(lambda row: 0 if (row['eps'] in [None, 0]) else row['Close'] / row['eps'], axis=1)

    #################################################
    # Store each row in the database asynchronously #
    #################################################
    for timestamp, row in data.iterrows():
        dt = timestamp.to_pydatetime().replace(tzinfo=None)
        await asyncio.to_thread(
            StockData.objects.create,
            timestamp=dt,
            open_price=row['Open'],
            high_price=row['High'],
            low_price=row['Low'],
            close_price=row['Close'],
            volume=int(row['Volume']),
            pct_change=row['pct_change'],
            free_cash_flow=row['free_cash_flow'],
            eps=row['eps'],
            profit_margin=row['profit_margin'],
            market_cap=row['market_cap'],
            pe=row['pe']
        )
    print("Stock data fetched from yfinance and stored successfully.")


async def fetch_price_av():
    # Placeholder for async implementation for Alpha Vantage or similar.
    pass


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
    # Create the Ticker object.
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