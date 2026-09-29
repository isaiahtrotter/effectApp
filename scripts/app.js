const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light-mode');
  });
}

const sliderCard = document.querySelector('.slider-card');

function isTypingContext() {
  const active = document.activeElement;
  return !!active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
}

function onKey(key, handler) {
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== key) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingContext()) return;
    e.preventDefault();
    handler();
  });
}

let shuffleDelay = 25;

function isInClosedGroup(item) {
  const group = item.closest('details.slider-group');
  return !!group && !group.open;
}

const shuffleBtn = document.querySelector('[data-shuffle-btn]');
if (shuffleBtn && sliderCard) {
  shuffleBtn.addEventListener('click', () => {
    const items = Array.from(sliderCard.querySelectorAll('.slider-item')).filter(
      (item) => !isInClosedGroup(item)
    );
    items.forEach((item, i) => {
      setTimeout(() => {
        if (item.shuffleValue) item.shuffleValue();
      }, i * shuffleDelay);
    });
  });

  onKey(' ', () => shuffleBtn.click());
}

const shuffleDurationItem = document.querySelector('[data-shuffle-duration]');
if (shuffleDurationItem) {
  const durationInput = shuffleDurationItem.querySelector('.range-input');
  durationInput.addEventListener('input', () => {
    if (window.sliderShuffle) window.sliderShuffle.setDuration(Number(durationInput.value));
  });
}

const shuffleDelayItem = document.querySelector('[data-shuffle-delay]');
if (shuffleDelayItem) {
  const delayInput = shuffleDelayItem.querySelector('.range-input');
  delayInput.addEventListener('input', () => {
    shuffleDelay = Number(delayInput.value);
  });
}

function setupCardResize(handle, sign) {
  if (!handle || !sliderCard) return;

  const CARD_MIN_WIDTH = 250;
  const CARD_MAX_WIDTH = 350;

  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    startWidth = sliderCard.getBoundingClientRect().width;
    handle.classList.add('is-dragging');
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) * sign;
    const newWidth = Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, startWidth + delta));
    sliderCard.style.width = newWidth + 'px';
  });

  handle.addEventListener('pointerup', (e) => {
    dragging = false;
    handle.classList.remove('is-dragging');
    handle.releasePointerCapture(e.pointerId);
  });
}

setupCardResize(document.querySelector('.resize-handle-right'), 1);

const animSpeedItem = document.querySelector('[data-css-var="--anim-ms"]');
if (animSpeedItem) {
  const animSpeedInput = animSpeedItem.querySelector('.range-input');
  animSpeedInput.addEventListener('input', () => {
    document.documentElement.style.setProperty('--anim-ms', animSpeedInput.value);
  });
}

const elasticityStrengthItem = document.querySelector('[data-elasticity-strength]');
if (elasticityStrengthItem) {
  const strengthInput = elasticityStrengthItem.querySelector('.range-input');
  strengthInput.addEventListener('input', () => {
    if (window.sliderElasticity) window.sliderElasticity.setStrength(Number(strengthInput.value));
  });
}

const elasticityToggle = document.querySelector('[data-elasticity-toggle]');
if (elasticityToggle) {
  elasticityToggle.addEventListener('click', () => {
    const isOn = !elasticityToggle.classList.contains('is-on');
    elasticityToggle.classList.toggle('is-on', isOn);
    elasticityToggle.setAttribute('aria-checked', String(isOn));
    if (window.sliderElasticity) window.sliderElasticity.setEnabled(isOn);
    if (elasticityStrengthItem) elasticityStrengthItem.hidden = !isOn;
  });
}

