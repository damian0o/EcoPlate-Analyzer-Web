# Upload Experiment Data via GitHub PR — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow authenticated users to upload xlsx files and metadata via the web app, creating a PR on EcoPlate-Data repo.

**Architecture:** GitHub Device Flow OAuth for client-side auth (no server needed). New "Upload" tab in the Analyzer Web app with file picker + metadata form. Uses GitHub API to create a branch, commit files, and open a PR on damian0o/EcoPlate-Data.

**Tech Stack:** GitHub Device Flow OAuth, GitHub REST API (Contents + Pulls), vanilla JS (ES modules)

---

### Prerequisites

Before starting implementation, create a GitHub OAuth App:
1. Go to GitHub Settings > Developer Settings > OAuth Apps > New OAuth App
2. Application name: `EcoPlate Analyzer`
3. Homepage URL: `https://damian0o.github.io/EcoPlate-Analyzer-Web/`
4. Authorization callback URL: `https://damian0o.github.io/EcoPlate-Analyzer-Web/` (not used for device flow but required)
5. Enable Device Flow in the app settings
6. Note the **Client ID** (no client secret needed for device flow)

---

### Task 1: GitHub Auth Module (`js/github-auth.js`)

**Files:**
- Create: `js/github-auth.js`

**Step 1: Create the auth module**

```javascript
// js/github-auth.js
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Replace after creating OAuth App
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';

let accessToken = localStorage.getItem('gh_token');
let ghUser = null;

export function isAuthenticated() {
  return !!accessToken;
}

export function getToken() {
  return accessToken;
}

export function getUser() {
  return ghUser;
}

export async function validateToken() {
  if (!accessToken) return false;
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` }
    });
    if (res.ok) {
      ghUser = await res.json();
      return true;
    }
    logout();
    return false;
  } catch {
    return false;
  }
}

export async function startDeviceFlow() {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'public_repo' })
  });
  if (!res.ok) throw new Error('Failed to start device flow');
  return res.json();
  // Returns: { device_code, user_code, verification_uri, expires_in, interval }
}

export async function pollForToken(deviceCode, interval) {
  const poll = () => fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  }).then(r => r.json());

  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const data = await poll();
        if (data.access_token) {
          clearInterval(timer);
          accessToken = data.access_token;
          localStorage.setItem('gh_token', accessToken);
          ghUser = await fetch('https://api.github.com/user', {
            headers: { Authorization: `token ${accessToken}` }
          }).then(r => r.json());
          resolve(data.access_token);
        } else if (data.error === 'expired_token') {
          clearInterval(timer);
          reject(new Error('Device code expired. Please try again.'));
        }
        // 'authorization_pending' and 'slow_down' — keep polling
        if (data.error === 'slow_down') {
          interval += 5;
        }
      } catch (e) {
        clearInterval(timer);
        reject(e);
      }
    }, interval * 1000);
  });
}

export function logout() {
  accessToken = null;
  ghUser = null;
  localStorage.removeItem('gh_token');
}
```

**Step 2: Commit**

```bash
git add js/github-auth.js
git commit -m "feat: add GitHub Device Flow auth module"
```

---

### Task 2: GitHub API Module (`js/github-api.js`)

**Files:**
- Create: `js/github-api.js`

**Step 1: Create the API module for creating PRs**

```javascript
// js/github-api.js
import { getToken } from './github-auth.js';

const REPO_OWNER = 'damian0o';
const REPO_NAME = 'EcoPlate-Data';
const API_BASE = 'https://api.github.com';

