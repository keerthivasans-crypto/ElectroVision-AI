/* ===================================================
   ElectroVision AI — script.js
   App bootstrap: nav, theme, hero animation, and wiring
   together camera/ai/voice/history/search/settings/training
=================================================== */

let appState = {
  currentComponent: null,
  currentResistorResult: null,
  detectionDebounce: null,
  lastSpokenId: null
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initThemeToggle();
  initHeroAnimation();
  EVCamera.init();

  const settings = EVSettings.applyToDOM();
  EVVoice.setLang(settings.language);
  EVVoice.setMuted(!settings.voiceEnabled);

  toast('Loading component database...', 'info');
  await EVComponents.load();
  document.getElementById('stat-components').textContent = EVComponents.all().length + '+';

  const historyRecords = await EVHistory.getAll();
  document.getElementById('stat-detections').textContent = historyRecords.length;

  toast('Loading AI detection models — this can take a few seconds...', 'info');
  try {
    await EVAI.loadModels((msg) => console.log(msg));
    toast('AI models ready.', 'success');
  } catch (err) {
    console.error(err);
    toast('AI model failed to load. Detection may not work.', 'error');
  }

  initCameraControls();
  initSearch();
  initHistoryUI();
  initTrainingUI();
  initSettingsUI();

  document.getElementById('app-loader').classList.add('loaded');
});

/* ===================================================
   TOAST NOTIFICATIONS
=================================================== */
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ===================================================
   NAVBAR
=================================================== */
function initNavbar() {
  const links = document.querySelectorAll('.nav-link');
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      navLinks.classList.remove('open');
    });
  });

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', (e) => {
      const target = el.dataset.nav;
      links.forEach(l => l.classList.toggle('active', l.dataset.section === target));
    });
  });

  navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));

  // Highlight nav on scroll
  const sections = document.querySelectorAll('section.section');
  window.addEventListener('scroll', () => {
    let current = sections[0]?.id;
    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= 120) current = sec.id;
    });
    links.forEach(l => l.classList.toggle('active', l.dataset.section === current));
  });
}

/* ===================================================
   THEME TOGGLE
=================================================== */
function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    btn.textContent = newTheme === 'dark' ? '🌙' : '☀️';
    EVSettings.set({ darkMode: newTheme === 'dark' });
    const checkbox = document.getElementById('setting-dark-mode');
    if (checkbox) checkbox.checked = newTheme === 'dark';
  });
  btn.textContent = document.body.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
}

/* ===================================================
   HERO THREE.JS BACKGROUND — floating circuit particles
=================================================== */
function initHeroAnimation() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 60;

  function resize() {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Particle field representing circuit nodes
  const PARTICLE_COUNT = 220;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 140;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x0af0ff, size: 1.4, transparent: true, opacity: 0.85 });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // Connecting "PCB trace" lines between some nearby particles
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 4) {
    const ax = positions[i * 3], ay = positions[i * 3 + 1], az = positions[i * 3 + 2];
    const j = (i + 4) % PARTICLE_COUNT;
    const bx = positions[j * 3], by = positions[j * 3 + 1], bz = positions[j * 3 + 2];
    linePositions.push(ax, ay, az, bx, by, bz);
  }
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x7c5cff, transparent: true, opacity: 0.25 });
  const lines = new THREE.LineSegments(lineGeo, lineMaterial);
  scene.add(lines);

  let animEnabled = EVSettings.get().animations;
  function animate() {
    requestAnimationFrame(animate);
    if (!animEnabled) return;
    points.rotation.y += 0.0009;
    points.rotation.x += 0.0003;
    lines.rotation.y += 0.0009;
    lines.rotation.x += 0.0003;
    renderer.render(scene, camera);
  }
  animate();

  document.addEventListener('ev-settings-changed', () => {
    animEnabled = EVSettings.get().animations;
  });
}

