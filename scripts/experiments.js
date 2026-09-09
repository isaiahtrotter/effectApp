function setupExperiment(item) {
  const input = item.querySelector('.exp-range');
  if (!input) return;

  const valueEl = item.querySelector('.exp-value');
  const decimals = parseInt(item.dataset.decimals || '0', 10);
  const unit = item.dataset.unit || '';
  const leds = item.querySelectorAll('.led');

  function update() {
    const min = parseFloat(input.min);
    const max = parseFloat(input.max);
    const val = parseFloat(input.value);
    const pct = ((val - min) / (max - min)) * 100;

    item.style.setProperty('--pct', pct);

    if (valueEl) valueEl.textContent = val.toFixed(decimals) + unit;

    if (leds.length) {
      const lit = Math.round((pct / 100) * leds.length);
      leds.forEach((led, i) => led.classList.toggle('lit', i < lit));
    }
  }

  input.addEventListener('input', update);
  update();
}

document.querySelectorAll('.exp-item').forEach(setupExperiment);
