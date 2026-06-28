/* ===================================================
   ElectroVision AI — camera.js
   Webcam controls, live detection loop, capture/upload
=================================================== */

const EVCamera = (() => {
  let stream = null;
  let video, overlayCanvas, overlayCtx, captureCanvas;
  let running = false;
  let paused = false;
  let mirrored = false;
  let rafId = null;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let fps = 0;
  let detectionLoopActive = false;
  let lastDetections = [];

  const callbacks = {
    onDetections: null,
    onFps: null,
    onNoComponentMatch: null
  };

  function init() {
    video = document.getElementById('video');
    overlayCanvas = document.getElementById('overlay-canvas');
    overlayCtx = overlayCanvas.getContext('2d');
    captureCanvas = document.createElement('canvas');
  }

  function setCallbacks(cb) {
    Object.assign(callbacks, cb);
  }

  function getResolution() {
    const sel = document.getElementById('resolution-select');
    const [w, h] = (sel ? sel.value : '1280x720').split('x').map(Number);
    return { width: w, height: h };
  }

  async function start() {
    if (running) return;
    const { width, height } = getResolution();
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: width }, height: { ideal: height }, facingMode: 'environment' },
        audio: false
      });
    } catch (err) {
      throw new Error('Camera access denied or unavailable: ' + err.message);
    }
    video.srcObject = stream;
    await video.play();
    running = true;
    paused = false;

    document.getElementById('camera-placeholder').classList.add('hidden');
    document.getElementById('captured-preview').classList.add('hidden');
    document.getElementById('live-pill').classList.remove('hidden');

    resizeCanvases();
    startLoop();
  }

  function pause() {
    paused = !paused;
    return paused;
  }

  function stop() {
    running = false;
    paused = false;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (rafId) cancelAnimationFrame(rafId);
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    document.getElementById('camera-placeholder').classList.remove('hidden');
    document.getElementById('live-pill').classList.add('hidden');
  }

  function toggleMirror() {
    mirrored = !mirrored;
    video.classList.toggle('mirrored', mirrored);
    return mirrored;
  }

  function resizeCanvases() {
    const rect = video.getBoundingClientRect();
    overlayCanvas.width = rect.width;
    overlayCanvas.height = rect.height;
    document.getElementById('res-pill').textContent =
      `${video.videoWidth || 0} × ${video.videoHeight || 0}`;
  }

  function isRunning() { return running; }
  function isPaused() { return paused; }
  function isMirrored() { return mirrored; }
  function getLastDetections() { return lastDetections; }

  async function startLoop() {
    if (detectionLoopActive) return;
    detectionLoopActive = true;

    const settings = EVSettings.get();
    const speedDelay = settings.detectionSpeed === 'fast' ? 0 : settings.detectionSpeed === 'accurate' ? 400 : 150;

    async function loop() {
      if (!running) { detectionLoopActive = false; return; }

      if (!paused && video.readyState >= 2) {
        resizeCanvases();

        // FPS calculation
        frameCount++;
        const now = performance.now();
        if (now - lastFrameTime >= 1000) {
          fps = frameCount;
          frameCount = 0;
          lastFrameTime = now;
          if (callbacks.onFps) callbacks.onFps(fps);
        }

        const continuous = document.getElementById('continuous-toggle').checked;
        if (continuous) {
          try {
            const detections = await EVAI.detect(video);
            lastDetections = detections;
            drawDetections(detections);
            if (callbacks.onDetections) callbacks.onDetections(detections);
          } catch (err) {
            console.error('Detection error', err);
          }
        }
      }

      await new Promise(r => setTimeout(r, speedDelay));
      rafId = requestAnimationFrame(loop);
    }
    loop();
  }

  function drawDetections(detections) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const scaleX = overlayCanvas.width / video.videoWidth;
    const scaleY = overlayCanvas.height / video.videoHeight;
    const threshold = (Number(document.getElementById('confidence-slider').value) || 50) / 100;

    detections.forEach(d => {
      if (d.score < threshold) return;
      let [x, y, w, h] = d.bbox;
      x *= scaleX; y *= scaleY; w *= scaleX; h *= scaleY;
      if (mirrored) x = overlayCanvas.width - x - w;

      overlayCtx.strokeStyle = '#0af0ff';
      overlayCtx.lineWidth = 2;
      overlayCtx.shadowColor = '#0af0ff';
      overlayCtx.shadowBlur = 8;
      overlayCtx.strokeRect(x, y, w, h);
      overlayCtx.shadowBlur = 0;

      const label = `${d.label} ${(d.score * 100).toFixed(0)}%`;
      overlayCtx.font = '13px Segoe UI';
      const textWidth = overlayCtx.measureText(label).width;
      overlayCtx.fillStyle = 'rgba(10,240,255,0.9)';
      overlayCtx.fillRect(x, y - 20, textWidth + 10, 20);
      overlayCtx.fillStyle = '#04101c';
      overlayCtx.fillText(label, x + 5, y - 6);
    });
  }

  /* Capture the current frame to a canvas (used for detection still-frame + resistor analysis) */
  function captureFrame() {
    captureCanvas.width = video.videoWidth || 640;
    captureCanvas.height = video.videoHeight || 480;
    const ctx = captureCanvas.getContext('2d');
    if (mirrored) {
      ctx.save();
      ctx.translate(captureCanvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    }
    return captureCanvas;
  }

  function captureFrameDataURL() {
    const canvas = captureFrame();
    return canvas.toDataURL('image/jpeg', 0.8);
  }

  function loadImageToCanvas(imgEl) {
    captureCanvas.width = imgEl.naturalWidth;
    captureCanvas.height = imgEl.naturalHeight;
    const ctx = captureCanvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);
    return captureCanvas;
  }

  function getCaptureCanvas() { return captureCanvas; }

  function toggleFullscreen() {
    const stage = document.getElementById('camera-stage');
    if (!document.fullscreenElement) {
      stage.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  return {
    init, setCallbacks, start, pause, stop, toggleMirror, isRunning, isPaused,
    isMirrored, getLastDetections, captureFrame, captureFrameDataURL,
    loadImageToCanvas, getCaptureCanvas, toggleFullscreen, resizeCanvases
  };
})();
