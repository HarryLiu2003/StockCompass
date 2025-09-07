from django.http import JsonResponse
from .message import generate_data_openai
from django.conf import settings
from asgiref.sync import async_to_sync
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def news_api(request):
    try:
        stockname = request.query_params.get('stockname', 'AAPL')
        start = request.query_params.get('start', '2025-01-01')
        end = request.query_params.get('end', '2025-01-10')
        
        # Remove quotes from dates if present
        start = start.replace('"', '')
        end = end.replace('"', '')
        
        if not settings.API_PER or not settings.API_OPENAI:
            return Response({
                "status_code": 500,
                "error": "API keys not configured"
            }, status=500)
        
        complex_res = generate_data_openai(
            settings.API_PER,
            settings.API_OPENAI,
            stockname,
            start,
            end
        )
        
        response_data = {
            "status_code": 200,
            "complex": complex_res
        }
        return Response(response_data)
    
    except Exception as e:
        error_data = {
            "status_code": 500,
            "stockname": stockname,
            "start": start,
            "end": end,
            "error": str(e)
        }
        return Response(error_data, status=500)