/* ===================================================
   CAMERA CONTROLS WIRING
=================================================== */
function initCameraControls() {
  const btnStart = document.getElementById('btn-start-camera');
  const btnPause = document.getElementById('btn-pause-camera');
  const btnStop = document.getElementById('btn-stop-camera');
  const btnCapture = document.getElementById('btn-capture');
  const btnMirror = document.getElementById('btn-mirror');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const fileUpload = document.getElementById('file-upload');
  const confidenceSlider = document.getElementById('confidence-slider');
  const confidenceValue = document.getElementById('confidence-value');
  const fpsCounter = document.getElementById('fps-counter');

  EVCamera.setCallbacks({
    onFps: (fps) => { fpsCounter.textContent = `${fps} FPS`; },
    onDetections: (detections) => handleDetections(detections)
  });

  btnStart.addEventListener('click', async () => {
    try {
      await EVCamera.start();
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnStop.disabled = false;
      btnCapture.disabled = false;
      toast('Camera started.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  btnPause.addEventListener('click', () => {
    const isPaused = EVCamera.pause();
    btnPause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
  });

  btnStop.addEventListener('click', () => {
    EVCamera.stop();
    btnStart.disabled = false;
    btnPause.disabled = true;
    btnStop.disabled = true;
    btnCapture.disabled = true;
    btnPause.textContent = '⏸ Pause';
  });

  btnCapture.addEventListener('click', () => {
    const canvas = EVCamera.captureFrame();
    const preview = document.getElementById('captured-preview');
    preview.src = canvas.toDataURL('image/jpeg', 0.85);
    preview.classList.remove('hidden');
    runStillDetection(canvas);
  });

  btnMirror.addEventListener('click', () => {
    const mirrored = EVCamera.toggleMirror();
    toast(mirrored ? 'Mirror mode on.' : 'Mirror mode off.', 'info');
  });

  btnFullscreen.addEventListener('click', () => EVCamera.toggleFullscreen());

  fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = EVCamera.loadImageToCanvas(img);
      const preview = document.getElementById('captured-preview');
      preview.src = canvas.toDataURL('image/jpeg', 0.85);
      preview.classList.remove('hidden');
      document.getElementById('camera-placeholder').classList.add('hidden');
      runStillDetection(canvas);
    };
    img.src = URL.createObjectURL(file);
  });

  confidenceSlider.addEventListener('input', () => {
    confidenceValue.textContent = `${confidenceSlider.value}%`;
    EVSettings.set({ confidenceThreshold: Number(confidenceSlider.value) });
  });

  document.getElementById('btn-speak').addEventListener('click', () => {
    if (appState.currentComponent) {
      EVVoice.speak(EVVoice.buildAnnouncement(appState.currentComponent, appState.currentResistorResult));
    }
  });
  document.getElementById('btn-mute').addEventListener('click', (e) => {
    const muted = !EVVoice.isMuted();
    EVVoice.setMuted(muted);
    e.currentTarget.textContent = muted ? '🔈 Unmute' : '🔇 Mute';
    if (muted) EVVoice.stop();
  });
  document.getElementById('tts-lang').addEventListener('change', (e) => {
    EVVoice.setLang(e.target.value);
    EVSettings.set({ language: e.target.value });
  });

  document.getElementById('btn-save-unknown').addEventListener('click', async () => {
    const canvas = EVCamera.getCaptureCanvas();
    document.getElementById('train-image-data-holder');
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    await EVDatabase.add('trainingData', {
      image: dataUrl,
      name: 'Unlabeled Unknown Component',
      category: 'Uncategorized',
      description: 'Auto-captured unknown detection awaiting labeling.',
      datasheet: '',
      timestamp: Date.now()
    });
    toast('Saved unknown component for future training. Label it in the Training tab.', 'success');
  });
}

/* ===================================================
   DETECTION HANDLING -> INFO PANEL
=================================================== */
function handleDetections(detections) {
  const threshold = Number(document.getElementById('confidence-slider').value) / 100;
  const valid = detections.filter(d => d.score >= threshold);

  const listEl = document.getElementById('detections-list');
  listEl.innerHTML = '';
  valid.forEach(d => {
    const chip = document.createElement('div');
    chip.className = 'detection-chip';
    chip.innerHTML = `<span>${d.label}</span><span>${(d.score * 100).toFixed(0)}%</span>`;
    chip.addEventListener('click', () => showComponentForDetection(d, true));
    listEl.appendChild(chip);
  });

  if (valid.length === 0) return;

  // Debounce so we don't spam the info panel / TTS every frame
  clearTimeout(appState.detectionDebounce);
  appState.detectionDebounce = setTimeout(() => {
    const best = valid.sort((a, b) => b.score - a.score)[0];
    showComponentForDetection(best, false);
  }, 600);
}

