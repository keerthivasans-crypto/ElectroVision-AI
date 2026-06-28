/* ===================================================
   ElectroVision AI — database.js
   IndexedDB wrapper + component dataset loader
=================================================== */

const EV_DB_NAME = 'electrovision-ai-db';
const EV_DB_VERSION = 1;

const EVDatabase = (() => {
  let dbInstance = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (dbInstance) return resolve(dbInstance);
      const req = indexedDB.open(EV_DB_NAME, EV_DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('history')) {
          const store = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('componentId', 'componentId');
        }
        if (!db.objectStoreNames.contains('trainingData')) {
          db.createObjectStore('trainingData', { keyPath: 'id', autoIncrement: true });
        }
      };

      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function add(storeName, record) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).add(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function getAll(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function deleteRecord(storeName, id) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async function clearStore(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  return { open, add, getAll, delete: deleteRecord, clear: clearStore };
})();

/* ===================================================
   Component dataset loader (components.json)
=================================================== */
const EVComponents = (() => {
  let components = [];
  let loaded = false;

  async function load() {
    if (loaded) return components;
    try {
      const res = await fetch('/data/components.json');
      const data = await res.json();
      components = data.components || [];
      loaded = true;
    } catch (err) {
      console.error('Failed to load components.json', err);
      components = [];
    }
    return components;
  }

  function all() {
    return components;
  }

  function byId(id) {
    return components.find(c => c.id === id);
  }

  function findByNameLoose(name) {
    if (!name) return null;
    const n = name.toLowerCase().trim();
    return components.find(c =>
      c.name.toLowerCase() === n ||
      (c.aliases || []).some(a => a.toLowerCase() === n)
    ) || components.find(c =>
      c.name.toLowerCase().includes(n) ||
      (c.aliases || []).some(a => n.includes(a.toLowerCase()) || a.toLowerCase().includes(n))
    ) || null;
  }

  function search(query) {
    if (!query) return [];
    const q = query.toLowerCase().trim();
    return components.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.aliases || []).some(a => a.toLowerCase().includes(q)) ||
      c.description.toLowerCase().includes(q)
    );
  }

  function categories() {
    return [...new Set(components.map(c => c.category))].sort();
  }

  return { load, all, byId, findByNameLoose, search, categories };
})();
