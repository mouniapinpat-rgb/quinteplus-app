export async function handler(event) {
  const cors = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
  if (event.httpMethod==='OPTIONS') return {statusCode:200,headers:cors,body:''};
  const path = event.queryStringParameters?.path||'';
  if (!path) return {statusCode:400,headers:cors,body:JSON.stringify({error:'path required'})};

  const isLive = path.includes('citations') || path.includes('rapports') || event.queryStringParameters?.live==='1';
  const cacheAge = isLive ? 30 : 90;

  for (const base of [
    'https://online.turfinfo.api.pmu.fr/rest/client/1',
    'https://offline.turfinfo.api.pmu.fr/rest/client/7',
  ]) {
    try {
      const r = await fetch(base+path, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
          'Referer': 'https://www.pmu.fr/',
        },
        signal: AbortSignal.timeout(9000),
      });
      if (r.ok) return {
        statusCode: 200,
        headers: {...cors, 'Cache-Control': `public,max-age=${cacheAge}`},
        body: await r.text(),
      };
    } catch(_) {}
  }
  return {statusCode:503,headers:cors,body:JSON.stringify({error:'PMU unavailable',offline:true})};
}
