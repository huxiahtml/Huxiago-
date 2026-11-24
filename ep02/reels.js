(() => {
  let player = null;

  function closeFloating(restoreFocus = true) {
    if (!player?.shell) return;
    const { figure, frame, shell, button } = player;
    figure.querySelector('.reel-viewport').append(frame);
    shell.remove();
    player.shell = null;
    button.setAttribute('aria-pressed', 'false');
    if (restoreFocus) button.focus();
  }

  function makeDraggable(head, shell) {
    let drag = null;
    head.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('a, button')) return;
      const bounds = shell.getBoundingClientRect();
      drag = { pointer: event.pointerId, x: event.clientX - bounds.left, y: event.clientY - bounds.top };
      head.setPointerCapture(event.pointerId);
    });
    head.addEventListener('pointermove', event => {
      if (drag?.pointer !== event.pointerId) return;
      const x = Math.max(0, Math.min(innerWidth - shell.offsetWidth, event.clientX - drag.x));
      const y = Math.max(0, Math.min(innerHeight - shell.offsetHeight, event.clientY - drag.y));
      Object.assign(shell.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    });
    head.addEventListener('lostpointercapture', () => { drag = null; });
  }

  function play(figure) {
    if (player?.figure === figure) return player.frame;
    if (player) {
      closeFloating(false);
      player.frame.remove();
      player.figure.classList.remove('is-loaded');
    }
    const frame = document.createElement('iframe');
    frame.title = figure.querySelector('figcaption').textContent;
    frame.src = figure.dataset.embed;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    figure.querySelector('.reel-viewport').append(frame);
    figure.classList.add('is-loaded');
    player = { figure, frame, shell: null, button: figure.querySelector('.reel-pip-launch') };
    return frame;
  }

  function float(figure) {
    if (player?.figure === figure && player.shell) {
      closeFloating();
      return;
    }
    const frame = play(figure);
    const shell = document.createElement('aside');
    shell.className = 'hux-reel-pip';
    shell.dataset.kind = 'reel';
    shell.setAttribute('aria-label', player.button.getAttribute('aria-label'));
    const head = document.createElement('div');
    head.className = 'hux-reel-pip-head';
    const title = document.createElement('span');
    title.textContent = frame.title;
    const original = figure.querySelector('.reel-origin').cloneNode(true);
    original.removeAttribute('class');
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.textContent = '×';
    exit.setAttribute('aria-label', figure.dataset.close);
    exit.addEventListener('click', () => closeFloating());
    head.append(title, original, exit);
    const screen = document.createElement('div');
    screen.className = 'hux-reel-pip-screen';
    screen.append(frame);
    shell.append(head, screen);
    document.body.append(shell);
    player.shell = shell;
    player.button.setAttribute('aria-pressed', 'true');
    makeDraggable(head, shell);
    exit.focus();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.ep02-reel button');
    if (!button) return;
    const figure = button.closest('.ep02-reel');
    if (button.matches('.ep01-reel-play')) play(figure).focus();
    if (button.matches('.reel-pip-launch')) float(figure);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && player?.shell) closeFloating();
  });
})();
