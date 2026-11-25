(() => {
  let player = null;

  function moveFrame(frame, target) {
    const playing = !frame.paused;
    target.append(frame);
    if (playing) frame.play().catch(() => {});
  }

  function syncClip(figure, frame) {
    const pause = figure.querySelector('.clip-pause');
    const sound = figure.querySelector('.clip-sound');
    if (!pause || !sound) return;
    const playing = frame?.paused === false;
    const audible = frame?.muted === false;
    for (const [button, on] of [[pause, playing], [sound, audible]]) {
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', on ? button.dataset.onLabel : button.dataset.offLabel);
    }
  }

  function closeFloating() {
    if (!player?.shell) return;
    const { figure, frame, shell, button } = player;
    if (figure.matches('.canal-clip')) frame.controls = false;
    moveFrame(frame, figure.querySelector('.reel-viewport'));
    shell.remove();
    player.shell = null;
    button.setAttribute('aria-pressed', 'false');
    if (!figure.closest('details.stop')?.open) frame.pause();
    else button.focus({ preventScroll: true });
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
      const { frame, figure: previous, shell, button } = player;
      frame.pause();
      frame.removeAttribute('src');
      frame.load();
      frame.remove();
      shell?.remove();
      button.setAttribute('aria-pressed', 'false');
      previous.classList.remove('is-loaded');
      syncClip(previous);
    }
    const frame = document.createElement('video');
    const standalone = figure.matches('.canal-clip');
    frame.title = figure.querySelector('figcaption').textContent;
    frame.src = figure.dataset.video;
    frame.controls = !standalone;
    frame.muted = standalone;
    frame.defaultMuted = standalone;
    frame.playsInline = true;
    frame.preload = 'none';
    frame.tabIndex = 0;
    frame.setAttribute('aria-label', frame.title);
    if (standalone) {
      for (const event of ['play', 'pause', 'volumechange', 'ended']) {
        frame.addEventListener(event, () => {
          if (player?.frame === frame) syncClip(figure, frame);
        });
      }
    }
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
    const firstPlay = player?.figure !== figure;
    const frame = play(figure);
    const shell = document.createElement('aside');
    shell.className = 'hux-reel-pip';
    shell.dataset.kind = figure.dataset.kind;
    shell.setAttribute('aria-label', player.button.getAttribute('aria-label'));
    const head = document.createElement('div');
    head.className = 'hux-reel-pip-head';
    const title = document.createElement('span');
    title.textContent = frame.title;
    const original = figure.querySelector('.reel-origin')?.cloneNode(true);
    const exit = document.createElement('button');
    exit.type = 'button';
    exit.textContent = '×';
    exit.setAttribute('aria-label', figure.dataset.close);
    exit.addEventListener('click', () => closeFloating());
    head.append(title);
    if (original) {
      original.removeAttribute('class');
      head.append(original);
    }
    head.append(exit);
    const screen = document.createElement('div');
    screen.className = 'hux-reel-pip-screen';
    shell.append(head, screen);
    document.body.append(shell);
    moveFrame(frame, screen);
    if (figure.matches('.canal-clip')) {
      frame.controls = true;
      if (firstPlay) frame.play().catch(() => {});
    }
    player.shell = shell;
    player.button.setAttribute('aria-pressed', 'true');
    makeDraggable(head, shell);
    exit.focus();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.ep02-reel button');
    if (!button) return;
    const figure = button.closest('.ep02-reel');
    if (button.matches('.ep01-reel-play, .clip-pause')) {
      const frame = play(figure);
      if (frame.paused) frame.play().catch(() => {});
      else frame.pause();
      if (button.matches('.ep01-reel-play')) frame.focus();
    }
    if (button.matches('.clip-sound')) {
      const frame = play(figure);
      frame.muted = !frame.muted;
      if (frame.paused) frame.play().catch(() => {});
    }
    if (button.matches('.reel-pip-launch')) float(figure);
  });
  document.querySelectorAll('details.stop').forEach(station => {
    station.addEventListener('toggle', () => {
      if (!station.open && player && !player.shell && station.contains(player.figure)) {
        player.frame.pause();
      }
    });
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && player?.shell && !document.querySelector('dialog[open]')) {
      closeFloating();
    }
  });
})();
