/* ═══════════════════════════════════════════════════
   DATABASE MODULE — database.js
   FiveM kayıt yönetimi — GitHub JSON backend
   Tüm değişiklikler otomatik olarak GitHub'a push edilir
═══════════════════════════════════════════════════ */

(function() {

  const DB_FILE = window.LEGION_CONFIG.dbFile; // "data/records.json"
  let records    = [];    // In-memory cache
  let dbFileSha  = null;  // Current SHA of records.json (needed for updates)
  let editingId  = null;  // Currently editing record ID (null = new)
  let photoFile  = null;  // Selected photo File object
  let photoIsUrl = null;  // Existing photo URL when editing (keep if no new file)

  // ─── GITHUB HELPERS ─────────────────────────────

  async function fetchDB() {
    const cfg = window.LEGION_CONFIG;
    const url = `https://api.github.com/repos/${cfg.githubUser}/${cfg.githubRepo}/contents/${DB_FILE}`;
    const res = await fetch(url, {
      headers: { Authorization: `token ${cfg.githubToken}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.status === 404) {
      dbFileSha = null;
      return [];
    }
    if (!res.ok) throw new Error(`GitHub API: ${res.status}`);
    const data = await res.json();
    dbFileSha = data.sha;
    try {
      const decoded = atob(data.content.replace(/\n/g, ''));
      return JSON.parse(decoded);
    } catch {
      return [];
    }
  }

  async function pushDB(newRecords, commitMsg) {
    const cfg = window.LEGION_CONFIG;
    const url = `https://api.github.com/repos/${cfg.githubUser}/${cfg.githubRepo}/contents/${DB_FILE}`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(newRecords, null, 2))));
    const body = { message: commitMsg, content };
    if (dbFileSha) body.sha = dbFileSha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${cfg.githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const result = await res.json();
    dbFileSha = result.content.sha;
    return result;
  }

  async function uploadPhoto(file) {
    const cfg = window.LEGION_CONFIG;
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const path = `data/photos/${timestamp}.${ext}`;
    const url = `https://api.github.com/repos/${cfg.githubUser}/${cfg.githubRepo}/contents/${path}`;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `token ${cfg.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: `[LEGION] Photo upload: ${path}`,
            content: base64
          })
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          return reject(new Error(e.message || `HTTP ${res.status}`));
        }
        const data = await res.json();
        // Use raw URL
        const rawUrl = `https://raw.githubusercontent.com/${cfg.githubUser}/${cfg.githubRepo}/${cfg.branch}/${path}`;
        resolve(rawUrl);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─── MODAL ───────────────────────────────────────

  function openModal(mode, record) {
    editingId = mode === 'edit' ? record.id : null;
    photoFile = null;
    photoIsUrl = null;

    const modal   = document.getElementById('db-modal');
    const title   = document.getElementById('modal-title');
    const form    = document.getElementById('db-form');
    const log     = document.getElementById('modal-log');

    modal.classList.remove('hidden');
    form.reset();
    clearErrors();
    log.innerHTML = '';

    document.getElementById('field-edit-id').value = editingId || '';
    title.textContent = mode === 'edit' ? 'KAYIT DÜZENLE' : 'YENİ VERİ KAYDI';

    if (mode === 'edit' && record) {
      document.getElementById('field-name').value     = record.name     || '';
      document.getElementById('field-plate').value    = record.plate    || '';
      document.getElementById('field-phone').value    = record.phone    || '';
      document.getElementById('field-job').value      = record.job      || '';
      document.getElementById('field-location').value = record.location || '';
      document.getElementById('field-note').value     = record.note     || '';

      // Show existing photo
      if (record.photoUrl) {
        photoIsUrl = record.photoUrl;
        showPhotoPreview(record.photoUrl);
      }
    } else {
      resetPhotoPreview();
    }

    // Log start
    appendModalLog(`[${mode === 'edit' ? 'DÜZENLE' : 'YENİ'}] Form hazırlandı.`, 'info');
  }

  function closeModal() {
    document.getElementById('db-modal').classList.add('hidden');
    editingId = null;
    photoFile = null;
    photoIsUrl = null;
  }

  // ─── PHOTO PREVIEW ───────────────────────────────

  function showPhotoPreview(src) {
    document.getElementById('photo-placeholder').style.display = 'none';
    const img = document.getElementById('photo-preview');
    img.src = src;
    img.style.display = 'block';
  }

  function resetPhotoPreview() {
    document.getElementById('photo-placeholder').style.display = 'flex';
    const img = document.getElementById('photo-preview');
    img.src = '';
    img.style.display = 'none';
    document.getElementById('field-photo').value = '';
  }

  // ─── VALIDATION ──────────────────────────────────

  const FIELDS = [
    { id: 'field-name',     errId: 'err-name',     label: 'Ad Soyad' },
    { id: 'field-plate',    errId: 'err-plate',     label: 'Plaka' },
    { id: 'field-phone',    errId: 'err-phone',     label: 'Telefon' },
    { id: 'field-job',      errId: 'err-job',       label: 'Meslek' },
    { id: 'field-location', errId: 'err-location',  label: 'Lokasyon' },
    { id: 'field-note',     errId: 'err-note',      label: 'Not' },
  ];

  function validateForm() {
    clearErrors();
    let valid = true;

    FIELDS.forEach(f => {
      const el = document.getElementById(f.id);
      const val = el.value.trim();
      if (!val) {
        showError(f.id, f.errId, `${f.label} boş bırakılamaz.`);
        valid = false;
      }
    });

    // Photo required only for new entries
    if (!editingId && !photoFile) {
      showError('photo-zone', 'err-photo', 'Fotoğraf zorunludur.');
      valid = false;
    }

    return valid;
  }

  function showError(fieldId, errId, msg) {
    const el = document.getElementById(fieldId);
    const errEl = document.getElementById(errId);
    if (el) el.classList.add('error');
    if (errEl) errEl.textContent = msg;
  }

  function clearErrors() {
    FIELDS.forEach(f => {
      const el = document.getElementById(f.id);
      const errEl = document.getElementById(f.errId);
      if (el) el.classList.remove('error');
      if (errEl) errEl.textContent = '';
    });
    const photoZone = document.getElementById('photo-zone');
    const errPhoto = document.getElementById('err-photo');
    if (photoZone) photoZone.classList.remove('error');
    if (errPhoto) errPhoto.textContent = '';
  }

  // ─── FORM SUBMIT ─────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
      appendModalLog('[HATA]  Eksik alanlar var. Lütfen tümünü doldurun.', 'err');
      return;
    }

    const btnLabel   = document.getElementById('modal-btn-label');
    const btnSpinner = document.getElementById('modal-btn-spinner');
    const submitBtn  = document.getElementById('modal-submit-btn');
    const cancelBtn  = document.getElementById('modal-cancel-btn');

    btnLabel.textContent = 'İŞLENİYOR...';
    btnSpinner.classList.remove('hidden');
    submitBtn.disabled = true;
    cancelBtn.disabled = true;

    try {
      const name     = document.getElementById('field-name').value.trim();
      const plate    = document.getElementById('field-plate').value.trim().toUpperCase();
      const phone    = document.getElementById('field-phone').value.trim();
      const job      = document.getElementById('field-job').value.trim();
      const location = document.getElementById('field-location').value.trim();
      const note     = document.getElementById('field-note').value.trim();

      let photoUrl = photoIsUrl || null;

      // Upload photo if new file selected
      if (photoFile) {
        appendModalLog('[FOTOĞRAF]  GitHub\'a fotoğraf yükleniyor...', 'out');
        photoUrl = await uploadPhoto(photoFile);
        appendModalLog(`[TAMAM]     Fotoğraf yüklendi.`, 'info');
      }

      if (!photoUrl) {
        appendModalLog('[HATA]  Fotoğraf yüklenemedi.', 'err');
        return;
      }

      const now = new Date().toLocaleString('tr-TR');

      if (editingId) {
        // UPDATE existing record
        const idx = records.findIndex(r => r.id === editingId);
        if (idx !== -1) {
          records[idx] = { ...records[idx], name, plate, phone, job, location, note, photoUrl, updatedAt: now };
          appendModalLog(`[GÜNCELLEME] Kayıt düzenleniyor (ID: ${editingId})...`, 'out');
        }
        await pushDB(records, `[LEGION] Kayıt güncellendi: ${name}`);
        appendModalLog(`[TAMAM]     Kayıt başarıyla güncellendi ve GitHub'a gönderildi.`, 'info');
        flashRow(editingId);
      } else {
        // CREATE new record
        const newRecord = {
          id: `rec_${Date.now()}`,
          name, plate, phone, job, location, note, photoUrl,
          createdAt: now,
          updatedAt: now
        };
        records.unshift(newRecord);
        appendModalLog(`[YENİ]      Yeni kayıt oluşturuluyor: ${name}...`, 'out');
        await pushDB(records, `[LEGION] Yeni kayıt: ${name}`);
        appendModalLog(`[TAMAM]     Kayıt başarıyla oluşturuldu ve GitHub'a gönderildi.`, 'info');
      }

      renderTable(records);
      updateCount(records.length);
      setTimeout(() => closeModal(), 1500);

    } catch (err) {
      appendModalLog(`[HATA]  ${err.message}`, 'err');
    } finally {
      btnLabel.textContent = 'VERİTABANINA İŞLE';
      btnSpinner.classList.add('hidden');
      submitBtn.disabled = false;
      cancelBtn.disabled = false;
    }
  }

  // ─── DELETE ──────────────────────────────────────

  async function deleteRecord(id) {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    if (!confirm(`"${rec.name}" kaydı silinsin mi? Bu işlem geri alınamaz.`)) return;

    try {
      records = records.filter(r => r.id !== id);
      await pushDB(records, `[LEGION] Kayıt silindi: ${rec.name}`);
      renderTable(records);
      updateCount(records.length);
      // Log to upload terminal too
      Gallery.logUpload(`[VERİTABANI] "${rec.name}" kaydı silindi ve GitHub'a push edildi.`, 'info');
    } catch (err) {
      alert(`Silme hatası: ${err.message}`);
      // Restore
      records.push(rec);
      renderTable(records);
    }
  }

  // ─── TABLE RENDER ────────────────────────────────

  function renderTable(data) {
    const tbody   = document.getElementById('db-tbody');
    const table   = document.getElementById('db-table');
    const emptyEl = document.getElementById('db-empty');
    const loading = document.getElementById('db-loading');

    loading.classList.add('hidden');

    if (!data || data.length === 0) {
      table.classList.add('hidden');
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    table.classList.remove('hidden');
    tbody.innerHTML = '';

    data.forEach(rec => {
      const tr = document.createElement('tr');
      tr.id = `row-${rec.id}`;
      tr.innerHTML = `
        <td class="td-photo">
          ${rec.photoUrl
            ? `<img class="db-record-photo" src="${rec.photoUrl}" alt="${rec.name}" data-url="${rec.photoUrl}"/>`
            : `<div style="width:52px;height:40px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:0.6rem;color:var(--green-dark);">YOK</div>`
          }
        </td>
        <td class="td-name">${escHtml(rec.name)}</td>
        <td>${escHtml(rec.plate)}</td>
        <td>${escHtml(rec.phone)}</td>
        <td>${escHtml(rec.job)}</td>
        <td>${escHtml(rec.location)}</td>
        <td class="td-note" title="${escHtml(rec.note)}">${escHtml(rec.note)}</td>
        <td class="td-actions">
          <div class="td-actions-wrap">
            <button class="tbl-btn tbl-btn-edit"   data-id="${rec.id}">DÜZENLE</button>
            <button class="tbl-btn tbl-btn-delete" data-id="${rec.id}">SİL</button>
          </div>
        </td>
      `;

      // Photo click → lightbox
      const photo = tr.querySelector('.db-record-photo');
      if (photo) {
        photo.addEventListener('click', () => {
          openLightboxPhoto(rec.photoUrl);
        });
      }

      // Edit button
      tr.querySelector('.tbl-btn-edit').addEventListener('click', () => {
        openModal('edit', rec);
      });

      // Delete button
      tr.querySelector('.tbl-btn-delete').addEventListener('click', () => {
        deleteRecord(rec.id);
      });

      tbody.appendChild(tr);
    });
  }

  function flashRow(id) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
      row.classList.remove('row-flash');
      void row.offsetWidth; // reflow
      row.classList.add('row-flash');
    }
  }

  function openLightboxPhoto(url) {
    const lb    = document.getElementById('lightbox');
    const lbImg = document.getElementById('lightbox-img');
    const lbVid = document.getElementById('lightbox-video');
    lb.classList.remove('hidden');
    lbImg.src = url;
    lbImg.style.display = 'block';
    lbVid.style.display = 'none';
    lbVid.src = '';
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function updateCount(n) {
    const el = document.getElementById('search-count');
    if (el) el.textContent = `${n} kayıt`;
  }

  // ─── SEARCH ──────────────────────────────────────

  function initSearch() {
    const input = document.getElementById('db-search');
    if (!input) return;
    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();
      if (!q) {
        renderTable(records);
        updateCount(records.length);
        return;
      }
      const filtered = records.filter(r =>
        (r.name     || '').toLowerCase().includes(q) ||
        (r.plate    || '').toLowerCase().includes(q) ||
        (r.phone    || '').toLowerCase().includes(q) ||
        (r.job      || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        (r.note     || '').toLowerCase().includes(q)
      );
      renderTable(filtered);
      updateCount(filtered.length);
    });
  }

  // ─── MODAL LOG ───────────────────────────────────

  function appendModalLog(msg, type) {
    const log = document.getElementById('modal-log');
    if (!log) return;
    const line = document.createElement('div');
    line.className = `t-line t-${type}`;
    line.textContent = msg;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  // ─── LOAD DATABASE ───────────────────────────────

  async function loadDatabase() {
    const loading = document.getElementById('db-loading');
    const table   = document.getElementById('db-table');
    const emptyEl = document.getElementById('db-empty');

    loading.classList.remove('hidden');
    table.classList.add('hidden');
    emptyEl.classList.add('hidden');

    try {
      records = await fetchDB();
      renderTable(records);
      updateCount(records.length);
    } catch (err) {
      loading.innerHTML = `<div class="empty-icon" style="color:var(--red)">✕</div><p style="color:var(--red)">Yükleme hatası: ${err.message}</p>`;
    }
  }

  // ─── INIT ─────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {

    // Add entry button
    document.getElementById('add-entry-btn')?.addEventListener('click', () => {
      openModal('new', null);
    });

    // Modal close
    document.getElementById('db-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('modal-cancel-btn')?.addEventListener('click', closeModal);
    document.getElementById('db-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('db-modal-overlay')) closeModal();
    });

    // Form submit
    document.getElementById('db-form')?.addEventListener('submit', handleSubmit);

    // Photo zone click
    const photoZone = document.getElementById('photo-zone');
    const photoInput = document.getElementById('field-photo');
    if (photoZone && photoInput) {
      photoZone.addEventListener('click', () => photoInput.click());
      photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          showError('photo-zone', 'err-photo', 'Sadece görsel dosyası seçin.');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          showError('photo-zone', 'err-photo', 'Dosya 10MB\'dan büyük olamaz.');
          return;
        }
        photoFile = file;
        const url = URL.createObjectURL(file);
        showPhotoPreview(url);
        document.getElementById('err-photo').textContent = '';
      });
    }

    // Search
    initSearch();

    // Keyboard close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('db-modal');
        if (!modal.classList.contains('hidden')) closeModal();
      }
    });
  });

  // ─── EXPORT ─────────────────────────────────────
  window.Database = { loadDatabase };

})();
