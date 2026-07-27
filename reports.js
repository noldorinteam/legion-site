/* LEGION shared incident reports */
(function () {
  'use strict';

  const REPORTS_FILE = 'data/reports.json';
  let reports = [];
  let fileSha = null;
  let initialized = false;

  function config() { return window.LEGION_CONFIG; }
  function headers(json = false) {
    return {
      Authorization: `token ${config().githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      ...(json ? { 'Content-Type': 'application/json' } : {})
    };
  }
  function apiUrl(path) {
    return `https://api.github.com/repos/${config().githubUser}/${config().githubRepo}/contents/${path}`;
  }
  function encode(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  function decode(value) {
    const binary = atob(value.replace(/\s/g, ''));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
  }
  function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }

  async function fetchReports() {
    const response = await fetch(`${apiUrl(REPORTS_FILE)}?t=${Date.now()}`, {
      headers: headers(), cache: 'no-store'
    });
    if (response.status === 404) {
      fileSha = null;
      return [];
    }
    if (!response.ok) throw new Error(`Raporlar alınamadı (${response.status})`);
    const file = await response.json();
    fileSha = file.sha;
    const parsed = decode(file.content);
    return Array.isArray(parsed) ? parsed : [];
  }

  async function pushReports(nextReports, message, options = {}) {
    const { retry = true, removedId = null } = options;
    const body = { message, content: encode(nextReports), branch: config().branch };
    if (fileSha) body.sha = fileSha;
    const response = await fetch(apiUrl(REPORTS_FILE), {
      method: 'PUT', headers: headers(true), body: JSON.stringify(body)
    });
    if (response.status === 409 && retry) {
      const latest = await fetchReports();
      const merged = removedId
        ? latest.filter(report => report.id !== removedId)
        : [...nextReports, ...latest].filter((report, index, list) =>
            list.findIndex(item => item.id === report.id) === index
          );
      reports = merged;
      return pushReports(merged, message, { retry: false, removedId });
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Rapor kaydedilemedi (${response.status})`);
    }
    const result = await response.json();
    fileSha = result.content.sha;
  }

  async function uploadPhoto(file) {
    file = await window.ImageUtils.optimize(file, { maxDimension: 1600, quality: 0.8 });
    const extension = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const path = `data/report-photos/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${extension}`;
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const response = await fetch(apiUrl(path), {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify({
        message: '[LEGION] Rapor fotoğrafı eklendi',
        content: base64,
        branch: config().branch
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Fotoğraf yüklenemedi');
    }
    return `https://raw.githubusercontent.com/${config().githubUser}/${config().githubRepo}/${config().branch}/${path}`;
  }

  function render(list = reports) {
    const container = document.getElementById('reports-list');
    const count = document.getElementById('report-count');
    if (!container) return;
    count.textContent = `${list.length} RAPOR`;
    if (!list.length) {
      container.innerHTML = '<div class="reports-empty"><b>RAPOR BULUNAMADI</b><span>İlk olay kaydını oluşturmak için “Yeni Rapor” düğmesini kullanın.</span></div>';
      return;
    }
    container.innerHTML = list.map(report => `
      <article class="report-card">
        ${report.photoUrl ? `<button class="report-photo" data-photo="${escapeHTML(report.photoUrl)}"><img src="${escapeHTML(report.photoUrl)}" alt="${escapeHTML(report.title)}" loading="lazy"></button>` : ''}
        <div class="report-content">
          <div class="report-meta"><span>RAPOR // ${escapeHTML(report.id.slice(-6).toUpperCase())}</span><time>${escapeHTML(report.createdAt)}</time></div>
          <h3>${escapeHTML(report.title)}</h3>
          <div class="report-author"><span>YAZAN</span><b>${escapeHTML(report.author)}</b></div>
          <p>${escapeHTML(report.incident)}</p>
          ${window.LegionAuth?.isAdmin() ? `<button class="report-delete" data-delete="${escapeHTML(report.id)}">RAPORU SİL</button>` : ''}
        </div>
      </article>`).join('');

    container.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {
      const lightbox = document.getElementById('lightbox');
      const image = document.getElementById('lightbox-img');
      const video = document.getElementById('lightbox-video');
      lightbox.classList.remove('hidden');
      image.src = button.dataset.photo;
      image.style.display = 'block';
      video.style.display = 'none';
    }));
    container.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', () => removeReport(button.dataset.delete)));
  }

  async function removeReport(id) {
    if (!window.LegionAuth?.isAdmin()) return;
    const report = reports.find(item => item.id === id);
    if (!report || !confirm(`“${report.title}” raporu silinsin mi?`)) return;
    const previous = reports;
    reports = reports.filter(item => item.id !== id);
    render();
    try {
      await pushReports(reports, `[LEGION] Rapor silindi: ${report.title}`, { removedId: id });
    } catch (error) {
      reports = previous;
      render();
      alert(error.message);
    }
  }

  function toggleForm(show) {
    document.getElementById('report-form-panel')?.classList.toggle('hidden', !show);
    if (show) document.getElementById('report-title')?.focus();
  }

  async function submitReport(event) {
    event.preventDefault();
    const title = document.getElementById('report-title').value.trim();
    const author = document.getElementById('report-author').value.trim();
    const incident = document.getElementById('report-incident').value.trim();
    const photo = document.getElementById('report-photo').files[0];
    const status = document.getElementById('report-form-status');
    const button = document.getElementById('save-report-btn');
    if (!title || !author || !incident) return;
    if (photo && photo.size > 8 * 1024 * 1024) {
      status.className = 'error';
      status.textContent = 'Fotoğraf 8 MB’dan büyük olamaz.';
      return;
    }
    button.disabled = true;
    status.className = 'saving';
    status.textContent = photo ? 'Fotoğraf yükleniyor...' : 'Rapor kaydediliyor...';
    try {
      const photoUrl = photo ? await uploadPhoto(photo) : '';
      const report = {
        id: `rpt_${Date.now()}`,
        title, author, incident, photoUrl,
        createdAt: new Date().toLocaleString('tr-TR')
      };
      const latest = await fetchReports();
      reports = [report, ...latest].filter((item, index, list) =>
        list.findIndex(candidate => candidate.id === item.id) === index
      );
      await pushReports(reports, `[LEGION] Yeni rapor: ${title}`);
      event.target.reset();
      document.getElementById('report-photo-name').textContent = 'Dosya seçilmedi · JPG, PNG, WEBP, GIF — en fazla 8 MB';
      status.className = 'success';
      status.textContent = 'Rapor ortak arşive kaydedildi.';
      render();
      setTimeout(() => toggleForm(false), 700);
    } catch (error) {
      reports = reports.filter(item => !item.id.startsWith('rpt_') || item.title !== title);
      status.className = 'error';
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  function bind() {
    if (initialized) return;
    initialized = true;
    document.getElementById('new-report-btn')?.addEventListener('click', () => toggleForm(true));
    document.getElementById('cancel-report-btn')?.addEventListener('click', () => toggleForm(false));
    document.getElementById('report-form')?.addEventListener('submit', submitReport);
    document.getElementById('report-photo')?.addEventListener('change', event => {
      const file = event.target.files[0];
      document.getElementById('report-photo-name').textContent = file ? file.name : 'Dosya seçilmedi';
    });
    document.getElementById('report-search')?.addEventListener('input', event => {
      const query = event.target.value.toLocaleLowerCase('tr-TR').trim();
      render(query ? reports.filter(report =>
        `${report.title} ${report.author} ${report.incident}`.toLocaleLowerCase('tr-TR').includes(query)
      ) : reports);
    });
  }

  async function load() {
    bind();
    const container = document.getElementById('reports-list');
    container.innerHTML = '<div class="reports-loading">RAPORLAR YÜKLENİYOR...</div>';
    try {
      reports = await fetchReports();
      render();
    } catch (error) {
      container.innerHTML = `<div class="reports-empty error"><b>RAPORLAR YÜKLENEMEDİ</b><span>${escapeHTML(error.message)}</span></div>`;
    }
  }

  window.Reports = { load };
})();
