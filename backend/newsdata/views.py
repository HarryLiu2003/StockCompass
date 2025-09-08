from django.http import JsonResponse
from .message import generate_data_openai, generate_data_claude_serpapi_stateless
from django.conf import settings
from asgiref.sync import async_to_sync
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer

@api_view(['GET'])
@renderer_classes([JSONRenderer])
def news_api(request):
    try:
        stockname = request.query_params.get('stockname', 'AAPL')
        start = request.query_params.get('start', '2025-01-01')
        end = request.query_params.get('end', '2025-01-10')
        
        # Remove quotes from dates if present
        start = start.replace('"', '')
        end = end.replace('"', '')
        
        # Use Claude + SerpAPI (preferred) or fallback to OpenAI + Perplexity
        api_claude = getattr(settings, 'API_CLAUDE', None)
        serpapi_key = getattr(settings, 'SERPAPI_KEY', None)
        
        if api_claude and serpapi_key:
            # Use Claude Sonnet 4 + SerpAPI (stateless)
            complex_res = generate_data_claude_serpapi_stateless(
                serpapi_key,
                api_claude,
                stockname,
                start,
                end
            )
        elif settings.API_PER and settings.API_OPENAI:
            # Fallback to OpenAI + Perplexity
            complex_res = generate_data_openai(
                settings.API_PER,
                settings.API_OPENAI,
                stockname,
                start,
                end
            )
        else:
            return Response({
                "status_code": 500,
                "error": "No AI API keys configured (need Claude+SerpAPI or OpenAI+Perplexity)"
            }, status=500)
        
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
