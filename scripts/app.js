const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('light-mode');
  });
}

document.querySelectorAll('.control-slider').forEach((item) => {
  const input = item.querySelector('.range-input');
  const cssVar = item.dataset.cssVar;
  const unit = item.dataset.unit || '';

  function apply() {
    document.documentElement.style.setProperty(cssVar, input.value + unit);
  }

  input.addEventListener('input', apply);
  apply();
});

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
