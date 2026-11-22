import { parseFertilizerAdvice } from '../../lib/fertilizerAdvice';
const reply = (recommendations: unknown, assessment = ' Check soil first ') => JSON.stringify({ assessment, recommendations });
test('uses trusted catalog metadata and trims text', () => {
  const result = parseFertilizerAdvice(reply([{ id: 'urea', reason: ' Low N ', name: 'untrusted' }]));
  expect(result.assessment).toBe('Check soil first');
  expect(result.recommendations[0]).toMatchObject({ id: 'urea', reason: 'Low N', inDataset: true, name: 'Urea (Nitrogen rich fertilizer)' });
  expect(result.recommendations[0].sources.length).toBeGreaterThan(0);
});
test.each([null, {}, [{id:'unknown',reason:'x'}], [{id:'urea',reason:''}], [{id:'urea',reason:'x'},{id:'urea',reason:'y'}], Array(4).fill({id:'urea',reason:'x'})])('rejects malformed or duplicate recommendations: %j', rows => {
  expect(() => parseFertilizerAdvice(reply(rows))).toThrow();
});
test.each(['', ' '.repeat(2), 'x'.repeat(3001)])('rejects invalid assessments', text => expect(() => parseFertilizerAdvice(reply([], text))).toThrow());
test('rejects invalid JSON', () => expect(() => parseFertilizerAdvice('not json')).toThrow());
