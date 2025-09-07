from asgiref.sync import async_to_sync, sync_to_async
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .utils import *
from .models import StockData
from .serializers import StockDataSerializer
from datetime import datetime


@api_view(['GET'])
def stock_data_api(request):
    # Wrap the async view so that it runs synchronously.
    try:
        return async_to_sync(async_stock_data_api)(request)
    except Exception as e:
        # Always return JSON response regardless of Accept header
        from rest_framework.response import Response
        return Response({
            "status_code": 500,
            "error": str(e)
        }, status=500, content_type='application/json')

async def async_stock_data_api(request):
    try:
        # Get parameters with defaults if not provided
        stock_name = request.query_params.get('stockname', 'AAPL')
        period = request.query_params.get('period', '1d')
        interval = request.query_params.get('interval', '60m')
    
        # Call the async data fetching function
        await fetch_price_yf(ticker_symbol=stock_name, period=period, interval=interval)
    
        # Retrieve all stored stock data asynchronously
        stock_data = await sync_to_async(list)(StockData.objects.all().order_by('timestamp'))
    
        # Serialize the data
        serializer = StockDataSerializer(stock_data, many=True)
    
        # Format the data:
        # - Format time to "YYYY-MM-DD"
        # - Round numeric fields to 2 decimal places (if not None)
        time_series = [
            {
                "time": datetime.fromisoformat(item["timestamp"].replace('Z','')).strftime("%Y-%m-%d"),
                "close_price": round(item["close_price"], 2) if item["close_price"] is not None else None,
                "volume": item["volume"],

            }
            for item in serializer.data
        ]
        fin_data = [
            {
                "time": datetime.fromisoformat(item["timestamp"].replace('Z','')).strftime("%Y-%m-%d"),
                "free_cash_flow": round(item["free_cash_flow"], 3) if item["free_cash_flow"] is not None else None,
                "eps": round(item["eps"], 2) if item["eps"] is not None else None,
                "profit_margin": round(item["profit_margin"], 2) if item["profit_margin"] is not None else None,
                "market_cap": round(item["market_cap"], 2) if item["market_cap"] is not None else None,
                "pct_change": round(item["pct_change"], 2) if item["pct_change"] is not None else None,
                "pe": round(item["pe"], 2) if item["pe"] is not None else None,
            }
            for item in serializer.data
        ]
    
        # Prepare the final response data
        response_data = {
            "status_code": 200,
            "time_series": time_series,
            "fin_data": fin_data,
        }
    except Exception as e:
        # If an exception occurs, return an error status and message.
        response_data = {
            "status_code": 500,
            "error": str(e)
        }
    
    return Response(response_data)

@api_view(['POST'])
def unusual_ranges_api(request):
    """
    API endpoint to calculate unusual date ranges.
    
    Expected request JSON structure:
    {
        "data": {
            "2025-01-01": [0.05],
            "2025-01-02": [0.02],
            ...
        }
    }
    
    Response JSON structure on success:
    {
        "status_code": 200,
        "unusual_ranges": [
            [ "2025-01-10", "2025-01-15" ],
            [ "2025-02-03", "2025-02-04" ],
            ...
        ]
    }
    
    On error, it returns a 500 status with the error message.
    """
    # Extract input data from the request body.
    input_data = request.data.get('data', None)
    if input_data is None:
        return Response({"status_code": 400, "error": "Missing 'data' in request"}, status=400)
    
    try:
        # Call the async unusual_ranges function using async_to_sync.
        ranges = async_to_sync(unusual_ranges)(input_data)
        return Response({
            "status_code": 200,
            "unusual_ranges": ranges
        })
    except Exception as e:
        return Response({
            "status_code": 500,
            "error": str(e)
        }, status=500)
@api_view(["GET"])
def stock_metadata_api(request):
    """
    API endpoint to fetch stock metadata.

    Query Parameters:
      - stockname (optional): The stock ticker symbol (default "AAPL").

    Returns:
      JSON response containing:
        - currency
        - exchangeName
        - longName
        - lastClose
    """
    # Get the ticker symbol from query parameters (default to AAPL)
    ticker_symbol = request.query_params.get("stockname", "AAPL")
    print(ticker_symbol)
    
    try:
        # Wrap the async function to run synchronously.
        data = async_to_sync(get_stock_metadata_info)(ticker_symbol)
        response_data = {
            "status_code": 200,
            "metadata": data
        }
        return Response(response_data, status=200)
    except Exception as e:
        return Response({
            "status_code": 500,
            "error": str(e)
        }, status=500)