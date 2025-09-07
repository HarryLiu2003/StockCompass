# myapp/views.py

import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .handlers import process_chat_response  # Import the handler function

@csrf_exempt  # For development; handle CSRF tokens properly in production.
def chatbot_response(request):
    if request.method == 'POST':
        try:
            # Parse JSON data from the request body.
            data = json.loads(request.body)
            starttime = data.get('starttime')
            endtime = data.get('endtime')
            text = data.get('text')

            # Validate that all required fields are provided.
            if not all([starttime, endtime, text]):
                return JsonResponse({'error': 'Missing one or more required fields.'}, status=400)

            # Process the chat message using the handler function.
            response_text = process_chat_response(starttime, endtime, text)

            # Return the processed result in a JSON response.
            return JsonResponse({'response': response_text})
        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON data.'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    else:
        return JsonResponse({'error': 'Only POST method is allowed.'}, status=405)
