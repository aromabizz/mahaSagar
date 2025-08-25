// ---- CONFIG ----
// Replace with your Cloudflare Worker (or Netlify Function) endpoint
// Example: https://your-worker.subdomain.workers.dev/submit
const WORKER_ENDPOINT = "https://YOUR_WORKER_ENDPOINT/submit";

// Certificate canvas settings (adjust Y position and sizes to match your template)
const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1200;
const NAME_Y = 250;           // Vertical position of the Name
const NAME_MAX_WIDTH = 1000;  // Max width for fitting long names
const NAME_BASE_SIZE = 68;    // Start font size; will shrink if needed

// Template image relative path in the same repo
const TEMPLATE_IMAGE = "./cert-template.png";

// Fonts: ensure the font is loaded before drawing text on canvas
async function ensureFontsLoaded() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  } else {
    // Fallback small delay
    await new Promise(r => setTimeout(r, 300));
  }
}


// Draw the certificate and return a dataURL
async function generateCertificate(name, gender) {
  await ensureFontsLoaded();

  const canvas = document.getElementById("cert-canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");

  // Draw background template
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT); resolve(); };
    img.onerror = reject;
    img.src = TEMPLATE_IMAGE;
  });

  // Prepare name text (prefix + name)
  const label = name;

  // Fit text within max width by reducing font size if necessary
  let fontSize = NAME_BASE_SIZE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  while (fontSize > 32) {
    ctx.font = `700 ${fontSize}px "Noto Serif Devanagari", serif`;
    const w = ctx.measureText(label).width;
    if (w <= NAME_MAX_WIDTH) break;
    fontSize -= 2;
  }

  // Draw name with a soft shadow for readability
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.fillText(label, CANVAS_WIDTH/2 + 3, NAME_Y + 3);
  ctx.fillStyle = "#222222";
  ctx.fillText(label, CANVAS_WIDTH/2, NAME_Y);

  // Return data URL (PNG)
  return canvas.toDataURL("image/png");
}

// Save response via Worker -> GitHub CSV
async function saveResponse(payload) {
  const res = await fetch(WORKER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Save failed (${res.status}): ${t}`);
  }
  return await res.json();
}

function getFormData() {
  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const gender = document.getElementById("gender").value;
  const age = document.getElementById("age").value.trim();
  const email = document.getElementById("email").value.trim();
  const address = document.getElementById("address").value.trim();

  return { name, mobile, gender, age, email, address };
}

document.getElementById("another").addEventListener("click", () => {
  document.getElementById("result-section").classList.add("hidden");
  document.getElementById("form-section").classList.remove("hidden");
  document.getElementById("member-form").reset();
  document.getElementById("save-status").textContent = "";
});

document.getElementById("member-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("submitBtn");
  const status = document.getElementById("form-status");
  btn.disabled = true;
  status.textContent = "Processing...";

  try {
    const data = getFormData();
    if (!data.name) throw new Error("Name is required");

    // 1) Generate certificate image
    const dataURL = await generateCertificate(data.name, data.gender);

    // 2) Show result section and preview
    document.getElementById("form-section").classList.add("hidden");
    document.getElementById("result-section").classList.remove("hidden");

    // Set download link for PNG
    const link = document.getElementById("download-png");
    link.href = dataURL;

    // 3) Save to CSV via Worker (in parallel is okay)
    const payload = {
      ...data,
      timestamp: new Date().toISOString()
    };
    const out = await saveResponse(payload);
    document.getElementById("save-status").textContent = "Responses saved to repository ✓";
  } catch (err) {
    console.error(err);
    alert(err.message || "Something went wrong");
    document.getElementById("save-status").textContent = "Save failed. Please try again.";
  } finally {
    btn.disabled = false;
    status.textContent = "";
  }
});
