# महासागर फाउंडेशन — Survey + Auto Certificate (GitHub Pages + CSV in Repo)

This starter lets you host a **frontend-only webapp** on GitHub Pages. It:
1) Captures survey form data
2) Generates a **certificate** image (PNG) with the participant's name
3) Appends responses to a **CSV file in the same repo** via a tiny **Cloudflare Worker** (serverless), so your token stays safe.

---

## 🔧 Setup Steps

### A. Prepare Repository
1. Create a new GitHub repo (public or private).
2. Put these files in the root of the repo:
   - `index.html`
   - `app.js`
   - `cert-template.png` (replace the placeholder with your real template)
   - `responses.csv` (optional; the worker will create it if missing)
   - `README.md` (optional)

3. Enable **GitHub Pages** (Settings → Pages → Source = `main`/`docs` etc.).
4. Visit your site URL, e.g. `https://<username>.github.io/<repo>/`

### B. Export Your Certificate Template
1. Open your PPTX (सदस्यत्व प्रमाणपत्र.pptx).
2. Export the certificate slide as **PNG** at **1920×1080**.
3. Save it as `cert-template.png` and commit it to the repo (replace the placeholder).

> Tip: Keep the name area empty on the image; the app overlays the name at runtime.
> Adjust `NAME_Y`, `NAME_BASE_SIZE`, `NAME_MAX_WIDTH` in `app.js` as needed.

### C. Cloudflare Worker (Serverless) for CSV Writing
We need a small backend to write to your repo without exposing a token in the browser.

1. Create a **fine‑grained GitHub Personal Access Token** with:
   - **Repository contents: Read and Write**
   - Scoped to **only this repository**

2. Create a **Cloudflare Worker** (free tier is fine):
   - Dashboard → Workers → Create.
   - Paste contents of `worker.js`.
   - Add **Environment Variables**:
     - `GITHUB_TOKEN` (Secret) : your fine‑grained PAT
     - `GITHUB_OWNER` : your GitHub username or org
     - `GITHUB_REPO` : your repository name
     - `GITHUB_BRANCH` : `main` (or your default)
     - `CSV_PATH` : `responses.csv`

   - Deploy the worker and note its URL, e.g. `https://xyz.workers.dev`

3. In `app.js`, set:
   ```js
   const WORKER_ENDPOINT = "https://xyz.workers.dev/submit";
   ```

### D. Test End‑to‑End
1. Open your GitHub Pages site.
2. Fill the form → Submit.
3. You should see a **certificate preview** and a **Download PNG** button.
4. In your repo, open `responses.csv` → new row should be appended.

---

## 🛠 Tweaks
- **Name position/size**: change `NAME_Y`, `NAME_BASE_SIZE`, `NAME_MAX_WIDTH` in `app.js`.
- **Gender prefix** (`श्री/श्रीमती`) auto‑picks from gender; edit `genderTitle()` if needed.
- **PDF instead of PNG**: you can add jsPDF and convert the canvas to PDF if you like.
- **Security**: Never embed your GitHub token in the frontend. Keep it only in the Worker.

---

## 🧪 Health Check
Open `https://your-worker/health` to see `"ok"`.

---

## 🙌 Credits
- Canvas rendering uses browser text shaping, suitable for Devanagari (Marathi).
- Tailwind CSS for quick styling.
