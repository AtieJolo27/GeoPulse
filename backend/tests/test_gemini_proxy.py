import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.services.gemini_proxy import router


class GeminiProxyTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)
        self.environment = patch.dict(os.environ, {
            'GEMINI_PROXY_TOKEN': 'relay-test-token',
            'GEMINI_API_KEY': 'google-test-key',
            'GEMINI_MODEL': 'test-model',
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.payload = {
            'messages': [{'role': 'system', 'content': 'Rules'}, {'role': 'user', 'content': 'Rice'}],
            'max_completion_tokens': 1024, 'json_mode': True,
        }

    def post(self):
        return self.client.post('/ai/gemini', json=self.payload,
                                headers={'Authorization': 'Bearer relay-test-token'})

    @patch('app.services.gemini_proxy.urlopen')
    def test_authentication_fails_before_google_request(self, upstream):
        for headers in [{}, {'Authorization': 'Bearer wrong'}]:
            self.assertEqual(self.client.post('/ai/gemini', json=self.payload, headers=headers).status_code, 401)
        upstream.assert_not_called()

    @patch('app.services.gemini_proxy.urlopen')
    def test_oregon_server_builds_google_request_with_its_own_key(self, upstream):
        body = {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': 'Advice'}]}}]}
        upstream.return_value.__enter__.return_value = io.BytesIO(json.dumps(body).encode())
        response = self.post()
        self.assertEqual(response.json(), body)
        request = upstream.call_args.args[0]
        self.assertEqual(request.full_url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent')
        self.assertEqual(request.get_header('X-goog-api-key'), 'google-test-key')
        data = json.loads(request.data)
        self.assertEqual(data['systemInstruction']['parts'][0]['text'], 'Rules')
        self.assertEqual(data['contents'][0]['parts'][0]['text'], 'Rice')
        self.assertEqual(data['generationConfig'], {'maxOutputTokens': 4096, 'responseMimeType': 'application/json'})
        self.assertEqual(upstream.call_args.kwargs['timeout'], 25)

    @patch('app.services.gemini_proxy.urlopen')
    def test_missing_configuration_does_not_call_google(self, upstream):
        with patch.dict(os.environ, {'GEMINI_PROXY_TOKEN': ''}):
            self.assertEqual(self.post().status_code, 503)
        with patch.dict(os.environ, {'GEMINI_API_KEY': ''}):
            self.assertEqual(self.post().status_code, 503)
        upstream.assert_not_called()

    @patch('app.services.gemini_proxy.urlopen')
    def test_invalid_request_is_rejected_before_google(self, upstream):
        for messages in [[], [{'role': 'tool', 'content': 'test'}], [{'role': 'user', 'content': 'a' * 20001}]]:
            self.payload['messages'] = messages
            self.assertEqual(self.post().status_code, 422)
        upstream.assert_not_called()

    @patch('app.services.gemini_proxy.urlopen')
    def test_google_errors_are_sanitized_and_keep_status(self, upstream):
        for status, message, code in [
            (400, 'User location is not supported for the API use.', 'LOCATION_UNSUPPORTED'),
            (400, 'API key not valid. google-test-key', 'INVALID_KEY'),
            (429, 'Private prompt text', 'UPSTREAM_ERROR'),
        ]:
            upstream.side_effect = HTTPError('private-url', status, 'private', {},
                                            io.BytesIO(json.dumps({'error': {'message': message}}).encode()))
            response = self.post()
            self.assertEqual(response.status_code, status)
            self.assertEqual(response.json(), {'error': {'code': code}})

    @patch('app.services.gemini_proxy.urlopen')
    def test_network_and_malformed_responses_are_sanitized(self, upstream):
        for error in [URLError('private detail'), TimeoutError('private detail'), ValueError('private detail')]:
            upstream.side_effect = error
            with self.assertLogs('uvicorn.error', level='WARNING') as logs:
                response = self.post()
            self.assertNotIn('private detail', ' '.join(logs.output))
            expected = ('timeout' if isinstance(error, TimeoutError) else
                        'invalid_json' if isinstance(error, ValueError) else 'network')
            self.assertIn(f'category={expected}', ' '.join(logs.output))
            self.assertEqual(response.status_code, 502)
            self.assertEqual(response.json()['error']['code'],
                             'UPSTREAM_TIMEOUT' if expected == 'timeout' else 'UPSTREAM_UNAVAILABLE')
            self.assertNotIn('private detail', response.text)

    @patch('app.services.gemini_proxy.sleep')
    @patch('app.services.gemini_proxy.urlopen')
    def test_temporary_google_failure_retries_once(self, upstream, sleep):
        body = {'candidates': []}
        result = unittest.mock.MagicMock()
        result.__enter__.return_value = io.BytesIO(json.dumps(body).encode())
        upstream.side_effect = [HTTPError('private', 503, 'private', {}, io.BytesIO(b'{}')), result]
        self.assertEqual(self.post().json(), body)
        self.assertEqual(upstream.call_count, 2)
        sleep.assert_called_once_with(1)
        self.assertGreater(upstream.call_args.kwargs['timeout'], 0)
        self.assertLessEqual(upstream.call_args.kwargs['timeout'], 25)

    @patch('app.services.gemini_proxy.sleep')
    @patch('app.services.gemini_proxy.urlopen')
    def test_persistent_failure_stops_after_one_retry(self, upstream, sleep):
        upstream.side_effect = [HTTPError('private', 503, 'private', {}, io.BytesIO(b'{}')) for _ in range(2)]
        self.assertEqual(self.post().status_code, 503)
        self.assertEqual(upstream.call_count, 2)

    @patch('app.services.gemini_proxy.monotonic', side_effect=[0, 24])
    @patch('app.services.gemini_proxy.sleep')
    @patch('app.services.gemini_proxy.urlopen')
    def test_does_not_retry_when_time_budget_is_exhausted(self, upstream, sleep, clock):
        upstream.side_effect = HTTPError('private', 503, 'private', {}, io.BytesIO(b'{}'))
        self.assertEqual(self.post().status_code, 503)
        upstream.assert_called_once()
        sleep.assert_not_called()


if __name__ == '__main__':
    unittest.main()
