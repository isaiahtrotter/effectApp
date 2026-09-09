// Shared across every slider instance so a single toggle/slider can
// control the rubber-band overshoot effect for all of them at once.
let elasticityEnabled = true;
let elasticityStrength = 6;
window.sliderElasticity = {
  setEnabled(enabled) {
    elasticityEnabled = enabled;
  },
  setStrength(strength) {
    elasticityStrength = strength;
  },
};

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
    valueEl.style.width = valueEl.value.length + 'ch';

    updateGradientGeometry(currentPct);
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
  });
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', () => {
    let wasPulled = false;

    if (dragging) {
      dragging = false;
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
