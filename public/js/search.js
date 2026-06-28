/* ===================================================
   ElectroVision AI — search.js
   Search bar, autocomplete, recent searches, results rendering
=================================================== */

const EVSearch = (() => {
  const RECENT_KEY = 'ev_recent_searches';
  const MAX_RECENT = 8;

  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
    catch { return []; }
  }

  function addRecent(term) {
    if (!term) return;
    let recent = getRecent().filter(t => t.toLowerCase() !== term.toLowerCase());
    recent.unshift(term);
    recent = recent.slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  }

  function renderRecent(containerEl, onClick) {
    const recent = getRecent();
    containerEl.innerHTML = '';
    if (recent.length === 0) return;
    const label = document.createElement('span');
    label.textContent = 'Recent: ';
    containerEl.appendChild(label);
    recent.forEach(term => {
      const chip = document.createElement('button');
      chip.className = 'search-tag';
      chip.style.marginRight = '6px';
      chip.textContent = term;
      chip.addEventListener('click', () => onClick(term));
      containerEl.appendChild(chip);
    });
  }

  function renderAutocomplete(listEl, query) {
    listEl.innerHTML = '';
    if (!query || query.length < 2) return;
    const results = EVComponents.search(query).slice(0, 8);
    results.forEach(c => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = `${c.name} — ${c.category}`;
      item.dataset.id = c.id;
      listEl.appendChild(item);
    });
  }

  function renderResults(gridEl, results, onSelect) {
    gridEl.innerHTML = '';
    if (results.length === 0) {
      gridEl.innerHTML = `<p style="color:var(--text-2);grid-column:1/-1;text-align:center;">No components found.</p>`;
      return;
    }
    results.forEach(c => {
      const card = document.createElement('div');
      card.className = 'component-card';
      card.innerHTML = `
        <span class="cc-cat">${c.category}</span>
        <h4>${c.name}</h4>
        <p>${c.description}</p>
      `;
      card.addEventListener('click', () => onSelect(c));
      gridEl.appendChild(card);
    });
  }

  return { getRecent, addRecent, renderRecent, renderAutocomplete, renderResults };
})();
