// Vercel serverless function — proxies NASA JPL Horizons API
// Returns geocentric tropical zodiac positions for all planets

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const BODIES = {
    Sun:'10',Moon:'301',Mercury:'199',Venus:'299',Mars:'499',
    Jupiter:'599',Saturn:'699',Uranus:'799',Neptune:'899',Pluto:'999',
  };

  const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  function lonToSign(lon) {
    const n = ((lon % 360) + 360) % 360;
    return SIGNS[Math.floor(n / 30)];
  }

  function lonToDeg(lon) {
    const n = ((lon % 360) + 360) % 360;
    return parseFloat((n % 30).toFixed(2));
  }

  function parseLon(text) {
    const soe = text.indexOf('$$SOE');
    const eoe = text.indexOf('$$EOE');
    if (soe === -1 || eoe === -1) return null;
    const block = text.substring(soe + 5, eoe).trim();
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      for (let i = 0; i < parts.length; i++) {
        const val = parseFloat(parts[i]);
        if (!isNaN(val) && val >= 0 && val < 360) {
          const next = parseFloat(parts[i + 1]);
          if (!isNaN(next) && next >= -90 && next <= 90) return val;
        }
      }
    }
    return null;
  }

  async function fetchPlanet(code) {
    const now = new Date();
    const start = now.toISOString().split('T')[0];
    const stop = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
    const url = `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${code}'&CENTER='500@399'&EPHEM_TYPE='OBSERVER'&QUANTITIES='31'&START_TIME='${start}'&STOP_TIME='${stop}'&STEP_SIZE='1d'&OBJ_DATA='NO'&MAKE_EPHEM='YES'`;
    const r = await fetch(url);
    const data = await r.json();
    return parseLon(data.result || '');
  }

  try {
    const results = {};
    const entries = Object.entries(BODIES);
    const fetched = await Promise.all(
      entries.map(([name, code]) =>
        fetchPlanet(code)
          .then(lon => ({ name, lon, ok: lon !== null }))
          .catch(() => ({ name, lon: null, ok: false }))
      )
    );
    for (const { name, lon, ok } of fetched) {
      results[name] = ok && lon !== null
        ? { longitude: lon, sign: lonToSign(lon), degree: lonToDeg(lon) }
        : { error: 'fetch failed' };
    }
    res.status(200).json({ success: true, date: new Date().toISOString(), planets: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
