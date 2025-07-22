// netlify/functions/saveBuilds.js

// Netlify Functions Bundle (Node 18+) stellt fetch global bereit.
// Falls Du auf einer älteren Node-Version landest, müsstest Du node-fetch importieren.

// Handler exportieren
exports.handler = async function(event, context) {
  // Nur POST zulassen
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  // Request payload parsen
  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: 'Invalid JSON'
    };
  }
  const { name, slots } = payload;
  if (!name || typeof slots !== 'object') {
    return {
      statusCode: 400,
      body: 'Missing build name or slots'
    };
  }

  // GitHub‐Konfiguration
  const REPO   = 'Reso1992/RpXBuilder';
  const BRANCH = 'main';
  const PATH   = 'builds.json';
  const TOKEN  = process.env.GITHUB_TOKEN;

  if (!TOKEN) {
    return {
      statusCode: 500,
      body: 'Missing GITHUB_TOKEN environment variable'
    };
  }

  // 1) Bestehende builds.json auslesen, um den SHA zu bekommen
  let sha = null;
  let builds = {};
  try {
    const metaRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      sha = metaData.sha;
      // Download der eigentlichen JSON
      const dataRes = await fetch(metaData.download_url);
      builds = await dataRes.json();
    }
  } catch (e) {
    // Datei existiert noch nicht – wir legen sie neu an
    builds = {};
  }

  // 2) Neuen Build hinzufügen
  builds[name] = { slots };

  // 3) builds.json als Base64 kodieren
  const content = Buffer.from(JSON.stringify(builds, null, 2)).toString('base64');

  // 4) PUT-Request, um builds.json in Dein Repo zu schreiben
  const putBody = {
    message: sha
      ? `Update builds.json: ${name}`
      : `Create builds.json: ${name}`,
    content,
    branch: BRANCH,
    ...(sha && { sha })
  };

  const putRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${PATH}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(putBody)
    }
  );

  if (!putRes.ok) {
    const err = await putRes.json();
    return {
      statusCode: putRes.status,
      body: `GitHub API Error: ${err.message||JSON.stringify(err)}`
    };
  }

  // 5) Erfolg!
  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true })
  };
};
