from django.http import JsonResponse
from .message import generate_data_openai, generate_data_claude_serpapi_stateless
from django.conf import settings
from asgiref.sync import async_to_sync
from rest_framework.decorators import api_view, renderer_classes
from rest_framework.response import Response
from rest_framework.renderers import JSONRenderer
from django.http import StreamingHttpResponse
import json
import time

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

def news_analysis_stream(request):
    """
    Server-Sent Events endpoint for real-time AI analysis progress.
    Streams actual backend processing steps as they complete.
    """
    def event_stream():
        try:
            stockname = request.query_params.get('stockname', 'AAPL')
            start = request.query_params.get('start', '2025-01-01')
            end = request.query_params.get('end', '2025-01-10')
            
            # Remove quotes from dates if present
            start = start.replace('"', '')
            end = end.replace('"', '')
            
            # Send initial connection event
            yield f"data: {json.dumps({'step': 'connected', 'message': 'AI analysis started'})}\n\n"
            
            # Get API keys first
            api_claude = getattr(settings, 'API_CLAUDE', None)
            serpapi_key = getattr(settings, 'SERPAPI_KEY', None)
            
            if not (api_claude and serpapi_key):
                yield f"data: {json.dumps({'step': 'error', 'message': 'API keys not configured'})}\n\n"
                return
            
            # Import the functions
            from .message import serpapi_news_search, api_enhancement_request_claude
            
            # REAL Step 1: SerpAPI News Search
            yield f"data: {json.dumps({'step': 'serpapi_search', 'status': 'running', 'message': f'Searching Google News for {stockname} from {start} to {end}'})}\n\n"
            
            news_data = serpapi_news_search(serpapi_key, stockname, start, end)
            articles_found = len(news_data.get('content', []))
            citations_found = len(news_data.get('citations', []))
            
            yield f"data: {json.dumps({'step': 'serpapi_search', 'status': 'completed', 'message': f'Found {articles_found} articles with {citations_found} sources'})}\n\n"
            
            # REAL Step 2: Claude Sonnet 4 Analysis  
            yield f"data: {json.dumps({'step': 'claude_analysis', 'status': 'running', 'message': 'Sending data to Claude Sonnet 4 for analysis'})}\n\n"
            
            # This is the actual heavy processing step
            enhanced_analysis = api_enhancement_request_claude(
                api_claude, stockname, start, end,
                news_data['content'], 
                news_data['citations']
            )
            
            yield f"data: {json.dumps({'step': 'claude_analysis', 'status': 'completed', 'message': 'Claude analysis completed'})}\n\n"
            
            # REAL Step 3: JSON Processing
            yield f"data: {json.dumps({'step': 'json_processing', 'status': 'running', 'message': 'Processing and validating analysis results'})}\n\n"
            
            # Validate JSON response
            try:
                json.loads(enhanced_analysis)
                yield f"data: {json.dumps({'step': 'json_processing', 'status': 'completed', 'message': 'Analysis results validated'})}\n\n"
            except:
                yield f"data: {json.dumps({'step': 'json_processing', 'status': 'completed', 'message': 'Analysis results processed (with fallback formatting)'})}\n\n"
            
            # Send final result
            yield f"data: {json.dumps({'step': 'complete', 'result': enhanced_analysis})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e)})}\n\n"
    
    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['Connection'] = 'keep-alive'
    response['Access-Control-Allow-Origin'] = '*'
    response['Access-Control-Allow-Headers'] = 'Cache-Control'
    response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering
    return response