const minimalToggle = document.querySelector('[data-minimal-toggle]');
const coloredHandleRow = document.querySelector('[data-colored-handle-row]');
if (minimalToggle && sliderCard) {
  minimalToggle.addEventListener('click', () => {
    const isOn = !minimalToggle.classList.contains('is-on');
    minimalToggle.classList.toggle('is-on', isOn);
    minimalToggle.setAttribute('aria-checked', String(isOn));
    sliderCard.classList.toggle('minimal-mode', isOn);
    if (coloredHandleRow) coloredHandleRow.hidden = !isOn;
    window.dispatchEvent(new Event('slider-mode-change'));
  });

  onKey('m', () => minimalToggle.click());
}

const v2Toggle = document.querySelector('[data-v2-toggle]');
if (v2Toggle && sliderCard) {
  v2Toggle.addEventListener('click', () => {
    const isOn = !v2Toggle.classList.contains('is-on');
    v2Toggle.classList.toggle('is-on', isOn);
    v2Toggle.setAttribute('aria-checked', String(isOn));
    sliderCard.classList.toggle('v2-mode', isOn);
  });
}

const coloredHandleToggle = document.querySelector('[data-colored-handle-toggle]');
if (coloredHandleToggle) {
  coloredHandleToggle.addEventListener('click', () => {
    const isOn = !coloredHandleToggle.classList.contains('is-on');
    coloredHandleToggle.classList.toggle('is-on', isOn);
    coloredHandleToggle.setAttribute('aria-checked', String(isOn));
    if (window.sliderColoredHandle) window.sliderColoredHandle.setEnabled(isOn);
  });
}

const freqWaveItem = document.querySelector('[data-freq-wave]');
if (freqWaveItem) {
  const freqInput = freqWaveItem.querySelector('.range-input');
  const freqValueInput = freqWaveItem.querySelector('.value-num');
  const freqWave = freqWaveItem.querySelector('.freq-wave');
  const freqWavePath = freqWave.querySelector('path');
  const FREQ_WAVE_BASE_WIDTH = 28;

  const WAVE_WIDTH = 32;
  const WAVE_HEIGHT = 14;
  const WAVE_AMPLITUDE = 5;
  const WAVE_MID = WAVE_HEIGHT / 2;
  const WAVE_SAMPLES = 64;
  const MIN_CYCLES = 1;
  const MAX_CYCLES = 8;

  function buildWavePath(cycles) {
    let d = '';
    for (let i = 0; i <= WAVE_SAMPLES; i++) {
      const x = (WAVE_WIDTH * i) / WAVE_SAMPLES;
      const y = WAVE_MID - WAVE_AMPLITUDE * Math.sin((2 * Math.PI * cycles * i) / WAVE_SAMPLES);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
    }
    return d.trim();
  }

  function updateFreqWave() {
    const min = parseFloat(freqInput.min);
    const max = parseFloat(freqInput.max);
    const val = parseFloat(freqInput.value);
    const t = (val - min) / (max - min);
    const cycles = MIN_CYCLES + t * (MAX_CYCLES - MIN_CYCLES);
    freqWavePath.setAttribute('d', buildWavePath(cycles));

    // The native `size` attribute's width formula is UA-specific and can't
    // be mirrored exactly in CSS, which left a tiny residual drift in the
    // wave's left edge. Instead, size the value input itself with an
    // explicit CSS width using the same ch-based unit as the wave's
    // compensation below, so the two always sum to one fixed total width
    // and the wave's left edge truly never moves.
    const len = freqValueInput.value.length;
    const maxLen = freqValueInput.maxLength;
    const charWidth = (n) => `${n}ch + ${n}px`; // +1px per char to cover letter-spacing
    freqValueInput.style.width = `calc(${charWidth(len)})`;
    freqWave.style.width = `calc(${FREQ_WAVE_BASE_WIDTH}px + ${charWidth(maxLen - len)})`;
  }

  freqInput.addEventListener('input', updateFreqWave);

  updateFreqWave();
}