async function ghFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${getToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API error: ${res.status}`);
  }
  return res.json();
}

export async function createPR({ filename, fileContent, metadata }) {
  // 1. Get main branch SHA
  const mainRef = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/ref/heads/main`);
  const baseSha = mainRef.object.sha;

  // 2. Create branch
  const branchName = `upload/${filename.replace('.xlsx', '')}-${Date.now()}`;
  await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha })
  });

  // 3. Upload xlsx file (base64)
  await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filename}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `data: add ${filename}`,
      content: fileContent, // base64 encoded
      branch: branchName
    })
  });

  // 4. Upload metadata file
  const metaFilename = `metadata/${filename.replace('.xlsx', '.json')}`;
  await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/contents/${metaFilename}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `data: add metadata for ${filename}`,
      content: btoa(JSON.stringify(metadata, null, 2)),
      branch: branchName
    })
  });

  // 5. Create PR
  const pr = await ghFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `Add experiment: ${metadata.name || filename}`,
      body: `## New Experiment Upload\n\n` +
        `**File:** ${filename}\n` +
        `**Author:** ${metadata.author || 'N/A'}\n` +
        `**Date:** ${metadata.date || 'N/A'}\n` +
        `**Description:** ${metadata.description || 'N/A'}\n\n` +
        `Uploaded via EcoPlate Analyzer Web`,
      head: branchName,
      base: 'main'
    })
  });

  return pr;
}
```

**Step 2: Commit**

```bash
git add js/github-api.js
git commit -m "feat: add GitHub API module for creating PRs"
```

---

### Task 3: Upload Tab UI (`js/tabs/upload-tab.js`)

**Files:**
- Create: `js/tabs/upload-tab.js`

**Step 1: Create the upload tab module**

```javascript
// js/tabs/upload-tab.js
import { isAuthenticated, validateToken, startDeviceFlow, pollForToken, logout, getUser } from '../github-auth.js';
import { createPR } from '../github-api.js';

export function initUploadTab() {
  renderUploadTab();
}

function renderUploadTab() {
  const container = document.getElementById('upload-content');
  container.innerHTML = '<div id="auth-section"></div><div id="upload-form-section"></div>';
  renderAuthSection();
}

function renderAuthSection() {
  const section = document.getElementById('auth-section');

  if (isAuthenticated()) {
    validateToken().then(valid => {
      if (valid) {
        const user = getUser();
        section.innerHTML = `
          <div class="flex gap-1" style="align-items:center;margin-bottom:1rem">
            <span class="text-teal" style="font-weight:600">Signed in as ${user.login}</span>
            <button id="logout-btn" class="btn btn-secondary btn-sm">Sign out</button>
          </div>`;
        document.getElementById('logout-btn').addEventListener('click', () => {
          logout();
          renderAuthSection();
          renderFormSection();
        });
        renderFormSection();
      } else {
        renderSignInButton(section);
      }
    });
  } else {
    renderSignInButton(section);
  }
}

function renderSignInButton(section) {
  section.innerHTML = `
    <div style="margin-bottom:1rem">
      <p class="text-muted mb-1">Sign in with GitHub to upload experiment data.</p>
      <button id="signin-btn" class="btn btn-primary">Sign in with GitHub</button>
    </div>
    <div id="device-flow-status"></div>`;
  document.getElementById('signin-btn').addEventListener('click', handleSignIn);
  document.getElementById('upload-form-section').innerHTML = '';
}

async function handleSignIn() {
  const status = document.getElementById('device-flow-status');
  const btn = document.getElementById('signin-btn');
  btn.disabled = true;
  try {
    const { device_code, user_code, verification_uri, interval } = await startDeviceFlow();
    status.innerHTML = `
      <div class="message info">
        <p>Open <a href="${verification_uri}" target="_blank" style="font-weight:600">${verification_uri}</a> and enter code:</p>
        <p style="font-size:1.5rem;font-weight:700;letter-spacing:0.15em;margin:0.5rem 0">${user_code}</p>
        <p class="text-muted">Waiting for authorization...</p>
      </div>`;
    await pollForToken(device_code, interval);
    renderAuthSection();
  } catch (e) {
    status.innerHTML = `<div class="message error">${e.message}</div>`;
    btn.disabled = false;
  }
}

