export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const path = event.queryStringParameters?.path || '';
  if (!path) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'path required' }) };

  const urls = [
    `https://online.turfinfo.api.pmu.fr/rest/client/1${path}`,
    `https://offline.turfinfo.api.pmu.fr/rest/client/7${path}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          'Referer': 'https://www.pmu.fr/',
        },
        signal: AbortSignal.timeout(9000),
      });
      if (res.ok) {
        const body = await res.text();
        return { statusCode: 200, headers: { ...cors, 'Cache-Control': 'public,max-age=90' }, body };
      }
    } catch (_) {}
  }

  return { statusCode: 503, headers: cors, body: JSON.stringify({ error: 'PMU unavailable', offline: true }) };
}
