import io
import json
import os
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from app.services.groq_service import generate_advice, GroqServiceError


class GroqServiceTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {'GROQ_API_KEY': 'test-key'})
        self.env.start()
        self.addCleanup(self.env.stop)

    def response(self, content):
        return io.BytesIO(json.dumps({'choices': [{'message': {'content': content}}]}).encode())

    @patch('app.services.groq_service.urlopen')
    def test_daily_care_keeps_format_and_server_key(self, send):
        send.return_value = self.response('1. Inspect leaves.\n2. Check soil.\n3. Remove weeds.')
        result = generate_advice('Rice, planted 20 days ago. Tagalog.', 'daily-care')
        self.assertIn('Inspect leaves', result['data'])
        request = send.call_args.args[0]
        payload = json.loads(request.data)
        self.assertIn('three short numbered tasks', payload['messages'][0]['content'])
        self.assertIn('Tagalog', payload['messages'][1]['content'])
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-key')
        self.assertEqual(send.call_args.kwargs['timeout'], 35)

    @patch('app.services.groq_service.urlopen')
    def test_assessment_format_preserved(self, send):
        send.return_value = self.response('Assessment: Healthy. Recommended action: Inspect. References: DA.')
        generate_advice('Assess crop')
        instructions = json.loads(send.call_args.args[0].data)['messages'][0]['content']
        self.assertIn('Assessment:', instructions)
        self.assertIn('https://nshp.bswm.da.gov.ph/fertmap/', instructions)

    @patch('app.services.groq_service.urlopen')
    def test_invalid_prompts_do_not_call_provider(self, send):
        for prompt in [None, {}, '', ' ', 'x' * 12001]:
            with self.assertRaises(GroqServiceError) as error:
                generate_advice(prompt)
            self.assertEqual(error.exception.status_code, 400)
        send.assert_not_called()

    @patch('app.services.groq_service.urlopen')
    def test_missing_key(self, send):
        with patch.dict(os.environ, {'GROQ_API_KEY': ''}):
            with self.assertRaises(GroqServiceError) as error:
                generate_advice('Rice')
        self.assertEqual(error.exception.status_code, 503)
        send.assert_not_called()

    @patch('app.services.groq_service.urlopen')
    def test_invalid_responses(self, send):
        for body in [self.response(''), io.BytesIO(b'{}'), io.BytesIO(b'not json')]:
            send.return_value = body
            with self.assertRaises(GroqServiceError) as error:
                generate_advice('Rice')
            self.assertEqual(error.exception.status_code, 502)

    @patch('app.services.groq_service.urlopen')
    def test_upstream_errors_do_not_expose_secrets(self, send):
        for failure, code in [(HTTPError('https://api.groq.com', 429, 'private', {}, None), 429),
                              (HTTPError('https://api.groq.com', 401, 'private', {}, None), 502),
                              (URLError('private'), 504), (TimeoutError('private'), 504)]:
            send.side_effect = failure
            with self.assertRaises(GroqServiceError) as error:
                generate_advice('Rice')
            self.assertEqual(error.exception.status_code, code)
            self.assertNotIn('private', str(error.exception))


if __name__ == '__main__':
    unittest.main()