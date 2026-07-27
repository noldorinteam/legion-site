/* ═══════════════════════════════════════════════════
   GALLERY MODULE — gallery.js
   Renders media cards, handles filtering, lightbox
═══════════════════════════════════════════════════ */

(function() {

  let allMedia = [];    // cache of all fetched media items
  let activeFilter = 'all';

  /**
   * Load media from GitHub and render gallery
   */
  async function loadGallery() {
    const grid  = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    if (!grid) return;

    // Show loading indicator
    grid.innerHTML = `
      <div class="gallery-empty">
        <div class="empty-icon" style="animation:spin 1s linear infinite;display:inline-block">◈</div>
        <p>Medya dosyaları yükleniyor...</p>
      </div>
    `;

    try {
      allMedia = await GithubAPI.listMediaFiles();
      renderGallery();
    } catch (err) {
      grid.innerHTML = `
        <div class="gallery-empty">
          <div class="empty-icon" style="color:var(--red)">✕</div>
          <p style="color:var(--red)">Yükleme hatası: ${err.message}</p>
          <p class="empty-sub">GitHub bağlantısını kontrol edin.</p>
        </div>
      `;
    }
  }

  /**
   * Re-render the gallery grid based on current filter
   */
  function renderGallery() {
    const grid  = document.getElementById('gallery-grid');
    const empty = document.getElementById('gallery-empty');
    if (!grid) return;

    let items = allMedia;
    if (activeFilter === 'image') items = allMedia.filter(f => GithubAPI.isImage(f.name));
    if (activeFilter === 'video') items = allMedia.filter(f => GithubAPI.isVideo(f.name));

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="gallery-empty">
          <div class="empty-icon">⬡</div>
          <p>Henüz medya yüklenmedi.</p>
          <p class="empty-sub">İlk dosyayı sen yükle, arşivi doldur.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = '';
    items.forEach(file => {
      const card = createCard(file);
      grid.appendChild(card);
    });
  }

  /**
   * Create a single gallery card DOM element
   */
  function createCard(file) {
    const isVid = GithubAPI.isVideo(file.name);
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.path = file.path;
    card.dataset.sha  = file.sha;

    const badge = `<span class="card-type-badge">${isVid ? 'VİDEO' : 'GÖRSEL'}</span>`;
    const deleteButton = window.LegionAuth?.isAdmin()
      ? `<button class="card-btn card-btn-delete" data-path="${file.path}" data-sha="${file.sha}" data-name="${file.name}">SİL</button>`
      : '';

    const mediaEl = isVid
      ? `<video src="${file.download_url}" muted preload="metadata" loop></video>`
      : `<img src="${file.download_url}" alt="${file.name}" loading="lazy"/>`;

    const displayName = decodeFilename(file.name);

    card.innerHTML = `
      ${badge}
      ${mediaEl}
      <div class="gallery-card-overlay">
        <div class="card-filename">${displayName}</div>
        <div class="card-actions">
          <button class="card-btn card-btn-view" data-path="${file.path}" data-sha="${file.sha}" data-url="${file.download_url}" data-type="${isVid ? 'video' : 'image'}">GÖRÜNTÜLE</button>
          ${deleteButton}
        </div>
      </div>
    `;

    // Hover play for videos
    if (isVid) {
      const vid = card.querySelector('video');
      card.addEventListener('mouseenter', () => vid.play().catch(() => {}));
      card.addEventListener('mouseleave', () => { vid.pause(); vid.currentTime = 0; });
    }

    // View button
    card.querySelector('.card-btn-view').addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(file.download_url, isVid ? 'video' : 'image');
    });

    // Delete button
    card.querySelector('.card-btn-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleDelete(file.path, file.sha, file.name, card);
    });

    return card;
  }

  /**
   * Handle delete with confirmation
   */
  async function handleDelete(path, sha, name, cardEl) {
    if (!window.LegionAuth?.isAdmin()) return;
    if (!confirm(`"${decodeFilename(name)}" silinsin mi? Bu işlem geri alınamaz.`)) return;

    cardEl.style.opacity = '0.4';
    cardEl.style.pointerEvents = 'none';

    try {
      await GithubAPI.deleteFile(path, sha, name, (msg, type) => {
        logUpload(msg, type);
      });
      // Remove from cache
      allMedia = allMedia.filter(f => f.path !== path);
      cardEl.style.transition = 'all 0.4s';
      cardEl.style.transform = 'scale(0.8)';
      cardEl.style.opacity = '0';
      setTimeout(() => {
        cardEl.remove();
        if (document.getElementById('gallery-grid').children.length === 0) renderGallery();
      }, 400);
    } catch (err) {
      cardEl.style.opacity = '1';
      cardEl.style.pointerEvents = 'all';
      alert(`Silme hatası: ${err.message}`);
    }
  }

  /**
   * Lightbox
   */
  function openLightbox(url, type) {
    const lb      = document.getElementById('lightbox');
    const lbImg   = document.getElementById('lightbox-img');
    const lbVideo = document.getElementById('lightbox-video');

    lb.classList.remove('hidden');

    if (type === 'image') {
      lbImg.src = url;
      lbImg.style.display = 'block';
      lbVideo.style.display = 'none';
      lbVideo.src = '';
    } else {
      lbVideo.src = url;
      lbVideo.style.display = 'block';
      lbImg.style.display = 'none';
      lbImg.src = '';
    }
  }

  function closeLightbox() {
    const lb      = document.getElementById('lightbox');
    const lbVideo = document.getElementById('lightbox-video');
    lb.classList.add('hidden');
    lbVideo.pause();
    lbVideo.src = '';
  }

  /**
   * Log to upload terminal
   */
  function logUpload(msg, type) {
    if (window._logUploadLine) {
      window._logUploadLine(msg, type);
      return;
    }
    const log = document.getElementById('upload-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = `t-line t-${type}`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function decodeFilename(name) {
    // Remove timestamp prefix like "1234567890_"
    return name.replace(/^\d+_/, '');
  }

  // ─── EXPORT ─────────────────────────────────────
  window.Gallery = { loadGallery, renderGallery, setFilter: (f) => { activeFilter = f; renderGallery(); }, closeLightbox, logUpload, addMedia: (f) => { allMedia.push(f); renderGallery(); } };

  // Lightbox close events
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lightbox-close')?.addEventListener('click', () => Gallery.closeLightbox());
    document.getElementById('lightbox-overlay')?.addEventListener('click', () => Gallery.closeLightbox());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Gallery.closeLightbox(); });
  });

})();
