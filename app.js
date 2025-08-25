// ---- CONFIG ----
// Replace with your Cloudflare Worker endpoint
const WORKER_ENDPOINT = "https://YOUR_WORKER_ENDPOINT/submit";

// Certificate settings
const CANVAS_WIDTH = 960;    // certificate width
const CANVAS_HEIGHT = 720;   // certificate height
const NAME_X = 230;          // X position (just after श्री/श्रीमती)
const NAME_Y = 220;          // Y position (same line as श्री/श्रीमती)
const NAME_BASE_SIZE = 36;   // starting font size
const NAME_MAX_WIDTH = 460;  // maximum name width

// Template image
const TEMPLATE_IMAGE = "./cert-template.png";

// Ensure fonts are loaded
async function ensureFontsLoaded() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  } else {
    await new Promise(r => setTimeout(r, 300));
  }
}

// Generate certificate
async function generateCertificate(name) {
  await ensureFontsLoaded();

  const canvas = document.getElementById("cert-canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");

  // Draw certificate background
  const img = new Image();
  img.src = TEMPLATE_IMAGE;
  await img.decode();
  ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Prepare name
  const label = name.trim();

  // Fit font size if name is long
  let fontSize = NAME_BASE_SIZE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  while (fontSize > 20) {
    ctx.font = `700 ${fontSize}px "Noto Serif Devanagari", serif`;
    const w = ctx.measureText(label).width;
    if (w <= NAME_MAX_WIDTH) break;
    fontSize -= 2;
  }

  // Draw text
  ctx.fillStyle = "#222222";
  ctx.fillText(label, NAME_X, NAME_Y);

  return canvas.toDataURL("image/png");
}

// Save response to GitHub via Worker
async function saveResponse(payload) {
  const res = await fetch(WORKER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Save failed (${res.status}): ${t}`);
  }
  return await res.json();
}

// Collect form data
function getFormData() {
  const name = document.getElementById("name").value.trim();
  const mobile = document.getElementById("mobile").value.trim();
  const gender = document.getElementById("gender").value;
  const age = document.getElementById("age").value.trim();
  const email = document.getElementById("email").value.trim();
  const address = document.getElementById("address").value.trim();

  return { name, mobile, gender, age, email, address };
}

// Reset form
document.getElementById("another").addEventListener("click", () => {
  document.getElementById("result-section").classList.add("hidden");
  document.getElementById("form-section").classList.remove("hidden");
  document.getElementById("member-form").reset();
  document.getElementById("save-status").textContent = "";
});

// On form submit
document.getElementById("member-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = document.getElementById("submitBtn");
  const status = document.getElementById("form-status");
  btn.disabled = true;
  status.textContent = "Processing...";

  try {
    const data = getFormData();
    if (!data.name) throw new Error("Name is required");

    // 1) Generate certificate
    const dataURL = await generateCertificate(data.name);

    // 2) Show result
    document.getElementById("form-section").classList.add("hidden");
    document.getElementById("result-section").classList.remove("hidden");
    document.getElementById("download-png").href = dataURL;

    // 3) Save to repo
    const payload = { ...data, timestamp: new Date().toISOString() };
    await saveResponse(payload);
    document.getElementById("save-status").textContent =
      "Responses saved to repository ✓";
  } catch (err) {
    console.error(err);
    alert(err.message || "Something went wrong");
    document.getElementById("save-status").textContent =
      "Save failed. Please try again.";
  } finally {
    btn.disabled = false;
    status.textContent = "";
  }
});