const freqWaveTrackItem = document.querySelector('[data-freq-wave-track]');
if (freqWaveTrackItem) {
  const trackInput = freqWaveTrackItem.querySelector('.range-input');
  const trackWrap = freqWaveTrackItem.querySelector('.track-wrap');
  const waveClip = freqWaveTrackItem.querySelector('.freq-wave-track-clip');
  const waveSvg = freqWaveTrackItem.querySelector('.freq-wave-track');
  const wavePath = waveSvg.querySelector('path');

  const TRACK_WAVE_MIN_PERIOD_PX = 8;
  const TRACK_WAVE_MAX_PERIOD_PX = 40;
  const TRACK_WAVE_HEIGHT = 14;
  const TRACK_WAVE_AMPLITUDE = 5;
  const TRACK_WAVE_MID = TRACK_WAVE_HEIGHT / 2;
  const TRACK_WAVE_SAMPLES_PER_CYCLE = 16;

  function trackPct() {
    const min = parseFloat(trackInput.min);
    const max = parseFloat(trackInput.max);
    const val = parseFloat(trackInput.value);
    return ((val - min) / (max - min)) * 100;
  }

  // Samples x/period directly (rather than fitting a rounded number of whole
  // cycles into the width), so the pattern never snaps as the period changes
  // continuously — only its density does.
  function buildTrackWavePath(widthPx, periodPx) {
    const samples = Math.max(64, Math.ceil((widthPx / TRACK_WAVE_MIN_PERIOD_PX) * TRACK_WAVE_SAMPLES_PER_CYCLE));
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const x = (widthPx * i) / samples;
      const y = TRACK_WAVE_MID - TRACK_WAVE_AMPLITUDE * Math.sin((2 * Math.PI * x) / periodPx);
      d += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2) + ' ';
    }
    return d.trim();
  }

  let trackWaveFrame = null;

  function renderTrackWave() {
    trackWaveFrame = null;
    const widthPx = trackWrap.getBoundingClientRect().width;
    const pct = trackPct();
    const periodPx = TRACK_WAVE_MAX_PERIOD_PX - (pct / 100) * (TRACK_WAVE_MAX_PERIOD_PX - TRACK_WAVE_MIN_PERIOD_PX);

    waveSvg.setAttribute('viewBox', `0 0 ${widthPx} ${TRACK_WAVE_HEIGHT}`);
    waveSvg.style.width = widthPx + 'px';
    wavePath.setAttribute('d', buildTrackWavePath(widthPx, periodPx));
    waveClip.style.width = pct + '%';
  }

  // Coalesces the many 'input' events a drag fires into one redraw per frame.
  function updateTrackWave() {
    if (trackWaveFrame !== null) return;
    trackWaveFrame = requestAnimationFrame(renderTrackWave);
  }

  trackInput.addEventListener('input', updateTrackWave);
  window.addEventListener('resize', updateTrackWave);

  renderTrackWave();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;

    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.id !== target;
    });
    window.dispatchEvent(new Event('resize'));
  });
});