function runStillDetection(canvas) {
  EVAI.detect(canvas).then(detections => {
    if (detections.length === 0) {
      showUnknown();
      return;
    }
    const best = detections.sort((a, b) => b.score - a.score)[0];
    showComponentForDetection(best, true, canvas);
  }).catch(err => {
    console.error(err);
    toast('Detection failed on captured image.', 'error');
  });
}

async function showComponentForDetection(detection, forceSpeak, sourceCanvas) {
  const component = EVAI.mapDetectionToComponent(detection.label);

  if (!component) {
    showUnknown();
    return;
  }

  appState.currentComponent = component;
  appState.currentResistorResult = null;

  renderComponentInfo(component);

  // Resistor color-band analysis if this looks like a resistor
  const isResistor = component.category === 'Resistors';
  const resistorBlock = document.getElementById('resistor-block');
  if (isResistor) {
    const canvas = sourceCanvas || EVCamera.captureFrame();
    const result = EVAI.analyzeResistorColors(canvas, detection.bbox);
    if (result && result.success) {
      appState.currentResistorResult = result;
      renderResistorResult(result);
      resistorBlock.classList.remove('hidden');
    } else {
      resistorBlock.classList.add('hidden');
      if (result && result.reason) console.log('Resistor analysis:', result.reason);
    }
  } else {
    resistorBlock.classList.add('hidden');
  }

  if (forceSpeak || appState.lastSpokenId !== component.id) {
    EVVoice.speak(EVVoice.buildAnnouncement(component, appState.currentResistorResult));
    appState.lastSpokenId = component.id;
  }

  // Save to history
  const dataUrl = (sourceCanvas || EVCamera.captureFrame())?.toDataURL?.('image/jpeg', 0.6);
  await EVHistory.save({
    componentId: component.id,
    componentName: component.name,
    category: component.category,
    confidence: detection.score * 100,
    image: dataUrl
  });
  const count = (await EVHistory.getAll()).length;
  document.getElementById('stat-detections').textContent = count;
}

function showUnknown() {
  document.getElementById('info-empty').classList.add('hidden');
  document.getElementById('info-content').classList.add('hidden');
  document.getElementById('info-unknown').classList.remove('hidden');
}

function renderComponentInfo(c) {
  document.getElementById('info-empty').classList.add('hidden');
  document.getElementById('info-unknown').classList.add('hidden');
  document.getElementById('info-content').classList.remove('hidden');

  document.getElementById('info-category').textContent = c.category;
  document.getElementById('info-name').textContent = c.name;
  document.getElementById('info-desc').textContent = c.description;
  document.getElementById('info-working').textContent = c.workingPrinciple || '—';
  document.getElementById('info-applications').textContent = (c.applications || []).join(', ') || '—';
  document.getElementById('info-pins').textContent = c.pinConfiguration || '—';
  document.getElementById('info-voltage').textContent = c.voltageRating || '—';
  document.getElementById('info-current').textContent = c.currentRating || '—';
  document.getElementById('info-power').textContent = c.powerRating || '—';
  document.getElementById('info-tolerance').textContent = c.tolerance || '—';
  document.getElementById('info-manufacturer').textContent = c.manufacturer || '—';
  document.getElementById('info-package').textContent = c.packageType || '—';
  document.getElementById('info-advantages').textContent = (c.advantages || []).join(', ') || '—';
  document.getElementById('info-disadvantages').textContent = (c.disadvantages || []).join(', ') || '—';
  document.getElementById('info-typical').textContent = c.typicalUses || '—';
  document.getElementById('info-datasheet').href = c.datasheetUrl || '#';
}

