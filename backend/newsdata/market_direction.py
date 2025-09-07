import os
import pandas as pd
import numpy as np
import asyncio
import yfinance as yf
import scipy.stats
from arch import arch_model

#############################################
# 1. Market Data Access and Calculation
#############################################

async def fetch_and_store_market_data(
    index_symbol="^GSPC",  # S&P 500 ticker in yfinance; use "^DJI" for DJIA if preferred
    period="max",          # Get full historical data
    interval="1d",
    csv_file="market_data.csv"
):
    """
    Asynchronously fetch market index data, calculate daily returns and rolling volatility,
    and store the results in a CSV file.
    
    Parameters:
        index_symbol (str): Market index ticker (default is S&P500).
        period (str): Time period for the data.
        interval (str): Data interval.
        csv_file (str): File path to store the CSV.
        
    Returns:
        pd.DataFrame: The fetched and computed market data.
    """
    ticker = yf.Ticker(index_symbol)
    # Fetch historical data asynchronously.
    data = await asyncio.to_thread(ticker.history, period=period, interval=interval)
    
    if data.empty:
        raise ValueError(f"No data found for {index_symbol}")
    
    # Calculate daily returns (in percentage).
    data['daily_return'] = data['Close'].pct_change() * 100
    # Calculate rolling volatility (using a 30-day window, for example).
    data['volatility'] = data['daily_return'].rolling(window=30).std()
    
    # Store the data to CSV.
    data.to_csv(csv_file)
    print(f"Market data for {index_symbol} saved to {csv_file}")
    return data

#############################################
# 2. Load Market Data from CSV
#############################################

def load_market_data(csv_file="market_data.csv"):
    """
    Load market data from a CSV file.
    
    Parameters:
        csv_file (str): Path to the CSV file.
        
    Returns:
        pd.DataFrame: The market data.
    """
    if os.path.exists(csv_file):
        data = pd.read_csv(csv_file, index_col=0, parse_dates=True)
        return data
    else:
        raise FileNotFoundError(f"{csv_file} does not exist. Please run fetch_and_store_market_data first.")

#############################################
# 3. Compare Stock vs. Market Movement
#############################################

def analyze_stock_vs_market_direction(stock_data, market_data, start_date, end_date):
    """
    Compare the movement of a single stock and the market over a given period.
    
    Parameters:
        stock_data (pd.DataFrame): Stock price data (must include a 'Close' column) with a DateTime index.
        market_data (pd.DataFrame): Market index data (must include a 'Close' column) with a DateTime index.
        start_date (str or datetime-like): Start of the period (inclusive).
        end_date (str or datetime-like): End of the period (inclusive).
        
    Returns:
        bool: True if the stock and the market moved in the same direction over the period, 
              False otherwise.
    """
    # Select data for the given period.
    stock_period = stock_data.loc[start_date:end_date]
    market_period = market_data.loc[start_date:end_date]
    
    if stock_period.empty or market_period.empty:
        raise ValueError("No data available in the provided date range.")
    
    # Compute overall returns for the period.
    stock_return = (stock_period['Close'].iloc[-1] - stock_period['Close'].iloc[0]) / stock_period['Close'].iloc[0]
    market_return = (market_period['Close'].iloc[-1] - market_period['Close'].iloc[0]) / market_period['Close'].iloc[0]
    
    print(f"Stock return from {start_date} to {end_date}: {stock_return:.2%}")
    print(f"Market return from {start_date} to {end_date}: {market_return:.2%}")
    
    # If both returns have the same sign (both positive or both negative), they moved in the same direction.
    same_direction = (stock_return * market_return) > 0
    return same_direction

#############################################
# Example Usage
#############################################

# (a) Fetch and store market data (this would likely be run on a schedule or before your analysis)
# asyncio.run(fetch_and_store_market_data())

# (b) Later, when analyzing a given stock’s abnormal range:
# Suppose you already have a DataFrame `stock_data` for your single stock.
# And you have an abnormal period identified, e.g., start_date and end_date (strings in "YYYY-MM-DD" format).

# Load market data from CSV.
# market_df = load_market_data()

# Compare the movement in the given period.
# same_dir = analyze_stock_vs_market_direction(stock_data, market_df, start_date="2023-01-15", end_date="2023-01-20")
# if same_dir:
#     print("Abnormal stock move matches the market move; ignoring anomaly.")
# else:
#     print("Stock move deviates from market move; further analysis required.")