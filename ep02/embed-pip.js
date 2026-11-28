(() => {
  let active;
  function makeFrame(figure) {
    const frame = document.createElement('iframe');
    frame.title = figure.querySelector('figcaption').textContent;
    frame.src = figure.dataset.embed;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    return frame;
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('.reel-pip-launch');
    if (!button) return;
    const figure = button.closest('.reel-figure');
    if (!figure?.dataset.embed) return;
    event.preventDefault();
    if (active?.figure === figure) {
      active.session.close();
      return;
    }
    active?.session.close();
    const viewport = figure.querySelector('.reel-viewport');
    const wasLoaded = figure.classList.contains('is-loaded');
    viewport.querySelector('iframe')?.remove();
    figure.classList.remove('is-loaded');
    const frame = makeFrame(figure);
    const session = window.huxVideoControls.open({
      media: frame,
      kind: figure.dataset.kind,
      title: frame.title,
      focusControls: button.matches(':focus-visible'),
      original: figure.querySelector('.reel-origin')?.href,
      close() {
        button.setAttribute('aria-pressed', 'false');
        let focusTarget = button;
        if (wasLoaded) {
          focusTarget = makeFrame(figure);
          viewport.append(focusTarget);
          figure.classList.add('is-loaded');
        }
        active = null;
        focusTarget.focus({ preventScroll: true });
      },
    });
    active = { figure, session };
    button.setAttribute('aria-pressed', 'true');
  });
})();
