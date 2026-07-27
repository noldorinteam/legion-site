/* ═══════════════════════════════════════════════════
   MATRIX RAIN CANVAS — matrix.js
   Both boot-screen matrix and background matrix
═══════════════════════════════════════════════════ */

(function() {
  // ─── BOOT SCREEN MATRIX ───────────────────────
  function initBootMatrix() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
    const fontSize = 14;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(0);

    function draw() {
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00ff41';
      ctx.font = fontSize + 'px "Share Tech Mono", monospace';
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    return setInterval(draw, 50);
  }

  // ─── BG MATRIX (main site) ────────────────────
  function initBgMatrix() {
    const canvas = document.getElementById('bg-matrix');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = '01';
    const fontSize = 12;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(0).map(() => Math.random() * -100);

    function draw() {
      ctx.fillStyle = 'rgba(2,10,4,0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#00c832';
      ctx.font = fontSize + 'px "Share Tech Mono", monospace';
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(char, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.98) drops[i] = 0;
        drops[i]++;
      }
    }
    window._bgMatrixInterval = setInterval(draw, 80);
  }

  window.initBootMatrix = initBootMatrix;
  window.initBgMatrix = initBgMatrix;
})();
