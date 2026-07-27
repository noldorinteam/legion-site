/* ═══════════════════════════════════════════════════
   MAIN APP — app.js
   Navigation, glitch effect, upload, home animations
═══════════════════════════════════════════════════ */

(function() {

  function playUiSound(kind = 'move') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequencies = { move: [110, 220], open: [165, 330], close: [240, 90] };
      const notes = frequencies[kind] || frequencies.move;
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(notes[0], context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(notes[1], context.currentTime + .11);
      gain.gain.setValueAtTime(.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .13);
      oscillator.onended = () => context.close();
    } catch (_) {}
  }

  // ─── GLITCH TRANSITION ───────────────────────────
  const BINARY_STRINGS = [
    '01011001 01101111 01110101 00100000',
    '01000011 01100001 01101110 01101110',
    '01101111 01110100 00100000 01010011',
    '01010100 01101111 01110000 00100000',
    '01001100 01000101 01000111 01001001',
    '01001111 01001110 00100000 01011111',
  ];

  function showGlitch(targetSection, labelText) {
    playUiSound('open');
    const overlay = document.getElementById('glitch-overlay');
    const binary  = document.getElementById('glitch-binary');
    const label   = document.getElementById('glitch-label');

    overlay.classList.remove('hidden');

    let i = 0;
    const interval = setInterval(() => {
      binary.textContent = BINARY_STRINGS[i % BINARY_STRINGS.length];
      i++;
    }, 80);

    label.textContent = labelText || 'GALERİ';
    label.style.opacity = '0';
    label.style.pointerEvents = 'none';

    setTimeout(() => {
      clearInterval(interval);
      binary.textContent = '01011001';
      label.style.opacity = '1';
      label.style.pointerEvents = 'all';
    }, 700);

    // Onclick
    label.onclick = () => {
      playUiSound('close');
      overlay.classList.add('hidden');
      label.style.opacity = '0';
      label.style.pointerEvents = 'none';
      navigateTo(targetSection, false);
    };

    // Auto dismiss
    setTimeout(() => {
      if (!overlay.classList.contains('hidden')) {
        overlay.classList.add('hidden');
        label.style.opacity = '0';
        label.style.pointerEvents = 'none';
        navigateTo(targetSection, false);
      }
    }, 2500);
  }

  // ─── NAVIGATION ──────────────────────────────────
  let currentSection = 'home';

  function navigateTo(sectionId, withGlitch) {
    if (withGlitch) {
      const labelMap = {
        home:     'ANA SAYFA',
        database: 'VERİTABANI',
        reports:   'RAPORLAR',
        gallery:  'GALERİ',
        upload:   'YÜKLE',
        about:    'HAKKINDA',
        admin:    'YÖNETİM'
      };
      showGlitch(sectionId, labelMap[sectionId] || sectionId.toUpperCase());
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

    // Section-specific loaders
    if (sectionId === 'gallery')  Gallery.loadGallery();
    if (sectionId === 'database') Database.loadDatabase();
    if (sectionId === 'reports')  Reports.load();
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
      statusEl.className = 'upload-status hidden';
      clearUploadLog();
    });

    doBtn.addEventListener('click', async () => {
      if (filesToUpload.length === 0) return;
      btnText.textContent = 'GÖNDERİLİYOR...';
      spinner.classList.remove('hidden');
      doBtn.disabled = true;
      clearBtn.disabled = true;
      statusEl.className = 'upload-status hidden';

      clearUploadLog();
      logUploadLine('[BAŞLAT]  GitHub\'a bağlanılıyor...', 'info');

      let successCount = 0, errorCount = 0;

      for (const file of filesToUpload) {
        try {
          const result = await GithubAPI.uploadFile(file, logUploadLine);
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

    let playing = !audio.paused;
    btn.addEventListener('click', () => {
      if (playing) {
        audio.pause();
        icon.textContent = '♪';
        btn.style.borderColor = 'var(--border)';
        playing = false;
      } else {
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
    runTyped();
    runBinaryBar();
    runTerminal();
    animateCounter('stat-members', 13, 1500);
    animateCounter('stat-ops', 47, 2000);
    animateCounter('stat-targets', 89, 2500);

    // Upload
    initUpload();

    // Music
    initMusic();

    // Filters
    initFilters();
  });

})();
