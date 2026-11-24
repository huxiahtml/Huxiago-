(() => {
  const dialog = document.getElementById('canal-route');
  const trigger = document.querySelector('[data-map-dialog="canal-route"]');
  if (!dialog || !trigger) return;
  trigger.addEventListener('click', () => dialog.showModal());

  const from = dialog.querySelector('.canal-from');
  const to = dialog.querySelector('.canal-to');
  const pins = [...dialog.querySelectorAll('.canal-pin')];
  const output = dialog.querySelector('.canal-trip');
  const view = dialog.querySelector('.canal-viewport');
  const highlight = dialog.querySelector('.canal-selected');

  function selectPier(index) {
    if (from.value === '' || to.value !== '') {
      from.value = index;
      to.value = '';
    } else if (from.value !== index) {
      to.value = index;
    }
    refresh();
  }

  function refresh() {
    const a = from.selectedIndex - 1;
    const b = to.selectedIndex - 1;
    pins.forEach((pin, i) => pin.setAttribute('aria-pressed', String(i === a || i === b)));
    if (a < 0 || b < 0 || a === b) {
      highlight.setAttribute('points', '');
      output.textContent = a >= 0 ? from.options[from.selectedIndex].textContent : '';
      return;
    }

    const west = Math.min(a, b);
    const east = Math.max(a, b);
    const points = pins.slice(west, east + 1).map(pin =>
      [parseFloat(pin.style.getPropertyValue('--x')), parseFloat(pin.style.getPropertyValue('--y'))].join(','));
    highlight.setAttribute('points', points.join(' '));
    const direction = a < b ? dialog.dataset.east : dialog.dataset.west;
    const distance = dialog.dataset.distance.replace('{count}', east - west);
    const transfer = west < 4 && east > 4 ? ' · ' + dialog.dataset.transfer : '';
    output.textContent = direction + ' · ' + distance + transfer;
  }

  pins.forEach(pin => pin.addEventListener('click', () => selectPier(pin.dataset.pier)));
  for (const picker of [from, to]) {
    picker.addEventListener('change', () => {
      if (from.value === to.value && from.value !== '') {
        const other = picker === from ? to : from;
        other.value = '';
      }
      refresh();
      const pin = pins[picker.selectedIndex - 1];
      if (pin) view.scrollLeft = pin.offsetLeft - view.clientWidth / 2;
    });
  }
})();
