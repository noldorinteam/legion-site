/* LEGION shared incident-chain and relationship board */
(function () {
  'use strict';

  const CHAINS_FILE = 'data/incident-chains.json';
  const LOCAL_KEY = 'legion:incident-chains-draft';
  const TYPE_LABELS = {
    event: 'OLAY',
    person: 'KİŞİ',
    vehicle: 'ARAÇ',
    location: 'MEKÂN',
    evidence: 'KANIT',
    group: 'GRUP'
  };

  let chains = [];
  let activeId = null;
  let fileSha = null;
  let initialized = false;
  let loaded = false;
  let selectedNodeId = null;
  let connectionMode = false;
  let connectionStartId = null;
  let dragging = null;

  function config() { return window.LEGION_CONFIG; }
  function apiUrl() {
    return `https://api.github.com/repos/${config().githubUser}/${config().githubRepo}/contents/${CHAINS_FILE}`;
  }
  function headers(json = false) {
    return {
      Authorization: `token ${config().githubToken}`,
      Accept: 'application/vnd.github.v3+json',
      ...(json ? { 'Content-Type': 'application/json' } : {})
    };
  }
  function encode(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  function decode(value) {
    const binary = atob(value.replace(/\s/g, ''));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0))));
  }
  function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[char]);
  }
  function uid(prefix) {
    return `${prefix}_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`;
  }
  function activeChain() {
    return chains.find(chain => chain.id === activeId) || null;
  }
  function markDirty(message = 'KAYDEDİLMEMİŞ DEĞİŞİKLİK') {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(chains));
    const status = document.getElementById('chain-save-status');
    if (status) {
      status.className = 'dirty';
      status.textContent = message;
    }
  }
  function setStatus(message, type = '') {
    const status = document.getElementById('chain-save-status');
    if (!status) return;
    status.className = type;
    status.textContent = message;
  }

  async function fetchChains() {
    const response = await fetch(`${apiUrl()}?t=${Date.now()}`, {
      headers: headers(),
      cache: 'no-store'
    });
    if (response.status === 404) {
      fileSha = null;
      return [];
    }
    if (!response.ok) throw new Error(`Zincirler alınamadı (${response.status})`);
    const file = await response.json();
    fileSha = file.sha;
    const parsed = decode(file.content);
    return Array.isArray(parsed) ? parsed : [];
  }

  async function pushChains() {
    const body = {
      message: '[LEGION] Olay zincirleri güncellendi',
      content: encode(chains),
      branch: config().branch
    };
    if (fileSha) body.sha = fileSha;
    const response = await fetch(apiUrl(), {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify(body)
    });
    if (response.status === 409) {
      await fetchChains();
      throw new Error('Başka bir kullanıcı zincirleri değiştirdi. Sayfa yenilendi; değişikliğinizi tekrar uygulayın.');
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Zincir kaydedilemedi (${response.status})`);
    }
    const result = await response.json();
    fileSha = result.content.sha;
    localStorage.removeItem(LOCAL_KEY);
  }

  function renderList() {
    const list = document.getElementById('chain-list');
    if (!list) return;
    if (!chains.length) {
      list.innerHTML = '<div class="chain-list-empty">Henüz kayıtlı zincir yok.</div>';
      return;
    }
    list.innerHTML = chains.map(chain => `
      <button class="chain-list-item ${chain.id === activeId ? 'active' : ''}" data-chain-id="${escapeHTML(chain.id)}">
        <b>${escapeHTML(chain.title)}</b>
        <span>${chain.nodes.length} KUTU · ${chain.edges.length} BAĞLANTI</span>
      </button>
    `).join('');
  }

  function renderEditor() {
    const empty = document.getElementById('chain-empty');
    const editor = document.getElementById('chain-editor');
    const chain = activeChain();
    empty?.classList.toggle('hidden', Boolean(chain));
    editor?.classList.toggle('hidden', !chain);
    renderList();
    if (!chain) return;
    renderNodes();
    renderLines();
  }

  function renderNodes() {
    const container = document.getElementById('chain-nodes');
    const chain = activeChain();
    if (!container || !chain) return;
    container.innerHTML = chain.nodes.map(node => `
      <article class="chain-node type-${escapeHTML(node.type)} ${node.id === selectedNodeId ? 'selected' : ''} ${node.id === connectionStartId ? 'connection-start' : ''}"
        data-node-id="${escapeHTML(node.id)}" style="left:${node.x}px;top:${node.y}px">
        <button class="chain-node-delete" data-delete-node="${escapeHTML(node.id)}" title="Kutuyu sil">×</button>
        <span class="chain-node-type">${TYPE_LABELS[node.type] || 'KUTU'}</span>
        <h3>${escapeHTML(node.title)}</h3>
        ${node.detail ? `<p>${escapeHTML(node.detail)}</p>` : ''}
        <small>SÜRÜKLE · TAŞI</small>
      </article>
    `).join('');
  }

  function renderLines() {
    const svg = document.getElementById('chain-lines');
    const chain = activeChain();
    if (!svg || !chain) return;
    const nodeMap = new Map(chain.nodes.map(node => [node.id, node]));
    svg.setAttribute('viewBox', '0 0 1400 760');
    svg.innerHTML = `
      <defs>
        <marker id="chain-arrow" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z"></path>
        </marker>
      </defs>
      ${chain.edges.map(edge => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return '';
        const x1 = from.x + 110;
        const y1 = from.y + 58;
        const x2 = to.x + 110;
        const y2 = to.y + 58;
        const curve = Math.max(55, Math.abs(x2 - x1) * 0.38);
        return `<path class="chain-edge" d="M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}" marker-end="url(#chain-arrow)"></path>`;
      }).join('')}
    `;
  }

  function createChain() {
    const input = document.getElementById('chain-title-input');
    const title = input.value.trim();
    if (!title) {
      input.focus();
      setStatus('ÖNCE ZİNCİR ADINI YAZIN', 'error');
      return;
    }
    const chain = {
      id: uid('chain'),
      title,
      nodes: [],
      edges: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    chains.unshift(chain);
    activeId = chain.id;
    selectedNodeId = null;
    input.value = '';
    markDirty('YENİ ZİNCİR KAYDEDİLMEDİ');
    renderEditor();
  }

  function addNode() {
    const chain = activeChain();
    const type = document.getElementById('node-type').value;
    const titleInput = document.getElementById('node-title');
    const detailInput = document.getElementById('node-detail');
    const title = titleInput.value.trim();
    if (!chain || !title) {
      titleInput.focus();
      setStatus('KUTU BAŞLIĞINI YAZIN', 'error');
      return;
    }
    const index = chain.nodes.length;
    const node = {
      id: uid('node'),
      type,
      title,
      detail: detailInput.value.trim(),
      x: 35 + (index % 4) * 260,
      y: 35 + Math.floor(index / 4) * 155
    };
    chain.nodes.push(node);
    chain.updatedAt = new Date().toISOString();
    selectedNodeId = node.id;
    titleInput.value = '';
    detailInput.value = '';
    markDirty();
    renderEditor();
  }

  function deleteNode(nodeId) {
    const chain = activeChain();
    if (!chain) return;
    chain.nodes = chain.nodes.filter(node => node.id !== nodeId);
    chain.edges = chain.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId);
    if (selectedNodeId === nodeId) selectedNodeId = null;
    if (connectionStartId === nodeId) connectionStartId = null;
    markDirty();
    renderEditor();
  }

  function handleNodeSelection(nodeId) {
    const chain = activeChain();
    if (!chain) return;
    selectedNodeId = nodeId;
    if (!connectionMode) {
      renderNodes();
      return;
    }
    if (!connectionStartId) {
      connectionStartId = nodeId;
      setStatus('ŞİMDİ BAĞLANACAK İKİNCİ KUTUYA TIKLAYIN', 'connecting');
      renderNodes();
      return;
    }
    if (connectionStartId === nodeId) return;
    const duplicate = chain.edges.some(edge =>
      (edge.from === connectionStartId && edge.to === nodeId) ||
      (edge.from === nodeId && edge.to === connectionStartId)
    );
    if (!duplicate) {
      chain.edges.push({ id: uid('edge'), from: connectionStartId, to: nodeId });
      chain.updatedAt = new Date().toISOString();
      markDirty('BAĞLANTI EKLENDİ · KAYDETMEYİ UNUTMAYIN');
    }
    connectionStartId = null;
    renderEditor();
  }

  function toggleConnectionMode() {
    connectionMode = !connectionMode;
    connectionStartId = null;
    document.getElementById('connect-node-btn')?.classList.toggle('active', connectionMode);
    document.getElementById('connect-help')?.classList.toggle('visible', connectionMode);
    setStatus(connectionMode ? 'BAĞLANTI MODU AÇIK' : '', connectionMode ? 'connecting' : '');
    renderNodes();
  }

  function clearSelectedLinks() {
    const chain = activeChain();
    if (!chain || !selectedNodeId) {
      setStatus('ÖNCE BİR KUTU SEÇİN', 'error');
      return;
    }
    chain.edges = chain.edges.filter(edge => edge.from !== selectedNodeId && edge.to !== selectedNodeId);
    markDirty('SEÇİLİ KUTUNUN BAĞLANTILARI SİLİNDİ');
    renderLines();
    renderList();
  }

  function deleteActiveChain() {
    const chain = activeChain();
    if (!chain || !confirm(`"${chain.title}" olay zinciri silinsin mi?`)) return;
    chains = chains.filter(item => item.id !== chain.id);
    activeId = chains[0]?.id || null;
    selectedNodeId = null;
    markDirty('ZİNCİR SİLİNDİ · KAYDETMEYİ UNUTMAYIN');
    renderEditor();
  }

  function startDrag(event, nodeElement) {
    if (event.target.closest('.chain-node-delete') || connectionMode) return;
    const chain = activeChain();
    const node = chain?.nodes.find(item => item.id === nodeElement.dataset.nodeId);
    const board = document.getElementById('chain-board');
    if (!node || !board) return;
    const boardRect = board.getBoundingClientRect();
    dragging = {
      node,
      element: nodeElement,
      boardRect,
      offsetX: event.clientX - boardRect.left + board.scrollLeft - node.x,
      offsetY: event.clientY - boardRect.top + board.scrollTop - node.y
    };
    nodeElement.setPointerCapture(event.pointerId);
    nodeElement.classList.add('dragging');
  }

  function moveDrag(event) {
    if (!dragging) return;
    const board = document.getElementById('chain-board');
    const x = event.clientX - dragging.boardRect.left + board.scrollLeft - dragging.offsetX;
    const y = event.clientY - dragging.boardRect.top + board.scrollTop - dragging.offsetY;
    dragging.node.x = Math.max(8, Math.min(1170, Math.round(x)));
    dragging.node.y = Math.max(8, Math.min(630, Math.round(y)));
    dragging.element.style.left = `${dragging.node.x}px`;
    dragging.element.style.top = `${dragging.node.y}px`;
    renderLines();
  }

  function endDrag() {
    if (!dragging) return;
    dragging.element.classList.remove('dragging');
    dragging = null;
    markDirty();
  }

  async function save() {
    if (!chains.length) return;
    const button = document.getElementById('save-chain-btn');
    button.disabled = true;
    setStatus('GITHUB’A KAYDEDİLİYOR...', 'saving');
    try {
      const chain = activeChain();
      if (chain) chain.updatedAt = new Date().toISOString();
      await pushChains();
      setStatus('✓ ZİNCİR KAYDEDİLDİ', 'success');
      renderList();
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  }

  function bind() {
    if (initialized) return;
    initialized = true;
    document.getElementById('create-chain-btn')?.addEventListener('click', createChain);
    document.getElementById('chain-title-input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') createChain();
    });
    document.getElementById('add-node-btn')?.addEventListener('click', addNode);
    document.getElementById('node-detail')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') addNode();
    });
    document.getElementById('connect-node-btn')?.addEventListener('click', toggleConnectionMode);
    document.getElementById('clear-node-links-btn')?.addEventListener('click', clearSelectedLinks);
    document.getElementById('delete-chain-btn')?.addEventListener('click', deleteActiveChain);
    document.getElementById('save-chain-btn')?.addEventListener('click', save);
    document.getElementById('chain-list')?.addEventListener('click', event => {
      const item = event.target.closest('[data-chain-id]');
      if (!item) return;
      activeId = item.dataset.chainId;
      selectedNodeId = null;
      connectionStartId = null;
      renderEditor();
    });
    document.getElementById('chain-nodes')?.addEventListener('click', event => {
      const deleteButton = event.target.closest('[data-delete-node]');
      if (deleteButton) {
        deleteNode(deleteButton.dataset.deleteNode);
        return;
      }
      const node = event.target.closest('[data-node-id]');
      if (node) handleNodeSelection(node.dataset.nodeId);
    });
    document.getElementById('chain-nodes')?.addEventListener('pointerdown', event => {
      const node = event.target.closest('[data-node-id]');
      if (node) startDrag(event, node);
    });
    document.getElementById('chain-nodes')?.addEventListener('pointermove', moveDrag);
    document.getElementById('chain-nodes')?.addEventListener('pointerup', endDrag);
    document.getElementById('chain-nodes')?.addEventListener('pointercancel', endDrag);
  }

  async function load() {
    bind();
    if (loaded) {
      renderEditor();
      return;
    }
    setStatus('ZİNCİRLER YÜKLENİYOR...', 'saving');
    try {
      chains = await fetchChains();
      const localDraft = localStorage.getItem(LOCAL_KEY);
      if (localDraft) {
        const draft = JSON.parse(localDraft);
        if (Array.isArray(draft) && confirm('Kaydedilmemiş yerel olay zinciri taslağı bulundu. Taslak geri yüklensin mi?')) {
          chains = draft;
          setStatus('YEREL TASLAK GERİ YÜKLENDİ', 'dirty');
        } else {
          localStorage.removeItem(LOCAL_KEY);
          setStatus('');
        }
      } else {
        setStatus('');
      }
      activeId = chains[0]?.id || null;
      loaded = true;
      renderEditor();
    } catch (error) {
      const localDraft = localStorage.getItem(LOCAL_KEY);
      chains = localDraft ? JSON.parse(localDraft) : [];
      activeId = chains[0]?.id || null;
      loaded = true;
      renderEditor();
      setStatus(`${error.message} · Yerel taslak kullanılıyor.`, 'error');
    }
  }

  window.IncidentChains = { load };
})();
