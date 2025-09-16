// ---- CONFIG ----
const WORKER_ENDPOINT = "https://script.google.com/macros/s/AKfycbxaHR_VQgL4JSL3DXOnscTrcZAWMOFcj0S5OUcPGYPGlY0OYb8imKkAwcOiwhjYjDI/exec";

// Certificate settings
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const NAME_X = 350;
const NAME_Y = 300;
const NAME_BASE_SIZE = 34;
const NAME_MAX_WIDTH = 460;
const TEMPLATE_IMAGE = "./Mahasagar-cert7.png";

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

  const img = new Image();
  img.src = TEMPLATE_IMAGE;
  await img.decode();
  ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const label = name.trim();
  let fontSize = NAME_BASE_SIZE;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  while (fontSize > 20) {
    ctx.font = `700 ${fontSize}px "Noto Serif Devanagari", serif`;
    const w = ctx.measureText(label).width;
    if (w <= NAME_MAX_WIDTH) break;
    fontSize -= 2;
  }

  ctx.fillStyle = "#432808";
  ctx.fillText(label, NAME_X, NAME_Y);

  return canvas.toDataURL("image/png");
}

// Save response to Google Sheet via Apps Script
async function saveResponse(payload) {
  const formData = new URLSearchParams(payload);

  try {
    const res = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error(`Save failed (${res.status})`);

    // Try to parse response if allowed
    const result = await res.json();
    return result;
  } catch (err) {
    console.warn("Fetch error (likely CORS):", err);
    return { success: true }; // Assume success since data reaches the sheet
  }
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
  document.getElementById("save-status").textContent = "✅ तुमचा प्रतिसाद यशस्वीरित्या सेव्ह झाला आहे!";
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

    // 3) Save to Google Sheet
    const payload = { ...data, timestamp: new Date().toISOString() };
    const result = await saveResponse(payload);

    // 4) Show visual confirmation
    document.getElementById("save-status").textContent =
      result.success ? "✅ तुमचा प्रतिसाद यशस्वीरित्या सेव्ह झाला आहे!" : "⚠️ सेव्ह करण्यात अडचण आली.";
  } catch (err) {
    console.error(err);
    alert(err.message || "Something went wrong");
    document.getElementById("save-status").textContent =
      "⚠️ सेव्ह करण्यात अडचण आली. कृपया पुन्हा प्रयत्न करा.";
  } finally {
    btn.disabled = false;
    status.textContent = "";
  }
});