const ratioCard = document.querySelector('[data-aspect-ratio]');
if (ratioCard) {
  const previewRect = ratioCard.querySelector('.ratio-preview-rect');
  const options = Array.from(ratioCard.querySelectorAll('.ratio-option'));
  const wInput = ratioCard.querySelector('.ratio-w');
  const hInput = ratioCard.querySelector('.ratio-h');
  const PREVIEW_FILL = 100; // % of the square the longest side occupies
  const MINI_SIZE = 14; // px

  function fit(w, h, max, unit) {
    const long = Math.max(w, h);
    return [(w / long) * max + unit, (h / long) * max + unit];
  }

  function applyRatio(w, h) {
    [previewRect.style.width, previewRect.style.height] = fit(w, h, PREVIEW_FILL, '%');
  }

  options.forEach((opt) => {
    const rect = opt.querySelector('.ratio-mini-rect');
    const w = Number(opt.dataset.w);
    const h = Number(opt.dataset.h);
    [rect.style.width, rect.style.height] = fit(w, h, MINI_SIZE, 'px');

    opt.addEventListener('click', () => {
      options.forEach((o) => o.classList.toggle('is-active', o === opt));
      applyRatio(w, h);
    });
  });

  const customRow = ratioCard.querySelector('.ratio-custom');
  const linkBtn = ratioCard.querySelector('.ratio-link');
  let linked = true;
  let linkedRatio = Number(wInput.value) / Number(hInput.value);

  linkBtn.addEventListener('click', () => {
    linked = !linked;
    if (linked) linkedRatio = (Number(wInput.value) || 1) / (Number(hInput.value) || 1);
    linkBtn.classList.toggle('is-linked', linked);
    customRow.classList.toggle('is-linked', linked);
    linkBtn.setAttribute('aria-pressed', String(linked));
  });

  // `source` is the input that changed (or the input event itself); when linked,
  // the other dimension follows so the ratio stays constant.
  // Assigning `.value` (even to the same text) can reset the caret/selection, so only write on change.
  function setValue(el, v) {
    const str = String(v);
    if (el.value !== str) el.value = str;
  }

  function onCustomInput(source) {
    const src = source && source.target ? source.target : source;
    setValue(wInput, wInput.value.replace(/\D/g, ''));
    setValue(hInput, hInput.value.replace(/\D/g, ''));
    if (linked && src) {
      const max = 10 ** src.maxLength - 1;
      if (src === wInput && Number(wInput.value)) {
        setValue(hInput, Math.min(max, Math.max(1, Math.round(Number(wInput.value) / linkedRatio))));
      } else if (src === hInput && Number(hInput.value)) {
        setValue(wInput, Math.min(max, Math.max(1, Math.round(Number(hInput.value) * linkedRatio))));
      }
    }
    const w = Number(wInput.value);
    const h = Number(hInput.value);
    if (!w || !h) return;
    options.forEach((o) => o.classList.remove('is-active'));
    applyRatio(w, h);
  }

  // Dragging the W / H label horizontally scrubs its value (1px = 1 unit, hold Shift for 10).
  [[wInput, 'W'], [hInput, 'H']].forEach(([input]) => {
    const label = input.closest('.ratio-field').querySelector('.ratio-field-label');
    let startX = 0;
    let startVal = 0;
    let moved = false;

    label.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      moved = false;
      startX = e.clientX;
      startVal = Number(input.value) || 1;
      label.setPointerCapture(e.pointerId);
    });

    label.addEventListener('pointermove', (e) => {
      if (!label.hasPointerCapture(e.pointerId)) return;
      if (Math.abs(e.clientX - startX) > 2) moved = true;
      if (!moved) return;
      const step = e.shiftKey ? 10 : 1;
      const max = 10 ** input.maxLength - 1;
      const next = Math.min(max, Math.max(1, startVal + Math.round((e.clientX - startX) * step)));
      input.value = next;
      onCustomInput(input);
    });

    label.addEventListener('pointerup', () => {
      if (!moved) input.focus(); // plain click on the label behaves like clicking the number
    });
  });

  // Plain inputs (no select-all on click or focus): Enter commits, Up/Down nudge (Shift = 10), and blur clamps or restores the last valid value.
  [wInput, hInput].forEach((input) => {
    const max = 10 ** input.maxLength - 1;
    let lastValid = Number(input.value);

    input.addEventListener('input', () => {
      if (Number(input.value)) lastValid = Number(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.blur();
        return;
      }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const delta = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
      const v = Math.min(max, Math.max(1, (Number(input.value) || lastValid) + delta));
      input.value = v;
      lastValid = v;
      onCustomInput(input);
      input.select();
    });
    input.addEventListener('blur', () => {
      const v = Math.min(max, Math.max(1, Number(input.value) || lastValid));
      input.value = v;
      lastValid = v;
      onCustomInput();
    });
  });

  wInput.addEventListener('input', onCustomInput);
  hInput.addEventListener('input', onCustomInput);

  applyRatio(1, 1);
}
