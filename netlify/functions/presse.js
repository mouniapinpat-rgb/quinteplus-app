// Netlify function : scraping automatique des pronos presse
// Source : prono-turf-gratuit.fr (page HTML publique, pas d'API requise)

const JOURS_FR = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS_FR  = ['janvier','fevrier','mars','avril','mai','juin',
                   'juillet','aout','septembre','octobre','novembre','decembre'];

function buildUrl(date) {
  // Format URL : /presse-pmu/meilleurs-pronostics-de-la-presse-quinte-du-JOUR-MOIS-ANNEE/
  // ex: quinte-du-lundi-8-juin-2026
  const d    = new Date(date);
  const jour = JOURS_FR[d.getDay()];
  const num  = d.getDate();
  const mois = MOIS_FR[d.getMonth()];
  const an   = d.getFullYear();
  const slug = `quinte-du-${jour}-${num}-${mois}-${an}`;
  return `https://prono-turf-gratuit.fr/presse-pmu/meilleurs-pronostics-de-la-presse-${slug}/`;
}

function parseTable(html) {
  const picks = {};
  let synthese = [];

  // Extraire le tableau markdown (la page est convertie en markdown par le fetch)
  // Pattern : | Source | num | num | num | ...
  const lines = html.split('\n');
  const SKIP  = ['synthèse', 'gemini', 'perplexity', 'gpt', 'mistral', '---', 'source'];

  for (const line of lines) {
    if (!line.includes('|')) continue;
    const cells = line.split('|').map(c => c.trim().replace(/\*+/g, ''));
    if (cells.length < 4) continue;
    const source = cells[1]?.trim();
    if (!source || SKIP.some(s => source.toLowerCase().includes(s))) {
      // Récupérer la synthèse si présente
      if (source?.toLowerCase().includes('synthèse')) {
        const nums = cells.slice(2).map(c => parseInt(c)).filter(n => !isNaN(n) && n > 0 && n <= 20);
        if (nums.length >= 5) synthese = nums;
      }
      continue;
    }
    const nums = cells.slice(2).map(c => parseInt(c)).filter(n => !isNaN(n) && n > 0 && n <= 20);
    if (nums.length >= 4) picks[source] = nums;
  }

  // Fallback synthèse depuis le texte
  if (!synthese.length) {
    const m = html.match(/les (?:8|numéros)\s+(?:chevaux )?(?:les plus cités[^:]*:?\s*)?\*?\*?(\d+[-–]\d+[-–]\d+[-–]\d+[-–]\d+)/i);
    if (m) synthese = m[1].split(/[-–]/).map(Number).filter(n => n > 0 && n <= 20);
  }

  return { picks, synthese };
}

export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  // Date : paramètre ou aujourd'hui (heure Réunion = UTC+4)
  const reqDate = event.queryStringParameters?.date;
  let date;
  if (reqDate) {
    date = new Date(reqDate);
  } else {
    date = new Date(new Date().getTime() + 4 * 3600000); // UTC+4 La Réunion
  }

  const url = buildUrl(date);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'Referer': 'https://prono-turf-gratuit.fr/',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        statusCode: 404,
        headers: cors,
        body: JSON.stringify({ error: 'Page non trouvée', url, status: res.status }),
      };
    }

    const html = await res.text();
    const { picks, synthese } = parseTable(html);
    const nbSources = Object.keys(picks).length;

    return {
      statusCode: 200,
      headers: { ...cors, 'Cache-Control': 'public,max-age=3600' }, // cache 1h
      body: JSON.stringify({
        date: date.toLocaleDateString('fr-FR'),
        url,
        picks,
        synthese,
        nbSources,
        ok: nbSources >= 3,
      }),
    };
  } catch (err) {
    return {
      statusCode: 503,
      headers: cors,
      body: JSON.stringify({ error: err.message, url }),
    };
  }
}
