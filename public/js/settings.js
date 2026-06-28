/* ===================================================
   ElectroVision AI — settings.js
   Settings persistence (localStorage)
=================================================== */

const EVSettings = (() => {
  const KEY = 'ev_settings';

  const DEFAULTS = {
    darkMode: true,
    animations: true,
    resolution: '1280x720',
    detectionSpeed: 'balanced',
    voiceEnabled: true,
    language: 'en-US',
    confidenceThreshold: 50,
    mirror: false
  };

  function get() {
    try {
      const stored = JSON.parse(localStorage.getItem(KEY));
      return { ...DEFAULTS, ...(stored || {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function set(partial) {
    const current = get();
    const updated = { ...current, ...partial };
    localStorage.setItem(KEY, JSON.stringify(updated));
    return updated;
  }

  function reset() {
    localStorage.setItem(KEY, JSON.stringify(DEFAULTS));
    return { ...DEFAULTS };
  }

  function applyToDOM() {
    const s = get();
    document.body.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');

    const map = {
      'setting-dark-mode': s.darkMode,
      'setting-animations': s.animations,
      'setting-voice': s.voiceEnabled
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.checked = val;
    });

    const selectMap = {
      'setting-resolution': s.resolution,
      'setting-speed': s.detectionSpeed,
      'setting-language': s.language,
      'resolution-select': s.resolution,
      'tts-lang': s.language
    };
    Object.entries(selectMap).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    const confSlider = document.getElementById('confidence-slider');
    if (confSlider) {
      confSlider.value = s.confidenceThreshold;
      const label = document.getElementById('confidence-value');
      if (label) label.textContent = `${s.confidenceThreshold}%`;
    }
    return s;
  }

  return { get, set, reset, applyToDOM, DEFAULTS };
})();
