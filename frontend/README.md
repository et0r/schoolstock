# SchoolStock — Inventory Management System (Frontend)

> **CSBC 252: Introduction to Cloud Computing — Capstone Project**
> Group frontend codebase. The backend (Node.js/Express on AWS EC2) and database (MySQL on AWS RDS) are separately owned and already deployed.

---

## What This Is

SchoolStock is a cloud-based inventory management system built for school use. This repository contains **only the frontend** — a multi-file static web application built with plain HTML, CSS, and vanilla JavaScript (no framework, no build step). It communicates with a live REST API hosted on an AWS EC2 instance and is designed to be served as simple static files from any web server, S3 bucket, or even opened directly in a browser during development.

The backend API (Express.js), database schema (MySQL on RDS), and S3 image storage bucket are all separate, pre-existing dependencies — this frontend consumes them but does not own or modify them.

---

## Configuration

**There is exactly one place to set the backend URL:**

```
js/config.js
```

Open that file and change `API_BASE`:

```js
// js/config.js
export const API_BASE = 'http://localhost:5000';          // local dev
// export const API_BASE = 'http://<your-ec2-ip>:5000';  // production
```

> **⚠ You must update `API_BASE` before deploying.** If this value is wrong, every API call in the app will silently point at the wrong server. The current value (`localhost:5000`) is correct for local development only.

The rest of the codebase never hard-codes the backend URL. Every `fetch` call goes through `js/api.js`, which prepends `API_BASE` automatically.

---

## Local Development

No build tools, no npm, no Node required on your machine to *run* the frontend.

### Option A — `npx serve` (recommended, requires Node/npm)

```bash
cd schoolstock/frontend
npx serve .
```

This starts a local static file server (usually at `http://localhost:3000`) and correctly resolves absolute paths like `/js/config.js`. This is the most reliable method.

### Option B — VS Code Live Server extension

Install the **Live Server** extension in VS Code, right-click `index.html` → **Open with Live Server**. It handles path resolution automatically.

### Option C — Direct file open (limited)

Opening `index.html` directly from the filesystem (`file:///...`) will **not work** because browsers block ES module imports across `file://` origins. Use Option A or B instead.

> **CORS note during local dev:** When your frontend runs on `localhost:3000` and the backend is on a different origin, the browser will make cross-origin requests. This is expected and supported — the backend already has `cors()` middleware enabled (see `server.js` line 8). No additional configuration is needed.

---

## Production Deployment

We recommend serving the frontend **from the same EC2 instance as the backend**, using Nginx as a reverse proxy. This approach:
- Avoids cross-origin issues (frontend and API share the same domain/IP)
- Is free within AWS Free Tier (no extra services)
- Is easy to update (just copy files via `scp` or `git pull`)
- Requires no separate S3 static hosting configuration

### Step-by-step: Nginx on EC2

**1. Install Nginx (Amazon Linux 2 / Ubuntu)**

```bash
# Amazon Linux 2:
sudo yum install -y nginx

# Ubuntu:
sudo apt update && sudo apt install -y nginx
```

**2. Copy the frontend files to the server**

```bash
# From your local machine:
scp -r ./frontend/* ec2-user@<your-ec2-ip>:/var/www/schoolstock/
```

Or on the server:
```bash
sudo mkdir -p /var/www/schoolstock
sudo git -C /var/www/schoolstock pull  # if repo is cloned on the server
```

**3. Update `js/config.js` on the server**

```bash
sudo nano /var/www/schoolstock/js/config.js
# Change API_BASE to your actual backend URL, e.g.:
# export const API_BASE = 'http://<your-ec2-ip>:5000';
```

**4. Configure Nginx**

Create `/etc/nginx/conf.d/schoolstock.conf`:

```nginx
server {
    listen 80;
    server_name _;  # replace with your domain or EC2 public DNS if you have one

    # Serve the static frontend
    root /var/www/schoolstock;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Proxy API calls to the backend on the same machine
    # This eliminates the need to expose port 5000 publicly
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**5. Enable and start Nginx**

```bash
sudo systemctl enable nginx
sudo systemctl start nginx
# or restart if already running:
sudo systemctl restart nginx
```

**6. Open port 80 in your EC2 Security Group**

In the AWS Console → EC2 → Security Groups → your instance's group → Inbound rules → Add:
- Type: HTTP, Port: 80, Source: 0.0.0.0/0

**7. Open the app**

Navigate to `http://<your-ec2-public-ip>/` in your browser.

