/* ═══════════════════════════════════════════════════
   MAIN APP — app.js
   Navigation, glitch effect, upload, home animations
═══════════════════════════════════════════════════ */

(function() {

  // ─── NAVIGATION ──────────────────────────────────
  let currentSection = 'home';

  function syncBackgroundVideo(sectionId) {
    const video = document.getElementById('site-background-video');
    if (!video) return;
    if (sectionId === 'home' && !document.hidden) video.play().catch(() => {});
    else video.pause();
  }

  function navigateTo(sectionId, withGlitch) {
    if (window.LegionAuth?.role() === 'visitor' && !['home', 'gallery', 'about'].includes(sectionId)) {
      return;
    }

    if (sectionId === currentSection) return;

    // Hide current
    const cur = document.getElementById(`section-${currentSection}`);
    if (cur) cur.classList.add('hidden');

    // Show next
    const next = document.getElementById(`section-${sectionId}`);
    if (next) next.classList.remove('hidden');

    // Update nav active
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${sectionId}`);
    if (activeLink) activeLink.classList.add('active');

    currentSection = sectionId;
    document.documentElement.dataset.section = sectionId;
    syncBackgroundVideo(sectionId);

    // Section-specific loaders
    if (sectionId === 'gallery')  Gallery.loadGallery();
    if (sectionId === 'database') Database.loadDatabase();
    if (sectionId === 'reports')  Reports.load();
    if (sectionId === 'chains')   IncidentChains.load();
  }

  // Expose for other modules
  window.AppNavigate = navigateTo;

  // ─── TERMINAL (home) ─────────────────────────────
  const TERMINAL_LINES = [
    { text: 'root@legion:~# ./start_mission.sh', cls: 'prompt', delay: 500 },
    { text: 'Hedef sunucuya bağlanılıyor... [OK]', cls: 'info', delay: 1200 },
    { text: 'Güvenlik protokolleri atlatılıyor...', cls: 'out', delay: 1900 },
    { text: 'HATA: İzin reddedildi — bypass çalışıyor', cls: 'err', delay: 2600 },
    { text: 'Bypass başarılı. Root erişimi sağlandı.', cls: 'info', delay: 3300 },
    { text: 'Sınıflandırılmış veriler indiriliyor...', cls: 'out', delay: 4000 },
    { text: '████████████████████ 100% [TAMAM]', cls: 'info', delay: 4800 },
    { text: 'Bağlantı şifrelendi. İz silindi.', cls: 'out', delay: 5500 },
    { text: 'Operasyon tamamlandı. LEGION hazır.', cls: 'info', delay: 6200 },
    { text: 'root@legion:~# _', cls: 'prompt', delay: 6900 },
  ];

  function runTerminal() {
    const body = document.getElementById('terminal-body');
    if (!body) return;
    TERMINAL_LINES.forEach(line => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.className = `t-line t-${line.cls}`;
        el.textContent = line.text;
        body.appendChild(el);
        body.scrollTop = body.scrollHeight;
      }, line.delay);
    });
  }

  // ─── TYPED SUBTITLE ──────────────────────────────
  const SUBTITLES = [
    'FiveM\'de Sistemi Kontrol Ediyoruz.',
    'Sınırlar Bizim İçin Yok.',
    'Biz Birleğiz, Biz Çoğuz.',
    'Her Düğüm Bir Silah.',
    'Karanlıkta Çalışıyoruz.',
  ];

  function runTyped() {
    const el = document.getElementById('typed-subtitle');
    if (!el) return;
    let si = 0, ci = 0, deleting = false;

    function tick() {
      if (document.hidden) {
        setTimeout(tick, 1000);
        return;
      }
      const text = SUBTITLES[si];
      if (!deleting) {
        el.textContent = text.slice(0, ++ci);
        if (ci === text.length) {
          deleting = true;
          setTimeout(tick, 2000);
          return;
        }
      } else {
        el.textContent = text.slice(0, --ci);
        if (ci === 0) {
          deleting = false;
          si = (si + 1) % SUBTITLES.length;
        }
      }
      setTimeout(tick, deleting ? 80 : 120);
    }
    tick();
  }

  // ─── COUNTER ANIMATION ───────────────────────────
  function animateCounter(elId, target, duration) {
    const el = document.getElementById(elId);
    if (!el) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = String(Math.floor(start)).padStart(2, '0');
      if (start >= target) clearInterval(timer);
    }, 16);
  }

  // ─── BINARY BAR ──────────────────────────────────
  function runBinaryBar() {
    const bar = document.getElementById('binary-bar');
    if (!bar) return;
    function gen() {
      bar.textContent = Array.from({length: 160}, () => Math.random() > 0.5 ? '1' : '0').join('');
    }
    gen();
    setInterval(() => { if (!document.hidden) gen(); }, 1200);
  }

  // ─── UPLOAD HANDLER ──────────────────────────────
  let filesToUpload = [];

  function initUpload() {
    const zone      = document.getElementById('upload-zone');
    const input     = document.getElementById('file-input');
    const preview   = document.getElementById('upload-preview-container');
    const pgrid     = document.getElementById('upload-preview-grid');
    const clearBtn  = document.getElementById('clear-upload-btn');
    const doBtn     = document.getElementById('do-upload-btn');
    const btnText   = document.getElementById('upload-btn-text');
    const spinner   = document.getElementById('upload-spinner');
    const statusEl  = document.getElementById('upload-status');
    const titleInput = document.getElementById('media-title');

    if (!zone) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      handleFiles([...e.dataTransfer.files]);
    });
    input.addEventListener('change', () => handleFiles([...input.files]));

    function handleFiles(files) {
      const valid = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
      if (valid.length === 0) return;
      filesToUpload = valid;
      renderPreviews(valid);
      zone.style.display = 'none';
      preview.style.display = 'block';
    }

    function renderPreviews(files) {
      pgrid.innerHTML = '';
      files.forEach(f => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        const isVid = f.type.startsWith('video/');
        const el = document.createElement(isVid ? 'video' : 'img');
        el.src = URL.createObjectURL(f);
        if (isVid) { el.muted = true; el.preload = 'metadata'; }
        const nameEl = document.createElement('div');
        nameEl.className = 'preview-item-name';
        nameEl.textContent = f.name;
        item.appendChild(el);
        item.appendChild(nameEl);
        pgrid.appendChild(item);
      });
    }

    clearBtn.addEventListener('click', () => {
      filesToUpload = [];
      pgrid.innerHTML = '';
      zone.style.display = '';
      preview.style.display = 'none';
      input.value = '';
      titleInput.value = '';
      statusEl.className = 'upload-status hidden';
      clearUploadLog();
    });

    doBtn.addEventListener('click', async () => {
      if (filesToUpload.length === 0) return;
      const mediaTitle = titleInput.value.trim();
      if (!mediaTitle) {
        titleInput.focus();
        statusEl.className = 'upload-status error';
        statusEl.textContent = 'Galeri başlığı yazmalısın.';
        return;
      }
      btnText.textContent = 'GÖNDERİLİYOR...';
      spinner.classList.remove('hidden');
      doBtn.disabled = true;
      clearBtn.disabled = true;
      statusEl.className = 'upload-status hidden';

      clearUploadLog();
      logUploadLine('[BAŞLAT]  GitHub\'a bağlanılıyor...', 'info');

      let successCount = 0, errorCount = 0;

      for (const [index, file] of filesToUpload.entries()) {
        try {
          const titledName = filesToUpload.length > 1 ? `${mediaTitle}-${index + 1}` : mediaTitle;
          const uploadFile = file.type.startsWith('image/')
            ? await window.ImageUtils.optimize(file, { maxDimension: 1600, quality: 0.8 })
            : file;
          await window.ImageUtils.nextFrame();
          const result = await GithubAPI.uploadFile(uploadFile, logUploadLine, titledName);
          Gallery.addMedia({
            name: result.name,
            path: result.path,
            sha:  result.sha,
            download_url: result.download_url || `https://raw.githubusercontent.com/${window.LEGION_CONFIG.githubUser}/${window.LEGION_CONFIG.githubRepo}/${window.LEGION_CONFIG.branch}/${result.path}`
          });
          successCount++;
        } catch (err) {
          logUploadLine(`[HATA]    ${file.name}: ${err.message}`, 'err');
          errorCount++;
        }
      }

      logUploadLine(`[BİTİŞ]   ${successCount} başarılı, ${errorCount} hata.`, successCount > 0 ? 'info' : 'err');

      btnText.textContent = 'GİTHUB\'A GÖNDER';
      spinner.classList.add('hidden');
      doBtn.disabled = false;
      clearBtn.disabled = false;

      const status = errorCount === 0 ? 'success' : 'error';
      statusEl.className = `upload-status ${status}`;
      statusEl.textContent = errorCount === 0
        ? `✓ ${successCount} dosya başarıyla GitHub'a gönderildi!`
        : `⚠ ${successCount} başarılı, ${errorCount} başarısız.`;
    });
  }

  function initClipboardUploads() {
    document.addEventListener('paste', (event) => {
      const imageFiles = [...(event.clipboardData?.items || [])]
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean)
        .map((file, index) => {
          const extension = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          return new File([file], `ekran-goruntusu-${Date.now()}-${index + 1}.${extension}`, {
            type: file.type,
            lastModified: Date.now()
          });
        });
      if (!imageFiles.length) return;

      let target = null;
      const dbModal = document.getElementById('db-modal');
      const reportPanel = document.getElementById('report-form-panel');
      if (dbModal && !dbModal.classList.contains('hidden')) {
        target = document.getElementById('field-photo');
      } else if (currentSection === 'reports' && reportPanel && !reportPanel.classList.contains('hidden')) {
        target = document.getElementById('report-photo');
      } else if (currentSection === 'upload') {
        target = document.getElementById('file-input');
      }
      if (!target) return;

      const transfer = new DataTransfer();
      imageFiles.slice(0, target.multiple ? imageFiles.length : 1).forEach(file => transfer.items.add(file));
      target.files = transfer.files;
      target.dispatchEvent(new Event('change', { bubbles: true }));
      event.preventDefault();
    });
  }

  function logUploadLine(msg, type) {
    const log = document.getElementById('upload-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = `t-line t-${type}`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // expose for gallery.js
  window._logUploadLine = logUploadLine;

  function clearUploadLog() {
    const log = document.getElementById('upload-log');
    if (log) log.innerHTML = '';
  }

  // ─── MUSIC TOGGLE ────────────────────────────────
  function initMusic() {
    const btn   = document.getElementById('music-toggle');
    const audio = document.getElementById('bg-music');
    const icon  = document.getElementById('music-icon');
    if (!btn || !audio) return;

    const preferenceKey = 'legion:music-enabled';
    let playing = !audio.paused;
    if (localStorage.getItem(preferenceKey) === 'false') {
      audio.pause();
      playing = false;
    }
    btn.addEventListener('click', () => {
      if (playing) {
        localStorage.setItem(preferenceKey, 'false');
        audio.pause();
        icon.textContent = '♪';
        btn.style.borderColor = 'var(--border)';
        playing = false;
      } else {
        localStorage.setItem(preferenceKey, 'true');
        audio.play().catch(() => {});
        icon.textContent = '■';
        btn.style.borderColor = 'var(--green)';
        playing = true;
      }
    });

    audio.addEventListener('play',  () => { playing = true;  icon.textContent = '■'; btn.style.borderColor = 'var(--green)'; });
    audio.addEventListener('pause', () => { playing = false; icon.textContent = '♪'; btn.style.borderColor = 'var(--border)'; });
  }

  // ─── FILTER BUTTONS ──────────────────────────────
  function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Gallery.setFilter(btn.dataset.filter);
      });
    });
  }

  // ─── INIT ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {

    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.section, true);
      });
    });

    // CTA buttons
    document.getElementById('enter-gallery-btn')?.addEventListener('click', () => {
      navigateTo('gallery', true);
    });
    document.getElementById('enter-db-btn')?.addEventListener('click', () => {
      navigateTo('database', true);
    });

    // Home animations
    document.getElementById('typed-subtitle').textContent = 'FiveM’de sistemi kontrol ediyoruz.';
    document.getElementById('binary-bar').textContent = '01001100 01000101 01000111 01001001 01001111 01001110';
    document.getElementById('stat-members').textContent = '13';
    document.getElementById('stat-ops').textContent = '47';
    document.getElementById('stat-targets').textContent = '89';
    runTerminal();

    // Upload
    initUpload();
    initClipboardUploads();

    // Music
    initMusic();

    // Filters
    initFilters();
  });

})();
