// Cloudflare Worker: Append survey responses to a CSV in your GitHub repo
// Set these in Cloudflare Worker Settings -> Variables (Secrets for token):
// GITHUB_TOKEN  (secret)  - Fine-grained PAT with "Contents: Read and Write" scoped to ONE repo
// GITHUB_OWNER  (string)  - e.g., "your-username-or-org"
// GITHUB_REPO   (string)  - e.g., "your-repo"
// GITHUB_BRANCH (string)  - e.g., "main"
// CSV_PATH      (string)  - e.g., "responses.csv"

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Basic CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/submit" && request.method === "POST") {
      try {
        const body = await request.json();
        const row = buildCsvRow(body);
        const result = await appendToCsv(env, row);
        return json({ ok: true, commit: result }, 200);
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    if (url.pathname === "/health") {
      return new Response("ok", { headers: corsHeaders() });
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders() });
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// Ensure CSV fields are properly quoted
function csvEscape(val) {
  const s = (val ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Build a CSV row with a fixed column order
function buildCsvRow(data) {
  const cols = [
    (data.timestamp || new Date().toISOString()),
    data.name || "",
    data.mobile || "",
    data.gender || "",
    data.age || "",
    data.email || "",
    (data.address || "").replace(/\r?\n/g, " ")
  ];
  return cols.map(csvEscape).join(",") + "\n";
}

async function appendToCsv(env, row) {
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const path = env.CSV_PATH || "responses.csv";
  const token = env.GITHUB_TOKEN;

  const base = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;

  // 1) Get current file (if exists)
  const getRes = await fetch(`${base}?ref=${encodeURIComponent(branch)}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mahasagar-worker"
    }
  });

  if (getRes.status === 404) {
    // Create new file with header + first row
    const content = btoa(unescape(encodeURIComponent(
      "timestamp,name,mobile,gender,age,email,address\n" + row
    )));
    const createRes = await fetch(base, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "mahasagar-worker",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Create responses.csv with first entry",
        content,
        branch
      })
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new Error(`Create failed: ${createRes.status} ${t}`);
    }
    return await createRes.json();
  }

  if (!getRes.ok) {
    const t = await getRes.text();
    throw new Error(`Fetch file failed: ${getRes.status} ${t}`);
  }

  const current = await getRes.json(); // has content (base64) and sha
  const existing = decodeBase64(current.content || "");

  const updated = existing + row;
  const content = btoa(unescape(encodeURIComponent(updated)));

  // 2) Update (append) with sha
  const putRes = await fetch(base, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "mahasagar-worker",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Append survey response",
      content,
      sha: current.sha,
      branch
    })
  });

  if (!putRes.ok) {
    const t = await putRes.text();
    throw new Error(`Update failed: ${putRes.status} ${t}`);
  }
  return await putRes.json();
}

function decodeBase64(b64) {
  // atob handles ASCII; we need proper UTF-8 decode
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array([...bin].map(c => c.charCodeAt(0)));
  const dec = new TextDecoder("utf-8");
  return dec.decode(bytes);
}
