#!/bin/bash

# Base URL of the API endpoint
BASE_URL="http://localhost:8080/api/stockdata/"

# Define an array of query strings.
# These queries test a variety of scenarios:
# 1. A standard query for AAPL with daily data at a 60-minute interval.
# 2. A 5‑day query for GOOG with daily intervals.
# 3. A 1‑month query for MSFT with daily intervals.
# 4. An invalid ticker ("INVALID") to test error handling.
# 5. A query with an out-of-range period (100 years) to test limits.
queries=(
    "stockname=AAPL&period=1d&interval=60m"
    "stockname=GOOG&period=5d&interval=1d"
    "stockname=MSFT&period=1mo&interval=1d"
    "stockname=INVALID&period=1d&interval=60m"
    "stockname=AAPL&period=100y&interval=60m"
)

# Loop through each query and perform a GET request
for q in "${queries[@]}"; do
    full_url="${BASE_URL}?${q}"
    echo "Testing: $full_url"
    
    # Use curl to make the request; display the HTTP status code.
    curl -s -o /dev/null -w "HTTP status: %{http_code}\n" "$full_url"
    
    echo "--------------------------------"
done