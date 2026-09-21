// Shared across every slider instance so a single toggle/slider can
// control the rubber-band overshoot effect for all of them at once.
let elasticityEnabled = true;
let elasticityStrength = 5;
window.sliderElasticity = {
  setEnabled(enabled) {
    elasticityEnabled = enabled;
  },
  setStrength(strength) {
    elasticityStrength = strength;
  },
};

// Shared across every color-swatch slider so the "Colored Handle" toggle
// can turn thumb recoloring on/off for all of them at once.
let coloredHandleEnabled = true;
window.sliderColoredHandle = {
  setEnabled(enabled) {
    coloredHandleEnabled = enabled;
    window.dispatchEvent(new Event('slider-colored-handle-change'));
  },
};

// Shared so the "Shuffle Duration" control can adjust how long each
// slider's shuffle tween/hover-simulation takes.
let shuffleDuration = 150;
window.sliderShuffle = {
  setDuration(ms) {
    shuffleDuration = ms;
  },
};

const COLOR_STOPS = {
  temperature: [[0, '#DD4D37'], [14, '#FFD753'], [30, '#FFFFFF'], [72, '#53A1CE'], [100, '#0863E3']],
  mono: [[0, '#3A3A3C'], [100, '#FFFFFF']],
  hue: [[0, '#FF0000'], [17, '#FFFF00'], [33, '#00FF00'], [50, '#00FFFF'], [67, '#0000FF'], [83, '#FF00FF'], [100, '#FF0000']],
  saturation: [[0, '#282828'], [100, '#f40000']],
  'saturation-light': [[0, '#D0D0D0'], [100, '#f40000']],
  tint: [[0, '#00FF00'], [50, '#353536'], [100, '#FF00FF']],
  'tint-light': [[0, '#00FF00'], [50, '#FFFFFF'], [100, '#FF00FF']],
  red: [[0, '#353536'], [100, '#FF0000']],
  'red-light': [[0, '#D0D0D0'], [100, '#FF0000']],
  green: [[0, '#353536'], [100, '#00FF00']],
  'green-light': [[0, '#D0D0D0'], [100, '#00FF00']],
  blue: [[0, '#353536'], [100, '#0000FF']],
  'blue-light': [[0, '#D0D0D0'], [100, '#0000FF']],
  cyan: [[0, '#353536'], [100, '#00FFFF']],
  'cyan-light': [[0, '#D0D0D0'], [100, '#00FFFF']],
  magenta: [[0, '#353536'], [100, '#FF00FF']],
  'magenta-light': [[0, '#D0D0D0'], [100, '#FF00FF']],
  yellow: [[0, '#353536'], [100, '#FFFF00']],
  'yellow-light': [[0, '#D0D0D0'], [100, '#FFFF00']],
};

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorAtPercent(stops, pct) {
  const p = Math.min(100, Math.max(0, pct));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (p >= stops[i][0] && p <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const t = span === 0 ? 0 : (p - lo[0]) / span;
  const [r1, g1, b1] = hexToRgb(lo[1]);
  const [r2, g2, b2] = hexToRgb(hi[1]);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function setupSlider(item) {
  const input   = item.querySelector('.range-input');
  const wrap    = item.querySelector('.track-wrap');
  const grayBar = item.querySelector('.gray-bar');
  const before  = item.querySelector('.gray-fill.before');
  const after   = item.querySelector('.gray-fill.after');
  const gradBefore = item.querySelector('.gradient-seg.before');
  const gradAfter  = item.querySelector('.gradient-seg.after');
  const thumb   = item.querySelector('.thumb');
  const valueEl = item.querySelector('.value-num');
  const decimals = parseInt(item.dataset.decimals || '0', 10);
  const swatchEl = item.querySelector('.color-swatch');
  const swatchKey = item.dataset.swatch;

  const LIGHT_VARIANT_SWATCHES = ['saturation', 'tint', 'red', 'green', 'blue', 'cyan', 'magenta', 'yellow'];

  function colorStops() {
    if (LIGHT_VARIANT_SWATCHES.includes(swatchKey) && document.documentElement.classList.contains('light-mode')) {
      return COLOR_STOPS[`${swatchKey}-light`];
    }
    return COLOR_STOPS[swatchKey];
  }

  const STRETCH_EASE = 'ease-out';

  function stretchMs() {
    const v = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--anim-ms')
    );
    return isNaN(v) ? 65 : v;
  }

  function stretchAnim() {
    return `${stretchMs()}ms ${STRETCH_EASE}`;
  }

  function updateGradientGeometry(pct) {
    if (!gradBefore || !gradAfter) return;

    const trackWidthPx = wrap.getBoundingClientRect().width;
    const beforeWidthPx = (trackWidthPx * pct) / 100;

    gradBefore.style.width = pct + '%';
    gradBefore.style.backgroundSize = trackWidthPx + 'px 100%';
    gradBefore.style.backgroundPosition = '0px 0';

    gradAfter.style.left = pct + '%';
    gradAfter.style.width = (100 - pct) + '%';
    gradAfter.style.backgroundSize = trackWidthPx + 'px 100%';
    gradAfter.style.backgroundPosition = (-beforeWidthPx) + 'px 0';
  }

  let currentPct = 0;

  function update() {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    currentPct = ((val - min) / (max - min)) * 100;

    before.style.flexBasis = currentPct + '%';
    after.style.flexBasis  = (100 - currentPct) + '%';
    thumb.style.left = currentPct + '%';
    valueEl.value = val.toFixed(decimals);
    valueEl.size = valueEl.value.length;

    updateGradientGeometry(currentPct);

    const stops = colorStops();
    if (stops) {
      const color = colorAtPercent(stops, currentPct);
      if (swatchEl) swatchEl.style.backgroundColor = color;
      const minimalActive = item.closest('.slider-card')?.classList.contains('minimal-mode');
      thumb.style.backgroundColor = (minimalActive && coloredHandleEnabled && (dragging || itemHovered)) ? color : '';
    }
  }

  function selectAllValue() {
    valueEl.select();
  }

  let mouseInteraction = false;

  valueEl.addEventListener('mousedown', () => {
    mouseInteraction = true;
  });
  valueEl.addEventListener('focus', () => {
    if (!mouseInteraction) selectAllValue();
  });
  valueEl.addEventListener('mouseup', () => {
    if (valueEl.selectionStart === valueEl.selectionEnd) {
      selectAllValue();
    }
    mouseInteraction = false;
  });
  valueEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      valueEl.blur();
      return;
    }

    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();

    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const rawStep = parseFloat(input.step);
    const step = isNaN(rawStep) ? 1 : rawStep;
    const delta = step * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);

    let v = parseFloat(valueEl.value);
    if (isNaN(v)) v = parseFloat(input.value);
    v = Math.min(max, Math.max(min, v + delta));
    input.value = v;
    update();
    selectAllValue();
  });
  valueEl.addEventListener('blur', () => {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    let v = parseFloat(valueEl.value);
    if (isNaN(v)) v = parseFloat(input.value);
    v = Math.min(max, Math.max(min, v));
    input.value = v;
    update();
  });

  let dragging = false;
  let itemHovered = false;
  let trackRect = null;
  let baseWidthPx = 0;
  let lastPull = 0;
  let lastDir = 0;

  function rubberBand(overshootPx) {
    const c = 0.55;
    const maxPull = elasticityStrength;
    return maxPull * (1 - 1 / ((overshootPx * c) / maxPull + 1));
  }

  let releaseTimer = null;

  // Pinning an inline pixel width is only needed while actually stretched
  // past the track's edge — once the pull relaxes back to 0 we drop the
  // inline width/transform entirely so the track goes back to its CSS
  // 100% width and keeps following the card if it's resized afterward.
  function releaseWrapWidth() {
    wrap.style.width = '';
    wrap.style.transform = '';
    wrap.style.transition = '';
  }

  function applyStretch(pull, dir, animate) {
    if (pull > 0.01) {
      clearTimeout(releaseTimer);
      wrap.style.transition = animate ? `width ${stretchAnim()}, transform ${stretchAnim()}` : 'none';
      wrap.style.width = (baseWidthPx + pull) + 'px';
      wrap.style.transform = dir === -1 ? `translateX(${-pull}px)` : 'translateX(0px)';
    } else if (animate) {
      wrap.style.transition = `width ${stretchAnim()}, transform ${stretchAnim()}`;
      wrap.style.width = baseWidthPx + 'px';
      wrap.style.transform = 'translateX(0px)';
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(releaseWrapWidth, stretchMs() + 30);
    } else {
      clearTimeout(releaseTimer);
      releaseWrapWidth();
    }

    updateGradientGeometry(currentPct);
    lastPull = pull;
    lastDir = dir;
  }

  function onDragMove(e) {
    if (!dragging || !trackRect) return;
    let overshoot = 0;
    let dir = 0;
    if (e.clientX < trackRect.left) {
      overshoot = trackRect.left - e.clientX;
      dir = -1;
    } else if (e.clientX > trackRect.right) {
      overshoot = e.clientX - trackRect.right;
      dir = 1;
    }
    const pull = (elasticityEnabled && overshoot > 0) ? rubberBand(overshoot) : 0;
    applyStretch(pull, dir, false);
  }

  const GRAY_H_IDLE = 2, GRAY_H_HOVER = 4;
  const GRAD_H_IDLE = 0, GRAD_H_HOVER = 12;

  function setBarHeights(grayH, gradH, animate) {
    const heightT = animate ? `height ${stretchAnim()}` : 'none';
    grayBar.style.transition = heightT;
    grayBar.style.height = grayH + 'px';

    if (!gradBefore || !gradAfter) return;

    const gradTransition = animate
      ? `height ${stretchAnim()}, bottom ${stretchAnim()}`
      : 'none';
    gradBefore.style.transition = gradTransition;
    gradBefore.style.height = gradH + 'px';
    gradBefore.style.bottom = grayH + 'px';

    gradAfter.style.transition = gradTransition;
    gradAfter.style.height = gradH + 'px';
    gradAfter.style.bottom = grayH + 'px';
  }

  function clearBarHeightOverrides() {
    grayBar.style.height = '';
    grayBar.style.transition = '';
    if (!gradBefore || !gradAfter) return;
    gradBefore.style.height = '';
    gradBefore.style.bottom = '';
    gradBefore.style.transition = '';
    gradAfter.style.height = '';
    gradAfter.style.bottom = '';
    gradAfter.style.transition = '';
  }

  function setHover(on) {
    wrap.classList.toggle('hovered', on || dragging);
  }

  wrap.addEventListener('mouseenter', () => setHover(true));
  wrap.addEventListener('mouseleave', () => setHover(false));

  input.addEventListener('pointerdown', () => {
    dragging = true;
    trackRect = wrap.getBoundingClientRect();
    baseWidthPx = trackRect.width;
    applyStretch(0, 0, false);
    wrap.classList.add('hovered');
    item.classList.add('is-dragging');
    update();
  });
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', () => {
    let wasPulled = false;

    if (dragging) {
      dragging = false;
      item.classList.remove('is-dragging');
      update();
      wasPulled = lastPull > 0.01;

      if (wasPulled) {
        applyStretch(lastPull, lastDir, false);
        void wrap.offsetWidth;
        requestAnimationFrame(() => {
          applyStretch(0, 0, true);
        });
      } else {
        applyStretch(0, 0, false);
      }
    }

    if (wasPulled) {
      setBarHeights(GRAY_H_HOVER, GRAD_H_HOVER, false);
      void grayBar.offsetHeight;
      requestAnimationFrame(() => {
        setBarHeights(GRAY_H_IDLE, GRAD_H_IDLE, true);
        wrap.classList.remove('hovered');
        setTimeout(clearBarHeightOverrides, stretchMs() + 30);
      });
    } else if (!wrap.matches(':hover')) {
      wrap.classList.remove('hovered');
    }
  });

  input.addEventListener('focus', () => wrap.classList.add('hovered'));
  input.addEventListener('blur', () => {
    if (!dragging && !wrap.matches(':hover')) wrap.classList.remove('hovered');
  });

  const row = item.querySelector('.row');
  const iconBtn = item.querySelector('.icon-btn');
  if (row && iconBtn) {
    iconBtn.addEventListener('mouseenter', () => {
      iconBtn.classList.add('icon-active');
    });
    iconBtn.addEventListener('mouseleave', (e) => {
      const stillInRow = e.relatedTarget && row.contains(e.relatedTarget);
      if (stillInRow) iconBtn.classList.remove('icon-active');
    });
    row.addEventListener('mouseleave', () => {
      setTimeout(() => iconBtn.classList.remove('icon-active'), 160);
    });
  }

  if (colorStops()) {
    item.addEventListener('mouseenter', () => {
      itemHovered = true;
      update();
    });
    item.addEventListener('mouseleave', () => {
      itemHovered = false;
      update();
    });
    window.addEventListener('slider-mode-change', update);
    window.addEventListener('slider-colored-handle-change', update);
  }

  if (LIGHT_VARIANT_SWATCHES.includes(swatchKey)) {
    const themeToggle = document.querySelector('.theme-toggle');
    if (themeToggle) themeToggle.addEventListener('click', update);
  }

  let simulateHoverTimer = null;

  // Mirrors the visual feedback of a real hover/drag (thickened track,
  // popped gradient/swatch, colored thumb) for a fixed duration, so a
  // programmatic value change (shuffle) looks the same as a manual one.
  function simulateHover(duration) {
    clearTimeout(simulateHoverTimer);
    wrap.classList.add('hovered');
    item.classList.add('is-dragging');
    itemHovered = true;
    update();

    simulateHoverTimer = setTimeout(() => {
      item.classList.remove('is-dragging');
      if (!item.matches(':hover')) itemHovered = false;
      if (!wrap.matches(':hover')) wrap.classList.remove('hovered');
      update();
    }, duration);
  }

  let shuffleFrame = null;

  function animateValueTo(target, duration) {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const start = parseFloat(input.value);
    const clampedTarget = Math.min(max, Math.max(min, target));
    if (shuffleFrame) cancelAnimationFrame(shuffleFrame);

    if (clampedTarget === start) return;

    const startTime = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - startTime) / duration);
      input.value = start + (clampedTarget - start) * easeOutCubic(t);
      // Dispatch a real 'input' event rather than calling update() directly,
      // so other listeners tied to this slider (e.g. the frequency wave's
      // redraw) stay in sync during and after the animation.
      input.dispatchEvent(new Event('input', { bubbles: true }));
      if (t < 1) {
        shuffleFrame = requestAnimationFrame(frame);
      } else {
        shuffleFrame = null;
      }
    }

    shuffleFrame = requestAnimationFrame(frame);
  }

  item.shuffleValue = function shuffleValue() {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const rawStep = parseFloat(input.step);
    const step = isNaN(rawStep) || rawStep <= 0 ? 0 : rawStep;

    let target = min + Math.random() * (max - min);
    if (step > 0) {
      target = Math.round(target / step) * step;
    }

    animateValueTo(target, shuffleDuration);
    simulateHover(shuffleDuration);
  };

  input.addEventListener('input', update);
  update();

  // The gradient's background-size is pinned to the track's pixel width
  // at the moment it's drawn, so it must be recomputed whenever the
  // track itself resizes (e.g. dragging the slider card's resize handle
  // or the window resizing) — otherwise it stays pinned to its original
  // width instead of stretching along with the rest of the slider.
  if (gradBefore && gradAfter) {
    new ResizeObserver(() => updateGradientGeometry(currentPct)).observe(wrap);
  }
}

document.querySelectorAll('.slider-item').forEach(setupSlider);
