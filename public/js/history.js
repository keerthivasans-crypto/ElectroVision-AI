/* ===================================================
   ElectroVision AI — history.js
   Detection history: save, render, filter, export, delete
=================================================== */

const EVHistory = (() => {

  async function save(entry) {
    // entry: { componentId, componentName, category, confidence, image (dataURL), timestamp }
    const record = {
      componentId: entry.componentId || null,
      componentName: entry.componentName,
      category: entry.category || 'Unknown',
      confidence: entry.confidence || 0,
      image: entry.image || null,
      timestamp: Date.now()
    };
    await EVDatabase.add('history', record);
    return record;
  }

  async function getAll() {
    const records = await EVDatabase.getAll('history');
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }

  async function remove(id) {
    return EVDatabase.delete('history', id);
  }

  async function clearAll() {
    return EVDatabase.clear('history');
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function exportJSON() {
    const records = await getAll();
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electrovision-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function render(containerEl, filterText = '', filterCategory = '') {
    const records = await getAll();
    const filtered = records.filter(r => {
      const matchesText = !filterText || r.componentName.toLowerCase().includes(filterText.toLowerCase());
      const matchesCat = !filterCategory || r.category === filterCategory;
      return matchesText && matchesCat;
    });

    containerEl.innerHTML = '';

    if (filtered.length === 0) {
      containerEl.innerHTML = `<div class="history-empty">No history entries yet. Detections are saved automatically.</div>`;
      return;
    }

    filtered.forEach(r => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <img class="history-thumb" src="${r.image || '/icons/icon-192.png'}" alt="${r.componentName}" />
        <div class="history-meta">
          <h5>${r.componentName}</h5>
          <span>${r.category} • ${Math.round(r.confidence)}% confidence • ${formatDate(r.timestamp)}</span>
        </div>
        <div class="history-actions">
          <button class="tool-btn-small" data-action="delete" data-id="${r.id}">🗑</button>
        </div>
      `;
      containerEl.appendChild(item);
    });

    containerEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.currentTarget.dataset.id);
        await remove(id);
        render(containerEl, filterText, filterCategory);
      });
    });
  }

  function populateCategoryFilter(selectEl, categories) {
    selectEl.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }

  return { save, getAll, remove, clearAll, exportJSON, render, populateCategoryFilter, formatDate };
})();
