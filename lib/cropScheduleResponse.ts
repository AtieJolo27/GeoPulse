/** Hosting can return HTML (e.g. an undeployed route), even for a JSON request. */
export async function readCropScheduleResponse(response: Response): Promise<unknown> {
  const text = (await response.text()).replace(/^\uFEFF/, '').trim();
  let body;
  try { body = JSON.parse(text); }
  catch {
    if (response.status === 404 || /<!doctype|<html/i.test(text)) throw new Error('The AI calendar service is not available on this server yet. Deploy the updated API, then try again. You can still mark dates manually.');
    throw new Error('The AI calendar service returned an unreadable response. Please try again.');
  }
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : `AI calendar request failed (${response.status}). Please try again.`);
  if (!body || typeof body !== 'object') throw new Error('AI returned an invalid calendar. Please try again.');
  return body;
}
