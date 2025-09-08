from asgiref.sync import async_to_sync, sync_to_async
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from .utils import *
from .models import StockData
from .serializers import StockDataSerializer
from datetime import datetime


@api_view(['GET'])
@renderer_classes([JSONRenderer])
def stock_data_api(request):
    """API endpoint to fetch stock data with time series and financial metrics."""
    return async_to_sync(async_stock_data_api)(request)

async def async_stock_data_api(request):
    try:
        # Get parameters with defaults if not provided
        stock_name = request.query_params.get('stockname', 'AAPL')
        period = request.query_params.get('period', '1d')
        interval = request.query_params.get('interval', '60m')
    
        # Fetch and process data in memory (stateless approach)
        import asyncio
        processed_data = await asyncio.wait_for(
            fetch_and_process_stock_data(ticker_symbol=stock_name, period=period, interval=interval),
            timeout=60.0  # Increased timeout for processing
        )
        
        if not processed_data:
            return Response({
                "status_code": 500,
                "error": "No data available for the specified stock"
            })
    
        # Return processed data immediately (no database storage)
        response_data = {
            "status_code": 200,
            "time_series": processed_data["time_series"],
            "fin_data": processed_data["fin_data"],
        }
        
    except asyncio.TimeoutError:
        response_data = {
            "status_code": 500,
            "error": "Request timeout - data processing took too long"
        }
    except Exception as e:
        response_data = {
            "status_code": 500,
            "error": str(e)
        }
    
    return Response(response_data)

@api_view(['POST'])
@renderer_classes([JSONRenderer])
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
@renderer_classes([JSONRenderer])
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