function renderResistorResult(result) {
  document.getElementById('res-value').textContent = result.resistance;
  document.getElementById('res-tolerance').textContent = result.tolerance;
  document.getElementById('res-multiplier').textContent = result.multiplier;
  document.getElementById('res-bandcount').textContent = result.bandCount;

  const bandsEl = document.getElementById('resistor-bands');
  bandsEl.innerHTML = '';
  result.bands.forEach(name => {
    const span = document.createElement('span');
    span.style.background = (EVAI.COLOR_CODES[name] || {}).hex || '#333';
    bandsEl.appendChild(span);
  });
}

/* ===================================================
   SEARCH UI
=================================================== */
function initSearch() {
  const input = document.getElementById('search-input');
  const autocompleteList = document.getElementById('autocomplete-list');
  const resultsGrid = document.getElementById('search-results');
  const recentEl = document.getElementById('search-recent');
  const voiceBtn = document.getElementById('btn-voice-search');

  function doSearch(query) {
    const results = EVComponents.search(query);
    EVSearch.renderResults(resultsGrid, results, openComponentDetail);
  }

  // Show all components initially
  doSearch('');
  if (EVComponents.all().length) {
    EVSearch.renderResults(resultsGrid, EVComponents.all(), openComponentDetail);
  }

  EVSearch.renderRecent(recentEl, (term) => {
    input.value = term;
    doSearch(term);
  });

  input.addEventListener('input', () => {
    EVSearch.renderAutocomplete(autocompleteList, input.value);
    if (input.value.length >= 2) doSearch(input.value);
    else EVSearch.renderResults(resultsGrid, EVComponents.all(), openComponentDetail);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      EVSearch.addRecent(input.value);
      EVSearch.renderRecent(recentEl, (term) => { input.value = term; doSearch(term); });
      autocompleteList.innerHTML = '';
      doSearch(input.value);
    }
  });

  autocompleteList.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const component = EVComponents.byId(item.dataset.id);
    input.value = component.name;
    autocompleteList.innerHTML = '';
    EVSearch.addRecent(component.name);
    openComponentDetail(component);
  });

  document.querySelectorAll('.search-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      input.value = tag.dataset.q;
      doSearch(tag.dataset.q);
      EVSearch.addRecent(tag.dataset.q);
      EVSearch.renderRecent(recentEl, (term) => { input.value = term; doSearch(term); });
    });
  });

  voiceBtn.addEventListener('click', () => {
    toast('Listening...', 'info');
    EVVoice.startVoiceRecognition(
      (transcript) => { input.value = transcript; doSearch(transcript); EVSearch.addRecent(transcript); },
      (err) => toast('Voice search error: ' + err, 'error')
    );
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar')) autocompleteList.innerHTML = '';
  });
}

function openComponentDetail(component) {
  // Jump to camera section's info panel style display, but within search context
  // we use a simple toast + scroll to a temporary detail rendering reusing info panel structure
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === 'camera'));
  document.getElementById('camera').scrollIntoView({ behavior: 'smooth' });
  appState.currentComponent = component;
  appState.currentResistorResult = null;
  renderComponentInfo(component);
  document.getElementById('resistor-block').classList.add('hidden');
  EVVoice.speak(EVVoice.buildAnnouncement(component, null));
}

/* ===================================================
   HISTORY UI
=================================================== */
function initHistoryUI() {
  const listEl = document.getElementById('history-list');
  const searchInput = document.getElementById('history-search');
  const filterSelect = document.getElementById('history-filter');
  const exportBtn = document.getElementById('btn-export-history');
  const clearBtn = document.getElementById('btn-clear-history');

  EVHistory.populateCategoryFilter(filterSelect, EVComponents.categories());
  EVHistory.render(listEl);

  searchInput.addEventListener('input', () => {
    EVHistory.render(listEl, searchInput.value, filterSelect.value);
  });
  filterSelect.addEventListener('change', () => {
    EVHistory.render(listEl, searchInput.value, filterSelect.value);
  });
  exportBtn.addEventListener('click', () => EVHistory.exportJSON());
  clearBtn.addEventListener('click', async () => {
    if (confirm('Clear all detection history? This cannot be undone.')) {
      await EVHistory.clearAll();
      EVHistory.render(listEl);
      document.getElementById('stat-detections').textContent = '0';
      toast('History cleared.', 'success');
    }
  });
}

