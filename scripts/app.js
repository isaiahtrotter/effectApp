const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light-mode');
  });
}

const sliderCard = document.querySelector('.slider-card');

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

const freqWaveItem = document.querySelector('[data-freq-wave]');
if (freqWaveItem) {
  const freqInput = freqWaveItem.querySelector('.range-input');
  const freqWave = freqWaveItem.querySelector('.freq-wave');
  const freqWavePath = freqWave.querySelector('path');

  const WAVE_WIDTH = 32;
  const WAVE_HEIGHT = 16;
  const WAVE_AMPLITUDE = 6;
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
  }

  freqInput.addEventListener('input', updateFreqWave);

  updateFreqWave();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;

    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.id !== target;
    });
  });
});