> **If you use the `/api/` proxy block** in Nginx (step 4), set `API_BASE = ''` (empty string) in `js/config.js` so requests go to the same origin. If you proxy, you can also remove port 5000 from the Security Group inbound rules, improving security.

---

## CORS Note

The backend enables CORS for all origins via `app.use(cors())` in `server.js`. This means requests from any frontend origin (localhost, EC2 IP, custom domain) are accepted without modification.

> **If the frontend origin ever changes** (e.g. you move to a custom domain or add HTTPS), and you later tighten the CORS policy to specific origins, you must update the backend's `cors()` options to allowlist the new origin. As long as the backend uses the open `cors()` default, no changes are needed here.

---

## Project Structure

```
frontend/
├── index.html          Login page (app entry point)
├── register.html       Registration page
├── dashboard.html      Dashboard with stats and activity feed
├── products.html       Products list with add/edit/delete
├── movements.html      Stock movement history + record movement
├── suppliers.html      Supplier directory + add supplier
├── alerts.html         Low stock and out-of-stock alert list
│
├── css/
│   ├── theme.css       Design system: tokens, reset, layout, shared components
│   └── pages.css       Page-specific styles
│
├── js/
│   ├── config.js       ← THE ONE PLACE to set API_BASE
│   ├── api.js          Fetch wrapper (auth headers, error handling, 401 redirect)
│   ├── auth.js         Session management (localStorage JWT + user object)
│   ├── nav.js          Sidebar renderer, XSS escaper, shared UI helpers
│   ├── dashboard.js    Dashboard page logic
│   ├── products.js     Products CRUD logic
│   ├── movements.js    Stock movements logic
│   ├── suppliers.js    Suppliers logic
│   └── alerts.js       Alerts page logic
│
└── README.md           ← You are here
```

All JS files use ES modules (`<script type="module">`). No bundler is required — the browser resolves imports natively. This is why a local HTTP server (not `file://`) is needed for development.

---

## Known Limitations

1. **Image upload only works on Add (POST), not Edit (PUT).** The backend uses `multer` middleware only on the `POST /api/items` route; `PUT /api/items/:id` does not accept `multipart/form-data`. Editing a product's image is therefore not supported in this UI — the existing image URL is preserved on updates. If the backend is updated to support `PUT` with `multipart/form-data`, the `saveProduct()` function in `js/products.js` can be updated to match.

2. **No pagination.** All items, transactions, and suppliers are fetched in a single request. For a production system with thousands of records, server-side pagination should be added to the API and frontend table components.

3. **No HTTPS.** The EC2 deployment above uses plain HTTP (port 80). For production, add a TLS certificate via Let's Encrypt / Certbot. This is out of scope for the capstone but is required before handling any sensitive data in a real-world deployment.

4. **Token expiry is silent on page load.** The 12-hour JWT expiry is enforced at the API layer. If a user's token expires while they have a tab open, the next API call will receive a 401, which `api.js` handles by clearing the session and redirecting to login. There is no proactive expiry countdown in the UI.

5. **No image deletion from S3.** When a product is deleted, its image (if any) remains in the S3 bucket. The backend also notes this limitation in a comment in `itemController.js`. Cleanup would require a separate S3 API call on the backend, which is out of scope.

6. **`/api/categories` and `/api/departments` may not be live.** These routes are referenced in the API spec but are not present in the `server.js` file in this repository. If these endpoints are not deployed, the Category and Department dropdowns in the Add/Edit Product form will be empty. The form will still submit, but the backend will return a 400 error if `category_id` or `department_id` is required. Contact the backend team to confirm the full route list on the live EC2 instance.

---

## Tech Stack Summary

| Layer     | Technology                         |
|-----------|------------------------------------|
| Frontend  | HTML5, CSS3 (custom properties), Vanilla JS (ES Modules) |
| Icons     | Font Awesome 6.4.0 (CDN)           |
| Fonts     | Inter via Google Fonts (CDN)       |
| Backend   | Node.js / Express (separate repo)  |
| Database  | MySQL on AWS RDS (separate)        |
| Storage   | AWS S3 (image uploads, separate)   |
| Hosting   | AWS EC2 (backend + static frontend via Nginx) |

---

*SchoolStock — CSBC 252 Capstone Project*
