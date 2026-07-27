/* ═══════════════════════════════════════════════════
   BOOT SEQUENCE — boot.js
   Hacking-style loading screen with terminal log
═══════════════════════════════════════════════════ */

(function() {
  const BOOT_LINES = [
    { text: '[BAŞLATILIYOR] LEGION v2.0.4 çekirdeği yükleniyor...', delay: 0,    type: 'out' },
    { text: '[TARAMA]       Ağ bağlantısı kontrol ediliyor...', delay: 200,  type: 'out' },
    { text: '[BAĞLANTI]     5.9.8.4 adresine bağlanılıyor...', delay: 450,  type: 'out' },
    { text: '[TAMAM]        IPv6 tüneli kuruldu.', delay: 700,  type: 'info' },
    { text: '[ŞIFRELEME]    AES-256 şifreleme aktif edildi.', delay: 950,  type: 'out' },
    { text: '[YETKİ]        Root yetkileri talep ediliyor...', delay: 1200, type: 'out' },
    { text: '[HATA]         İzin engellendi — bypass çalıştırılıyor.', delay: 1450, type: 'err' },
    { text: '[BYPASS]       Güvenlik duvarı atlatıldı.', delay: 1750, type: 'info' },
    { text: '[TAMAM]        Root erişimi sağlandı.', delay: 2000, type: 'info' },
    { text: '[MODÜL]        legion_core.exe yükleniyor...', delay: 2250, type: 'out' },
    { text: '[MODÜL]        stealth_protocol.dll aktif.', delay: 2500, type: 'out' },
    { text: '[MODÜL]        ghost_network.sys başlatıldı.', delay: 2700, type: 'out' },
    { text: '[TARAMA]       Hedef sunucular haritalandı. (47 düğüm)', delay: 2950, type: 'info' },
    { text: '[VERİ]         Şifreli veritabanı monte edildi.', delay: 3200, type: 'out' },
    { text: '[SİSTEM]       Kimlik doğrulama sertifikaları oluşturuldu.', delay: 3400, type: 'out' },
    { text: '[HAZIR]        LEGION arayüzü başlatılıyor...', delay: 3700, type: 'info' },
  ];

  let matrixInterval;

  function appendBootLine(text, type) {
    const log = document.getElementById('boot-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = 'boot-line';
    line.style.color = type === 'err' ? '#ff2020' : type === 'info' ? '#00e5ff' : '#00c832';
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function updateProgress(pct) {
    const fill = document.getElementById('boot-progress-fill');
    const txt  = document.getElementById('boot-progress-text');
    if (fill) fill.style.width = pct + '%';
    if (txt)  txt.textContent  = pct + '%';
  }

  function runBoot() {
    matrixInterval = window.initBootMatrix();
    let lastDelay = 0;

    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        appendBootLine(line.text, line.type);
        const pct = Math.round(((i + 1) / BOOT_LINES.length) * 85);
        updateProgress(pct);
      }, line.delay);
      lastDelay = line.delay;
    });

    // Final progress push
    setTimeout(() => {
      updateProgress(95);
      appendBootLine('[SİSTEM]       Arayüz bileşenleri hazırlanıyor...', 'out');
    }, lastDelay + 300);

    setTimeout(() => {
      updateProgress(100);
      appendBootLine('[HAZIR]        HOŞ GELDİNİZ, LEGION.', 'info');
    }, lastDelay + 700);

    // Transition to main site
    setTimeout(() => {
      clearInterval(matrixInterval);
      const bootScreen = document.getElementById('boot-screen');
      bootScreen.style.transition = 'opacity 0.8s ease';
      bootScreen.style.opacity = '0';
      setTimeout(() => {
        bootScreen.classList.add('hidden');
        launchMainSite();
      }, 800);
    }, lastDelay + 1400);
  }

  function launchMainSite() {
    const main = document.getElementById('main-site');
    main.classList.remove('hidden');
    main.style.opacity = '0';
    main.style.transition = 'opacity 0.6s ease';
    setTimeout(() => { main.style.opacity = '1'; }, 50);

    // Try playing music
    tryPlayMusic();
  }

  function tryPlayMusic() {
    const audio = document.getElementById('bg-music');
    if (!audio) return;
    audio.volume = 0.38;
    audio.play().catch(() => {
      // Autoplay blocked — wait for first user interaction
      document.addEventListener('click', () => {
        audio.play().catch(() => {});
      }, { once: true });
    });
  }

  let started = false;
  function startOnce() {
    if (started) return;
    started = true;
    const bootScreen = document.getElementById('boot-screen');
    if (bootScreen) bootScreen.classList.add('hidden');
    launchMainSite();
  }

  // Authentication is completed before the boot sequence is allowed to run.
  document.addEventListener('legion:authenticated', startOnce);

})();