/* ===================================================
   TRAINING SYSTEM UI
=================================================== */
function initTrainingUI() {
  const form = document.getElementById('training-form');
  const imageInput = document.getElementById('train-image');
  const preview = document.getElementById('train-preview');
  const samplesEl = document.getElementById('training-samples');
  const countEl = document.getElementById('training-count');
  const exportBtn = document.getElementById('btn-export-dataset');

  let pendingImageData = null;

  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingImageData = reader.result;
      preview.src = pendingImageData;
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  async function renderSamples() {
    const samples = await EVDatabase.getAll('trainingData');
    countEl.textContent = samples.length;
    samplesEl.innerHTML = '';
    samples.slice().reverse().forEach(s => {
      const el = document.createElement('div');
      el.className = 'training-sample';
      el.innerHTML = `
        <img src="${s.image}" alt="${s.name}" />
        <div><strong>${s.name}</strong><br/><small>${s.category}</small></div>
        <button class="tool-btn-small" data-id="${s.id}">🗑</button>
      `;
      el.querySelector('button').addEventListener('click', async () => {
        await EVDatabase.delete('trainingData', s.id);
        renderSamples();
      });
      samplesEl.appendChild(el);
    });
  }
  renderSamples();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pendingImageData) {
      toast('Please choose an image first.', 'error');
      return;
    }
    await EVDatabase.add('trainingData', {
      image: pendingImageData,
      name: document.getElementById('train-name').value,
      category: document.getElementById('train-category').value,
      description: document.getElementById('train-description').value,
      datasheet: document.getElementById('train-datasheet').value,
      timestamp: Date.now()
    });
    toast('Training sample saved locally.', 'success');
    form.reset();
    preview.classList.add('hidden');
    pendingImageData = null;
    renderSamples();
  });

  exportBtn.addEventListener('click', async () => {
    const samples = await EVDatabase.getAll('trainingData');
    const blob = new Blob([JSON.stringify({ version: '1.0.0', samples }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `electrovision-dataset-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

/* ===================================================
   SETTINGS UI
=================================================== */
function initSettingsUI() {
  const darkMode = document.getElementById('setting-dark-mode');
  const animations = document.getElementById('setting-animations');
  const resolution = document.getElementById('setting-resolution');
  const speed = document.getElementById('setting-speed');
  const voiceEnabled = document.getElementById('setting-voice');
  const language = document.getElementById('setting-language');
  const resetBtn = document.getElementById('btn-reset-settings');
  const clearDataBtn = document.getElementById('btn-clear-all-data');

  darkMode.addEventListener('change', () => {
    EVSettings.set({ darkMode: darkMode.checked });
    document.body.setAttribute('data-theme', darkMode.checked ? 'dark' : 'light');
    document.getElementById('theme-toggle').textContent = darkMode.checked ? '🌙' : '☀️';
  });
  animations.addEventListener('change', () => {
    EVSettings.set({ animations: animations.checked });
    document.dispatchEvent(new Event('ev-settings-changed'));
  });
  resolution.addEventListener('change', () => {
    EVSettings.set({ resolution: resolution.value });
    document.getElementById('resolution-select').value = resolution.value;
  });
  speed.addEventListener('change', () => EVSettings.set({ detectionSpeed: speed.value }));
  voiceEnabled.addEventListener('change', () => {
    EVSettings.set({ voiceEnabled: voiceEnabled.checked });
    EVVoice.setMuted(!voiceEnabled.checked);
  });
  language.addEventListener('change', () => {
    EVSettings.set({ language: language.value });
    EVVoice.setLang(language.value);
    document.getElementById('tts-lang').value = language.value;
  });

  resetBtn.addEventListener('click', () => {
    EVSettings.reset();
    EVSettings.applyToDOM();
    toast('Settings reset to defaults.', 'success');
  });

  clearDataBtn.addEventListener('click', async () => {
    if (confirm('This will permanently delete all history and training data stored on this device. Continue?')) {
      await EVDatabase.clear('history');
      await EVDatabase.clear('trainingData');
      localStorage.clear();
      toast('All local data cleared. Reloading...', 'success');
      setTimeout(() => location.reload(), 1200);
    }
  });
}
