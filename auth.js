/* LEGION access control and administrator console */
(function () {
  'use strict';

  const ADMIN_HASH = '27c320045ba718a797f5549649c72613c2158b3b4dfedf2222aad3f4f39aab95';
  const ACCESS_HASH = 'be9deda60cc4b7cfdc2f1e3396ebed5ad6d28937205db8ef46c6a0ed32cd5841';
  const SESSION_KEY = 'legion_session_v2';
  const CODES_KEY = 'legion_access_codes_v2';
  const LOCK_KEY = 'legion_login_lock_v2';
  const SESSION_TTL = 8 * 60 * 60 * 1000;
  let currentRole = null;

  async function digest(value) {
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (_) { return fallback; }
  }

  function loadCodes() {
    const now = Date.now();
    return readJSON(CODES_KEY, []).filter(code => !code.expiresAt || code.expiresAt > now);
  }

  function saveCodes(codes) {
    localStorage.setItem(CODES_KEY, JSON.stringify(codes.slice(0, 50)));
  }

  function isAdmin() { return currentRole === 'admin'; }

  function setSession(role) {
    currentRole = role;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      role,
      expiresAt: Date.now() + SESSION_TTL,
      nonce: crypto.getRandomValues(new Uint32Array(4)).join('-')
    }));
  }

  function restoreSession() {
    try {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (session && session.expiresAt > Date.now() && ['admin', 'member'].includes(session.role)) {
        currentRole = session.role;
        return true;
      }
    } catch (_) {}
    sessionStorage.removeItem(SESSION_KEY);
    return false;
  }

  function getLock() {
    return readJSON(LOCK_KEY, { attempts: 0, lockedUntil: 0 });
  }

  function recordFailure() {
    const lock = getLock();
    lock.attempts += 1;
    if (lock.attempts >= 5) {
      lock.lockedUntil = Date.now() + Math.min(5 * 60 * 1000, 30000 * Math.ceil(lock.attempts / 5));
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify(lock));
    return lock;
  }

  function clearFailures() {
    localStorage.removeItem(LOCK_KEY);
  }

  function createShell() {
    document.body.insertAdjacentHTML('afterbegin', `
      <div id="intro-cinematic" class="hidden" aria-live="polite">
        <video id="intro-video" playsinline preload="auto"></video>
        <div class="intro-shade"></div>
        <div class="intro-hud">
          <div><span class="intro-live"></span> LEGION SECURE CHANNEL</div>
          <span id="intro-stage">SEQUENCE 01 / 02</span>
        </div>
        <div class="intro-progress"><span id="intro-progress-fill"></span></div>
      </div>
      <audio id="login-music" src="music/jeXfXt5eaCyPmIG6oKRfNA.mp3" loop preload="auto"></audio>
      <div id="access-gate" role="dialog" aria-modal="true" aria-labelledby="access-title">
        <div class="access-noise"></div>
        <form id="access-form" class="access-card" autocomplete="off">
          <div class="access-eyebrow"><span></span> ENCRYPTED NODE // 0x4C45</div>
          <h1 id="access-title">IDENTITY<br><em>REQUIRED</em></h1>
          <p class="access-copy">Bu alan şifrelenmiş bir oturum gerektirir.</p>
          <label for="access-password">ERİŞİM ANAHTARI</label>
          <div class="access-input-row">
            <span>&gt;_</span>
            <input id="access-password" type="password" required maxlength="64"
              autocomplete="current-password" spellcheck="false" autofocus />
          </div>
          <button type="submit" id="access-submit">OTURUMU BAŞLAT <b>↗</b></button>
          <div id="access-error" aria-live="polite"></div>
          <div class="access-meta"><span>● AES-256 CHANNEL</span><span>SESSION / 08H</span></div>
        </form>
      </div>`);

    const nav = document.querySelector('.nav-links');
    if (nav) nav.insertAdjacentHTML('beforeend',
      '<li id="admin-nav-item" class="hidden"><a href="#" class="nav-link" data-section="admin" id="nav-admin">YÖNETİM</a></li>');
    document.querySelector('.nav-status')?.insertAdjacentHTML('beforebegin',
      '<button id="global-logout-btn" class="global-logout" type="button" title="Oturumu kapat">ÇIKIŞ <span>↗</span></button>');

    document.getElementById('main-site')?.insertAdjacentHTML('beforeend', `
      <section id="section-admin" class="section hidden">
        <div class="admin-console">
          <div class="admin-heading">
            <div><span class="admin-kicker">ROOT ACCESS</span><h2>ŞİFRE ÜRETİCİ</h2>
            <p>Tek kullanımlık veya süreli erişim anahtarları oluşturun ve yönetin.</p></div>
            <button id="logout-btn" class="admin-logout">OTURUMU KAPAT</button>
          </div>
          <div class="generator-grid">
            <div class="generator-card">
              <label for="custom-code">ÖZEL ERİŞİM KODU</label>
              <div class="custom-code-wrap"><span>KEY://</span><input id="custom-code" type="text" minlength="4" maxlength="32" placeholder="İstediğin kodu yaz veya boş bırak" autocomplete="off" spellcheck="false"></div>
              <small class="custom-code-help">Boş bırakırsan güvenli bir kod otomatik üretilir.</small>
              <label>ANAHTAR SÜRESİ</label>
              <select id="code-duration"><option value="24">24 SAAT</option><option value="168">7 GÜN</option><option value="720">30 GÜN</option><option value="0">SÜRESİZ</option></select>
              <label class="check-row"><input id="code-single-use" type="checkbox" checked><span>TEK KULLANIMLIK</span></label>
              <button id="generate-code">GÜVENLİ ANAHTAR ÜRET</button>
              <div id="generated-code" class="generated-code"><span>ANAHTAR BEKLENİYOR</span></div>
              <button id="copy-code" class="copy-code" disabled>KOPYALA</button>
            </div>
            <div class="generator-card code-list-card"><div class="code-list-title"><span>AKTİF ANAHTARLAR</span><b id="code-count">0</b></div><div id="code-list"></div></div>
          </div>
        </div>
      </section>`);
  }

  function randomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b, i) => alphabet[b % alphabet.length] + (i === 3 || i === 7 || i === 11 ? '-' : '')).join('');
  }

  function renderCodes() {
    const list = document.getElementById('code-list');
    if (!list) return;
    const codes = loadCodes();
    saveCodes(codes);
    document.getElementById('code-count').textContent = codes.length;
    list.innerHTML = codes.length ? codes.map(code => `
      <div class="code-row"><div><strong>${code.value}</strong><small>${code.singleUse ? 'TEK KULLANIM' : 'ÇOKLU'} · ${code.expiresAt ? new Date(code.expiresAt).toLocaleDateString('tr-TR') : 'SÜRESİZ'}</small></div>
      <button data-revoke="${code.id}" title="İptal et">×</button></div>`).join('') :
      '<div class="no-codes">AKTİF ANAHTAR YOK</div>';
    list.querySelectorAll('[data-revoke]').forEach(btn => btn.addEventListener('click', () => {
      saveCodes(codes.filter(code => code.id !== btn.dataset.revoke));
      renderCodes();
    }));
  }

  function applyRole() {
    document.documentElement.dataset.role = currentRole || 'guest';
    document.getElementById('admin-nav-item')?.classList.toggle('hidden', !isAdmin());
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin()));
    window.dispatchEvent(new CustomEvent('legion:rolechange', { detail: { role: currentRole } }));
  }

  async function authenticate(value) {
    const hash = await digest(value);
    if (hash === ADMIN_HASH) return 'admin';
    if (hash === ACCESS_HASH) return 'member';
    const codes = loadCodes();
    const match = codes.find(code => code.hash === hash);
    if (!match) return null;
    if (match.singleUse) saveCodes(codes.filter(code => code.id !== match.id));
    return 'member';
  }

  function unlock(role) {
    clearFailures();
    setSession(role);
    applyRole();
    const gate = document.getElementById('access-gate');
    gate.classList.add('access-granted');
    setTimeout(() => gate.remove(), 650);
    startSiteAudio();
    playIntroSequence();
  }

  function startSiteAudio() {
    const loginMusic = document.getElementById('login-music');
    const backgroundMusic = document.getElementById('bg-music');
    if (loginMusic) {
      loginMusic.volume = .68;
      loginMusic.play().catch(() => {});
    }
    if (backgroundMusic) {
      backgroundMusic.volume = .22;
      backgroundMusic.play().catch(() => {});
    }
  }

  function playTone(frequency = 92, duration = .16) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 2.1, context.currentTime + duration);
      gain.gain.setValueAtTime(.055, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
      oscillator.onended = () => context.close();
    } catch (_) {}
  }

  function playIntroSequence() {
    const overlay = document.getElementById('intro-cinematic');
    const video = document.getElementById('intro-video');
    const stage = document.getElementById('intro-stage');
    const progress = document.getElementById('intro-progress-fill');
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      video.src = 'music/LEGION_90s_FINAL_DRAFT.mp4';
      video.muted = true;
      video.volume = 0;
      video.loop = true;
      video.load();
      video.play().catch(() => {});
      overlay.classList.add('background-mode');
      document.dispatchEvent(new CustomEvent('legion:authenticated'));
    };

    video.addEventListener('timeupdate', () => {
      if (video.duration) progress.style.width = `${Math.min(100, video.currentTime / video.duration * 100)}%`;
    });
    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });

    overlay.classList.remove('hidden', 'intro-exit', 'background-mode');
    stage.textContent = 'INTRO SEQUENCE';
    progress.style.width = '0%';
    video.src = 'music/LEGION_FiveM_Hacker_Intro_1080p.mp4';
    video.muted = false;
    video.volume = 1;
    video.loop = false;
    video.load();
    playTone(64, .28);
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(finish);
    });
  }

  function bind() {
    document.getElementById('access-form').addEventListener('submit', async event => {
      event.preventDefault();
      const input = document.getElementById('access-password');
      const error = document.getElementById('access-error');
      const submit = document.getElementById('access-submit');
      const lock = getLock();
      if (lock.lockedUntil > Date.now()) {
        error.textContent = `ÇOK FAZLA DENEME · ${Math.ceil((lock.lockedUntil - Date.now()) / 1000)} SN BEKLEYİN`;
        return;
      }
      submit.disabled = true;
      const role = await authenticate(input.value);
      input.value = '';
      submit.disabled = false;
      if (role) return unlock(role);
      const updated = recordFailure();
      error.textContent = updated.lockedUntil > Date.now() ? 'ERİŞİM GEÇİCİ OLARAK KİLİTLENDİ' : 'ANAHTAR REDDEDİLDİ';
      document.querySelector('.access-card').classList.remove('shake');
      void document.querySelector('.access-card').offsetWidth;
      document.querySelector('.access-card').classList.add('shake');
    });

    document.getElementById('generate-code')?.addEventListener('click', async () => {
      if (!isAdmin()) return;
      const customInput = document.getElementById('custom-code');
      const customValue = customInput.value.trim();
      const value = customValue || randomCode();
      if (customValue && (customValue.length < 4 || customValue.length > 32)) {
        customInput.setCustomValidity('Kod 4–32 karakter olmalı.');
        customInput.reportValidity();
        return;
      }
      customInput.setCustomValidity('');
      const hours = Number(document.getElementById('code-duration').value);
      const codes = loadCodes();
      if (codes.some(code => code.value.toLocaleLowerCase('tr-TR') === value.toLocaleLowerCase('tr-TR'))) {
        customInput.setCustomValidity('Bu kod zaten kullanılıyor.');
        customInput.reportValidity();
        return;
      }
      codes.unshift({
        id: crypto.randomUUID(),
        value,
        hash: await digest(value),
        singleUse: document.getElementById('code-single-use').checked,
        createdAt: Date.now(),
        expiresAt: hours ? Date.now() + hours * 3600000 : 0
      });
      saveCodes(codes);
      const output = document.getElementById('generated-code');
      output.innerHTML = `<small>YENİ ERİŞİM ANAHTARI</small><strong>${value}</strong>`;
      document.getElementById('copy-code').disabled = false;
      document.getElementById('copy-code').dataset.value = value;
      customInput.value = '';
      renderCodes();
    });

    document.getElementById('copy-code')?.addEventListener('click', async event => {
      await navigator.clipboard.writeText(event.currentTarget.dataset.value || '');
      event.currentTarget.textContent = 'KOPYALANDI ✓';
      setTimeout(() => { event.currentTarget.textContent = 'KOPYALA'; }, 1300);
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    });
    document.getElementById('global-logout-btn')?.addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    createShell();
    bind();
    renderCodes();
    if (restoreSession()) unlock(currentRole);
  });

  window.LegionAuth = { isAdmin, role: () => currentRole };
})();
