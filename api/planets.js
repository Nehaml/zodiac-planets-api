export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const BODIES = {
    Sun:'10', Moon:'301', Mercury:'199', Venus:'299', Mars:'499',
    Jupiter:'599', Saturn:'699', Uranus:'799', Neptune:'899', Pluto:'999',
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

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    // Fetch one by one with delay to avoid rate limiting
    for (const [name, code] of Object.entries(BODIES)) {
      try {
        const lon = await fetchPlanet(code);
        if (lon !== null) {
          results[name] = {
            longitude: lon,
            sign: lonToSign(lon),
            degree: lonToDeg(lon),
          };
        } else {
          results[name] = { error: 'parse failed' };
        }
      } catch (e) {
        results[name] = { error: e.message };
      }
      await sleep(200); // 200ms gap between each request
    }

    res.status(200).json({
      success: true,
      date: new Date().toISOString(),
      planets: results,
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
