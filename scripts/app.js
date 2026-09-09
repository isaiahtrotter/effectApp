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
