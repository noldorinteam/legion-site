/* ═══════════════════════════════════════════════════
   GITHUB API INTEGRATION — github.js
   Upload, list, and delete files via GitHub API
═══════════════════════════════════════════════════ */

(function() {

  const GH = window.LEGION_CONFIG;
  // Base path inside the repo where media is stored
  const MEDIA_PATH = 'media';

  /**
   * Fetch all files from the media/ folder in the repo.
   * Returns array of { name, path, download_url, sha, type }
   */
  async function listMediaFiles() {
    const url = `https://api.github.com/repos/${GH.githubUser}/${GH.githubRepo}/contents/${MEDIA_PATH}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${GH.githubToken}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });
    if (res.status === 404) return []; // folder doesn't exist yet
    if (!res.ok) throw new Error(`GitHub API hatası: ${res.status}`);
    const data = await res.json();
    return data.filter(f => f.type === 'file');
  }

  /**
   * Upload a single file to GitHub.
   * @param {File} file - Browser File object
   * @param {function} onLog - callback(msg, type) for terminal logging
   */
  async function uploadFile(file, onLog) {
    onLog(`[UPLOAD]  ${file.name} → Base64 dönüştürülüyor...`, 'out');

    const base64 = await fileToBase64(file);
    const filePath = `${MEDIA_PATH}/${Date.now()}_${sanitizeFilename(file.name)}`;
    const url = `https://api.github.com/repos/${GH.githubUser}/${GH.githubRepo}/contents/${filePath}`;

    onLog(`[PUSH]    ${filePath} → GitHub'a gönderiliyor...`, 'out');

    const body = JSON.stringify({
      message: `[LEGION] Upload: ${file.name}`,
      content: base64,
      branch: GH.branch
    });

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GH.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    onLog(`[TAMAM]   ${file.name} başarıyla yüklendi.`, 'info');
    return data.content; // { name, path, sha, download_url, ... }
  }

  /**
   * Delete a file from GitHub by path and sha.
   * @param {string} filePath - full path in repo e.g. "media/123_photo.jpg"
   * @param {string} sha      - current file sha
   * @param {string} name     - display name for logging
   * @param {function} onLog
   */
  async function deleteFile(filePath, sha, name, onLog) {
    onLog(`[SİL]     ${name} → GitHub'dan kaldırılıyor...`, 'out');
    const url = `https://api.github.com/repos/${GH.githubUser}/${GH.githubRepo}/contents/${filePath}`;

    const body = JSON.stringify({
      message: `[LEGION] Delete: ${name}`,
      sha: sha,
      branch: GH.branch
    });

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${GH.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }
    onLog(`[TAMAM]   ${name} başarıyla silindi.`, 'info');
  }

  // ─── HELPERS ─────────────────────────────────────

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result is "data:...;base64,XXXX"
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._\-]/g, '_');
  }

  function isVideo(filename) {
    return /\.(mp4|webm|ogg|mov|avi)$/i.test(filename);
  }

  function isImage(filename) {
    return /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(filename);
  }

  // ─── EXPORT ─────────────────────────────────────
  window.GithubAPI = { listMediaFiles, uploadFile, deleteFile, isVideo, isImage };

})();