function renderFormSection() {
  const section = document.getElementById('upload-form-section');
  section.innerHTML = `
    <h2 class="section-heading">Upload Experiment</h2>
    <div class="metadata-panel" style="max-width:500px">
      <label for="upload-name">Experiment Name</label>
      <input type="text" id="upload-name" placeholder="e.g. experiment_003">

      <label for="upload-desc">Description</label>
      <textarea id="upload-desc" rows="3" placeholder="Describe the experiment..."></textarea>

      <label for="upload-author">Author</label>
      <input type="text" id="upload-author" placeholder="Your name">

      <label for="upload-date">Date</label>
      <input type="date" id="upload-date">

      <label for="upload-tags">Tags (comma separated)</label>
      <input type="text" id="upload-tags" placeholder="e.g. soil, heavy-metals">

      <label for="upload-file">XLSX File</label>
      <input type="file" id="upload-file" accept=".xlsx">

      <div class="mt-2">
        <button id="upload-submit-btn" class="btn btn-primary">Create Pull Request</button>
      </div>
    </div>
    <div id="upload-message" class="mt-1"></div>`;

  document.getElementById('upload-submit-btn').addEventListener('click', handleSubmit);
}

async function handleSubmit() {
  const name = document.getElementById('upload-name').value.trim();
  const description = document.getElementById('upload-desc').value.trim();
  const author = document.getElementById('upload-author').value.trim();
  const date = document.getElementById('upload-date').value;
  const tags = document.getElementById('upload-tags').value.split(',').map(t => t.trim()).filter(Boolean);
  const fileInput = document.getElementById('upload-file');
  const msgEl = document.getElementById('upload-message');
  const btn = document.getElementById('upload-submit-btn');

  // Validation
  const errors = [];
  if (!name) errors.push('Experiment name is required');
  if (!fileInput.files.length) errors.push('Please select an XLSX file');
  if (errors.length) {
    msgEl.innerHTML = `<div class="message error">${errors.join('<br>')}</div>`;
    return;
  }

  const file = fileInput.files[0];
  const filename = name.replace(/\s+/g, '_') + '.xlsx';

  btn.disabled = true;
  btn.textContent = 'Creating PR...';
  msgEl.innerHTML = '<div class="message info">Uploading to GitHub...</div>';

  try {
    // Read file as base64
    const fileContent = await readFileAsBase64(file);

    const metadata = { name, description, author, date, tags };
    const pr = await createPR({ filename, fileContent, metadata });

    msgEl.innerHTML = `
      <div class="message success">
        Pull request created! <a href="${pr.html_url}" target="_blank" style="font-weight:600">View PR #${pr.number}</a>
      </div>`;
    btn.textContent = 'Create Pull Request';
    btn.disabled = false;
  } catch (e) {
    msgEl.innerHTML = `<div class="message error">Failed: ${e.message}</div>`;
    btn.textContent = 'Create Pull Request';
    btn.disabled = false;
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // strip data URL prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

**Step 2: Commit**

```bash
git add js/tabs/upload-tab.js
git commit -m "feat: add upload tab with metadata form and PR creation"
```

---

### Task 4: Wire Upload Tab into App

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Step 1: Add Upload tab button and section to `index.html`**

In `index.html`, add the Upload tab button after Tests:
```html
<button class="tab-btn" data-tab="upload">Upload</button>
```

Add the Upload section after `tab-tests`:
```html
<section id="tab-upload" class="tab-content">
  <div id="upload-content"></div>
</section>
```

**Step 2: Import and init upload tab in `js/app.js`**

Add import:
```javascript
import { initUploadTab } from './tabs/upload-tab.js';
```

Add init call in `DOMContentLoaded`:
```javascript
initUploadTab();
```

**Step 3: Commit**

```bash
git add index.html js/app.js
git commit -m "feat: wire upload tab into app navigation"
```

---

### Task 5: Update EcoPlate-Data to Support Metadata

**Files:**
- Modify: `EcoPlate-Data/convert.py` — include metadata in index.json output
- Modify: `EcoPlate-Data/.github/workflows/convert-xlsx.yml` — include metadata dir
- Modify: `EcoPlate-Data/index.html` — display metadata on landing page

**Step 1: Update `convert.py` to merge metadata into index.json**

```python
import pandas as pd
import json
import glob
import os

def convert_xlsx_to_json(xlsx_path):
    wave_590 = pd.read_excel(xlsx_path, usecols='B:M', skiprows=lambda x: x < 5 or x > 13, header=None)
    wave_720 = pd.read_excel(xlsx_path, usecols='B:M', skiprows=lambda x: x < 18 or x > 26, header=None)
    wave = round((wave_590 - wave_720), 3)
    matrices = []
    for start_col in range(0, 12, 4):
        matrix = wave.iloc[:, start_col:start_col + 4].values.tolist()
        matrices.append(matrix)
    return {"filename": os.path.basename(xlsx_path), "matrices": matrices}

def load_metadata(xlsx_basename):
    meta_path = f"metadata/{xlsx_basename}.json"
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            return json.load(f)
    return {}

def main():
    xlsx_files = glob.glob("*.xlsx")
    index = []
    for xlsx_path in xlsx_files:
        basename = os.path.splitext(os.path.basename(xlsx_path))[0]
        json_filename = f"{basename}.json"
        data = convert_xlsx_to_json(xlsx_path)
        with open(json_filename, "w") as f:
            json.dump(data, f, indent=2)
        entry = {"name": json_filename, "source": os.path.basename(xlsx_path)}
        metadata = load_metadata(basename)
        if metadata:
            entry["metadata"] = metadata
        index.append(entry)
    with open("index.json", "w") as f:
        json.dump(index, f, indent=2)

if __name__ == "__main__":
    main()
```

**Step 2: Update workflow to include metadata directory**

In `convert-xlsx.yml`, update the paths trigger:
```yaml
paths: ['*.xlsx', 'index.html', 'metadata/**']
```

Update the deploy step to copy metadata:
```yaml
      - name: Deploy to data branch
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout --orphan data-temp
          git rm -rf .
          mv *.json . 2>/dev/null || true
          git checkout main -- index.html
          git add *.json index.html
          git commit -m "Auto-convert xlsx to json"
          git branch -D data 2>/dev/null || true
          git branch -m data
          git push origin data --force
```

**Step 3: Update landing page (`index.html`) to display metadata**

Replace the card rendering in the script to show description, author, date, tags:
```javascript
files.forEach(f => {
  const card = document.createElement('div');
  card.className = 'card';
  const m = f.metadata || {};
  card.innerHTML = `
    <h2>${(m.name || f.name.replace('.json', '')).replace(/_/g, ' ')}</h2>
    <div class="meta">Source: ${f.source}</div>
    ${m.description ? `<div class="desc">${m.description}</div>` : ''}
    ${m.author ? `<div class="meta">Author: ${m.author}</div>` : ''}
    ${m.date ? `<div class="meta">Date: ${m.date}</div>` : ''}
    ${m.tags && m.tags.length ? `<div class="tags">${m.tags.map(t => `<span class="tag">${t}</span>`).join(' ')}</div>` : ''}
    <div class="actions">
      <a href="${f.name}" target="_blank">View JSON</a>
      <a href="https://damian0o.github.io/EcoPlate-Analyzer-Web/" target="_blank">Analyze</a>
    </div>`;
  grid.appendChild(card);
});
```

Add styles for description and tags:
```css
.card .desc {
  font-size: 0.9rem;
  color: #4a5568;
  margin-bottom: 0.5rem;
}
.card .tags { margin-bottom: 0.5rem; }
.card .tag {
  display: inline-block;
  background: #e2e8f0;
  color: #4a5568;
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  margin-right: 0.25rem;
}
```

**Step 4: Commit**

```bash
# In EcoPlate-Data repo
git add convert.py .github/workflows/convert-xlsx.yml index.html
git commit -m "feat: support metadata in index.json and landing page"
```

---

### Task 6: Create OAuth App and Set Client ID

**Step 1:** Create the GitHub OAuth App (manual — see Prerequisites above)

**Step 2:** Replace `YOUR_CLIENT_ID` in `js/github-auth.js` with the actual Client ID

**Step 3: Commit**

```bash
git add js/github-auth.js
git commit -m "chore: set GitHub OAuth App client ID"
```

---

### Task 7: End-to-End Test

**Step 1:** Deploy both repos (push changes)

**Step 2:** Open https://damian0o.github.io/EcoPlate-Analyzer-Web/

**Step 3:** Navigate to Upload tab, sign in with GitHub

**Step 4:** Fill form and upload a test xlsx file

**Step 5:** Verify PR is created on EcoPlate-Data with the xlsx and metadata JSON

**Step 6:** Merge the PR and verify the workflow runs and the landing page updates

---
