/* ===================================================
   ElectroVision AI — voice.js
   Text-to-Speech (Web Speech API) + Voice Search (SpeechRecognition)
=================================================== */

const EVVoice = (() => {
  let muted = false;
  let lang = 'en-US';
  const synth = window.speechSynthesis;

  function setLang(l) { lang = l; }
  function setMuted(m) { muted = m; }
  function isMuted() { return muted; }

  function speak(text) {
    if (muted || !synth || !text) return;
    try {
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 1.0;
      utter.pitch = 1.0;
      const voices = synth.getVoices();
      const match = voices.find(v => v.lang === lang);
      if (match) utter.voice = match;
      synth.speak(utter);
    } catch (err) {
      console.warn('TTS failed', err);
    }
  }

  function stop() {
    if (synth) synth.cancel();
  }

  function buildAnnouncement(component, resistorResult) {
    if (!component) return '';
    if (resistorResult && resistorResult.resistance) {
      return `Detected component: ${resistorResult.resistance} resistor. Tolerance ${resistorResult.tolerance}. ${component.name}.`;
    }
    return `Detected component: ${component.name}. Category: ${component.category}.`;
  }

  /* ---------- Voice Search (SpeechRecognition) ---------- */
  function startVoiceRecognition(onResult, onError) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError('Speech recognition is not supported in this browser.');
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (onResult) onResult(transcript);
    };
    recognition.onerror = (e) => {
      if (onError) onError(e.error);
    };
    recognition.start();
    return recognition;
  }

  return { setLang, setMuted, isMuted, speak, stop, buildAnnouncement, startVoiceRecognition };
})();
