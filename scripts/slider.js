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
    if (e.key === 'Enter') valueEl.blur();
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

  const MAX_PULL = 10;

  function rubberBand(overshootPx) {
    const c = 0.55;
    return MAX_PULL * (1 - 1 / ((overshootPx * c) / MAX_PULL + 1));
  }

  function applyStretch(pull, dir, animate) {
    const wrapTransition = animate ? `width ${stretchAnim()}, transform ${stretchAnim()}` : 'none';
    wrap.style.transition = wrapTransition;
    wrap.style.width = (baseWidthPx + pull) + 'px';
    wrap.style.transform = dir === -1 ? `translateX(${-pull}px)` : 'translateX(0px)';

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
    const pull = overshoot > 0 ? rubberBand(overshoot) : 0;
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
}

document.querySelectorAll('.slider-item').forEach(setupSlider);
