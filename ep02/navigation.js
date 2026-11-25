(() => {
  const toc = document.getElementById('toc');
  const buttons = [...toc.querySelectorAll('.toc-filters button')];
  const rows = [...toc.querySelectorAll('.toc-list a[data-category]')];
  let selected = buttons[0];

  function closeOtherStations(except) {
    document.querySelectorAll('details.stop[open]').forEach(station => {
      if (station !== except) window.huxDetailsMotion.closeInstant(station);
    });
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (selected === button) return;
    selected.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-pressed', 'true');
    selected = button;
    rows.forEach(row => {
      const hidden = button !== buttons[0] && row.dataset.category !== button.dataset.filter;
      if (row.hidden !== hidden) row.hidden = hidden;
    });
  }));

  rows.forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const station = document.getElementById(link.hash.slice(1));
    if (!station) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    closeOtherStations(station);
    const animate = !huxMobileStations.matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!station.open || station.__huxClosing) {
      if (animate) window.huxDetailsMotion.open(station);
      else {
        window.huxDetailsMotion.closeInstant(station);
        station.open = true;
      }
    }
    if (event.detail === 0) station.querySelector('summary').focus({ preventScroll: true });
    if (station.id === 'silq') {
      station.querySelector('.gallery')?.scrollTo({ left: 0, behavior: 'instant' });
    }
    station.scrollIntoView({ behavior: animate ? 'smooth' : 'instant', block: 'start' });
  }));

  document.querySelectorAll('a[href="#toc"], .footer a[href="#top"], .hux-back-top').forEach(link => {
    link.addEventListener('click', () => closeOtherStations());
  });

  function openLinkedStation() {
    const station = document.getElementById(location.hash.slice(1));
    if (station?.matches('details.stop')) {
      closeOtherStations(station);
      if (station.__huxClosing) window.huxDetailsMotion.closeInstant(station);
      station.open = true;
    } else if (!location.hash || location.hash === '#toc' || location.hash === '#top') {
      closeOtherStations();
    }
  }

  document.getElementById('about').before(document.getElementById('share-strip'));
  openLinkedStation();
  addEventListener('hashchange', openLinkedStation);
  document.querySelectorAll('[data-hux-lang]').forEach(button => button.addEventListener('click', () => {
    location.href = 'ep02-' + button.dataset.huxLang + '.html' + location.hash;
  }));
})();
