// netlify/functions/deleteBuilds.js

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { names } = payload; // erwartet: { names: ["Build1", "Build2"] }
  if (!Array.isArray(names) || names.some(n => typeof n !== 'string')) {
    return { statusCode: 400, body: 'Invalid names array' };
  }

  const REPO = 'Reso1992/RpXBuilder';
  const BRANCH = 'main';
  const PATH = 'builds.json';
  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) {
    return { statusCode: 500, body: 'Missing GITHUB_TOKEN' };
  }

  // 1. Bestehende builds.json holen
  let sha = null;
  let builds = {};
  try {
    const metaRes = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (!metaRes.ok) throw new Error('Could not fetch metadata');
    const meta = await metaRes.json();
    sha = meta.sha;
    const dataRes = await fetch(meta.download_url);
    builds = await dataRes.json();
  } catch (e) {
    return { statusCode: 500, body: `Failed to load builds.json: ${e.message}` };
  }

  // 2. Lösche die angegebenen Builds
  const removed = [];
  names.forEach(name => {
    if (Object.prototype.hasOwnProperty.call(builds, name)) {
      delete builds[name];
      removed.push(name);
    }
  });

  if (removed.length === 0) {
    return { statusCode: 404, body: 'Keine der angegebenen Builds gefunden.' };
  }

  // 3. Neu codieren und pushen
  const content = Buffer.from(JSON.stringify(builds, null, 2)).toString('base64');
  const putBody = {
    message: `Remove build(s): ${removed.join(', ')}`,
    content,
    branch: BRANCH,
    sha
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
      body: `GitHub API error: ${err.message || JSON.stringify(err)}`
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ removed })
  };
};
