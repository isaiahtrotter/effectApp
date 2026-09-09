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

const elasticityToggle = document.querySelector('[data-elasticity-toggle]');
if (elasticityToggle) {
  elasticityToggle.addEventListener('click', () => {
    const isOn = !elasticityToggle.classList.contains('is-on');
    elasticityToggle.classList.toggle('is-on', isOn);
    elasticityToggle.setAttribute('aria-checked', String(isOn));
    if (window.sliderElasticity) window.sliderElasticity.setEnabled(isOn);
  });
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
