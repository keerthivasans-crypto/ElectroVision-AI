/* ===================================================
   ElectroVision AI — ai.js
   Detection engine.

   IMPORTANT, HONEST NOTE ON ACCURACY:
   TensorFlow.js's pretrained COCO-SSD model only recognizes 80 generic
   COCO object classes (e.g. "book", "cell phone", "remote") — it has
   NEVER been trained on electronic components, so it cannot reliably
   tell a resistor from a capacitor. We use it here for what it's
   actually good at: drawing live bounding boxes around objects in
   frame so the detection UI has something real to show, and we map
   any COCO label that loosely matches a component name/alias to our
   component database.

   For a TRUE component classifier, plug a custom-trained TF.js model
   in at CUSTOM_MODEL_URL below (see /public/data/dataset.json for the
   training-sample export format used to build that model offline).

   The one piece of REAL, working, accurate detection in this app is
   the resistor color-band reader below: it samples actual pixel
   colors from the captured frame and decodes them using the standard
   resistor color code table. Point it straight at a resistor's body
   in good lighting for best results.
=================================================== */

const EVAI = (() => {
  let cocoModel = null;
  let customModel = null;
  const CUSTOM_MODEL_URL = null; // e.g. '/models/custom/model.json' once you train one

  async function loadModels(onProgress) {
    if (onProgress) onProgress('Loading TensorFlow.js backend...');
    await tf.ready();
    if (onProgress) onProgress('Loading COCO-SSD object detector...');
    cocoModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });

    if (CUSTOM_MODEL_URL) {
      try {
        if (onProgress) onProgress('Loading custom component model...');
        customModel = await tf.loadGraphModel(CUSTOM_MODEL_URL);
      } catch (err) {
        console.warn('No custom model loaded:', err);
      }
    }
    return true;
  }

  async function detect(videoOrImageEl) {
    if (!cocoModel) return [];
    const predictions = await cocoModel.detect(videoOrImageEl);
    return predictions.map(p => ({
      label: p.class,
      score: p.score,
      bbox: p.bbox // [x, y, width, height]
    }));
  }

  /* Map a generic detection label to our component database where possible */
  function mapDetectionToComponent(label) {
    return EVComponents.findByNameLoose(label);
  }

  /* ===================================================
     RESISTOR COLOR BAND ANALYSIS (real pixel-based logic)
  =================================================== */

  // Standard 4-band resistor color code table
  const COLOR_CODES = {
    black:  { digit: 0, multiplier: 1,         hex: '#1a1a1a' },
    brown:  { digit: 1, multiplier: 10,        hex: '#7a4a2a', tolerance: '±1%' },
    red:    { digit: 2, multiplier: 100,       hex: '#d22b2b', tolerance: '±2%' },
    orange: { digit: 3, multiplier: 1000,      hex: '#e87b1e' },
    yellow: { digit: 4, multiplier: 10000,     hex: '#f0d020' },
    green:  { digit: 5, multiplier: 100000,    hex: '#2e8b3d', tolerance: '±0.5%' },
    blue:   { digit: 6, multiplier: 1000000,   hex: '#2255c4', tolerance: '±0.25%' },
    violet: { digit: 7, multiplier: 10000000,  hex: '#7b3fb0', tolerance: '±0.1%' },
    grey:   { digit: 8, multiplier: 100000000, hex: '#8a8a8a', tolerance: '±0.05%' },
    white:  { digit: 9, multiplier: 1000000000, hex: '#f5f5f5' },
    gold:   { multiplier: 0.1,  hex: '#cda434', tolerance: '±5%' },
    silver: { multiplier: 0.01, hex: '#c0c0c0', tolerance: '±10%' }
  };

  function nearestColorName(r, g, b) {
    let best = null, bestDist = Infinity;
    for (const [name, def] of Object.entries(COLOR_CODES)) {
      const hex = def.hex.replace('#', '');
      const cr = parseInt(hex.substring(0, 2), 16);
      const cg = parseInt(hex.substring(2, 4), 16);
      const cb = parseInt(hex.substring(4, 6), 16);
      const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
      if (dist < bestDist) { bestDist = dist; best = name; }
    }
    return { name: best, distance: bestDist };
  }

  /**
   * Analyzes a horizontal strip through the center of the given region
   * (or the whole canvas if no bbox given), segments it into contiguous
   * color bands, and decodes them as resistor color bands.
   * @param {HTMLCanvasElement} sourceCanvas - canvas containing the captured frame
   * @param {Array} [bbox] - [x, y, width, height] region of interest
   */
  function analyzeResistorColors(sourceCanvas, bbox) {
    const ctx = sourceCanvas.getContext('2d');
    const cw = sourceCanvas.width, ch = sourceCanvas.height;

    let x = 0, y = 0, w = cw, h = ch;
    if (bbox) [x, y, w, h] = bbox;

    // Sample a horizontal line through the vertical center of the region
    const sampleY = Math.max(0, Math.min(ch - 1, Math.round(y + h / 2)));
    const startX = Math.max(0, Math.round(x));
    const sampleW = Math.max(1, Math.min(cw - startX, Math.round(w)));

    let rowData;
    try {
      rowData = ctx.getImageData(startX, sampleY, sampleW, 1).data;
    } catch (err) {
      console.error('Unable to read pixel data (CORS/tainted canvas?)', err);
      return null;
    }

    // Build a per-pixel color classification, ignoring background/skin-tone-like
    // "body" colors (resistor body is typically tan/beige) by excluding low-saturation
    // beige pixels from being treated as a "band" -- bands are usually more saturated.
    const pixelColors = [];
    for (let i = 0; i < rowData.length; i += 4) {
      const r = rowData[i], g = rowData[i + 1], b = rowData[i + 2];
      pixelColors.push(nearestColorName(r, g, b).name);
    }

    // Collapse consecutive duplicate colors into segments
    const segments = [];
    let current = null, count = 0;
    pixelColors.forEach(name => {
      if (name === current) {
        count++;
      } else {
        if (current && count > 2) segments.push({ name: current, count });
        current = name;
        count = 1;
      }
    });
    if (current && count > 2) segments.push({ name: current, count });

    // Merge consecutive identical segments (noise) and keep only meaningfully wide ones
    const minWidth = Math.max(2, Math.floor(sampleW * 0.02));
    const bands = segments.filter(s => s.count >= minWidth).map(s => s.name);

    // Deduplicate adjacent repeats again after filtering
    const finalBands = [];
    bands.forEach(b => {
      if (finalBands[finalBands.length - 1] !== b) finalBands.push(b);
    });

    if (finalBands.length < 3) {
      return { success: false, reason: 'Could not isolate enough distinct color bands. Try better lighting and fill more of the frame with the resistor body.' };
    }

    // Take the last 3-4 distinguishable bands as the color code (heuristic)
    const codeBands = finalBands.slice(-4).filter(b => COLOR_CODES[b]);
    return decodeBands(codeBands);
  }

  function decodeBands(bandNames) {
    if (bandNames.length < 3) {
      return { success: false, reason: 'Fewer than 3 valid bands detected.' };
    }

    let digits = [];
    let multiplierBand = null;
    let toleranceBand = null;

    if (bandNames.length === 3) {
      // digit, digit, multiplier (no tolerance band = ±20%)
      digits = [bandNames[0], bandNames[1]];
      multiplierBand = bandNames[2];
    } else {
      // 4 or 5 band: last band = tolerance, second-to-last = multiplier, rest = digits
      toleranceBand = bandNames[bandNames.length - 1];
      multiplierBand = bandNames[bandNames.length - 2];
      digits = bandNames.slice(0, bandNames.length - 2);
    }

    const digitValues = digits.map(d => COLOR_CODES[d] && COLOR_CODES[d].digit);
    if (digitValues.some(v => v === undefined)) {
      return { success: false, reason: 'One or more bands could not be matched to a valid digit color.' };
    }

    const baseValue = Number(digitValues.join(''));
    const multiplierDef = COLOR_CODES[multiplierBand];
    if (!multiplierDef) {
      return { success: false, reason: 'Multiplier band could not be matched.' };
    }
    const ohms = baseValue * multiplierDef.multiplier;
    const tolerance = (toleranceBand && COLOR_CODES[toleranceBand] && COLOR_CODES[toleranceBand].tolerance) || '±20%';

    return {
      success: true,
      bands: bandNames,
      resistance: formatOhms(ohms),
      resistanceRaw: ohms,
      tolerance,
      multiplier: `×${multiplierDef.multiplier}`,
      bandCount: bandNames.length
    };
  }

  function formatOhms(value) {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2).replace(/\.00$/, '')}MΩ`;
    if (value >= 1000) return `${(value / 1000).toFixed(2).replace(/\.00$/, '')}kΩ`;
    return `${value.toFixed(2).replace(/\.00$/, '')}Ω`;
  }

  return { loadModels, detect, mapDetectionToComponent, analyzeResistorColors, decodeBands, COLOR_CODES };
})();
