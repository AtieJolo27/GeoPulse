"""Authenticated server-to-server Gemini requests, executed in Render's region."""
import hmac
import json
import logging
import os
import re
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / '.env.local', override=False)

router = APIRouter()
logger = logging.getLogger('uvicorn.error')


def authorize(authorization: str = Header(default='')):
    token = os.getenv('GEMINI_PROXY_TOKEN', '').strip()
    if not token:
        raise HTTPException(503, 'Gemini relay is not configured.')
    if not hmac.compare_digest(authorization.encode(), f'Bearer {token}'.encode()):
        raise HTTPException(401, 'Unauthorized')


class Message(BaseModel):
    role: Literal['system', 'user', 'assistant']
    content: str = Field(min_length=1, max_length=20000)


class CompletionRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=6)
    max_completion_tokens: int = Field(default=1024, ge=1, le=8192)
    json_mode: bool = False


@router.post('/ai/gemini', dependencies=[Depends(authorize)])
def gemini_completion(completion: CompletionRequest):
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        return JSONResponse({'error': {'code': 'NOT_CONFIGURED'}}, status_code=503)
    model = os.getenv('GEMINI_MODEL', '').strip() or 'gemini-3.8-flash'
    payload = {
        'systemInstruction': {'parts': [{'text': '\n\n'.join(m.content for m in completion.messages if m.role == 'system')}]},
        'contents': [
            {'role': 'model' if m.role == 'assistant' else 'user', 'parts': [{'text': m.content}]}
            for m in completion.messages if m.role != 'system'
        ],
        'generationConfig': {
            'maxOutputTokens': max(4096, completion.max_completion_tokens),
            **({'responseMimeType': 'application/json'} if completion.json_mode else {}),
        },
    }
    request = Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe="")}:generateContent',
        data=json.dumps(payload).encode(), method='POST',
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
    )
    try:
        with urlopen(request, timeout=25) as response:
            return json.load(response)
    except HTTPError as error:
        # Classify privately; never expose upstream text, prompts, or credentials.
        try:
            message = json.load(error).get('error', {}).get('message', '')
        except (ValueError, AttributeError):
            message = ''
        code = 'UPSTREAM_ERROR'
        if re.search(r'location.*not supported|not.*available.*(?:country|region)|unsupported.*location', message, re.I):
            code = 'LOCATION_UNSUPPORTED'
        elif re.search(r'api.key.*(?:not valid|invalid)|API_KEY_INVALID', message, re.I):
            code = 'INVALID_KEY'
        logger.warning('Gemini upstream HTTP failure: status=%s code=%s', error.code, code)
        return JSONResponse({'error': {'code': code}}, status_code=error.code)
    except (URLError, TimeoutError, ValueError) as error:
        # Do not log exception text: URLs and upstream bodies can contain secrets.
        reason = error.reason if isinstance(error, URLError) else error
        category = ('timeout' if isinstance(reason, TimeoutError) else
                    'invalid_json' if isinstance(error, ValueError) else 'network')
        logger.warning('Gemini upstream failure: category=%s exception=%s',
                       category, type(reason).__name__)
        return JSONResponse({'error': {'code': 'UPSTREAM_UNAVAILABLE'}}, status_code=502)
