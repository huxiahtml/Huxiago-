(() => {
  let player = null;
  const canalFrames = new WeakMap();
  const manuallyPaused = new WeakSet();

  const controls = window.huxVideoControls;

  function syncClip(figure, frame) {
    const pause = figure.querySelector('.clip-pause');
    const sound = figure.querySelector('.clip-sound');
    if (!pause || !sound) return;
    const playing = frame?.paused === false;
    const audible = frame?.muted === false;
    pause.innerHTML = playing ? controls.icons.pause : controls.icons.play;
    sound.innerHTML = audible ? controls.icons.sound : controls.icons.mute;
    for (const [button, on] of [[pause, playing], [sound, audible]]) {
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', on ? button.dataset.onLabel : button.dataset.offLabel);
    }
  }

  function closeFloating() {
    player?.shell?.close();
  }

  function play(figure) {
    if (player?.figure === figure) return player.frame;
    if (player?.figure.matches('.canal-clip')) {
      closeFloating();
      player = null;
    }
    if (player) {
      closeFloating();
      const { frame, figure: previous, button } = player;
      frame.pause();
      frame.removeAttribute('src');
      frame.load();
      frame.remove();
      button.setAttribute('aria-pressed', 'false');
      previous.classList.remove('is-loaded');
      syncClip(previous);
    }
    const frame = figure.matches('.canal-clip') ? canalFrame(figure) : createFrame(figure);
    player = { figure, frame, shell: null, button: figure.querySelector('.reel-pip-launch') };
    return frame;
  }

  function canalFrame(figure) {
    if (!canalFrames.has(figure)) canalFrames.set(figure, createFrame(figure));
    return canalFrames.get(figure);
  }

  function createFrame(figure) {
    const frame = document.createElement('video');
    const standalone = figure.matches('.canal-clip');
    frame.title = figure.querySelector('figcaption').textContent;
    frame.src = figure.dataset.video;
    frame.controls = !standalone;
    frame.muted = standalone;
    frame.defaultMuted = standalone;
    if (figure.closest('#kushiro')) frame.volume = 0.45;
    frame.playsInline = true;
    frame.preload = 'none';
    frame.tabIndex = 0;
    frame.setAttribute('aria-label', frame.title);
    if (standalone) {
      for (const event of ['play', 'pause', 'volumechange', 'ended']) {
        frame.addEventListener(event, () => {
          syncClip(figure, frame);
        });
      }
    }
    figure.querySelector('.reel-viewport').append(frame);
    figure.classList.add('is-loaded');
    return frame;
  }

  function float(figure) {
    if (player?.figure === figure && player.shell) {
      closeFloating();
      return;
    }
    const firstPlay = player?.figure !== figure;
    const frame = play(figure);
    const state = player;
    state.shell = controls.open({
      media: frame,
      kind: 'video',
      title: frame.title,
      focusControls: state.button.matches(':focus-visible'),
      original: figure.querySelector('.reel-origin')?.href,
      playbackChanged(paused) {
        if (!figure.matches('.canal-clip')) return;
        if (paused) manuallyPaused.add(figure);
        else manuallyPaused.delete(figure);
      },
      close() {
        controls.move(frame, figure.querySelector('.reel-viewport'));
        state.shell = null;
        state.button.setAttribute('aria-pressed', 'false');
        const station = figure.closest('details.stop');
        if (station && !station.open) frame.pause();
        else state.button.focus({ preventScroll: true });
      },
    });
    if (firstPlay) frame.play().catch(() => {});
    state.button.setAttribute('aria-pressed', 'true');
  }

  document.querySelectorAll('.ep02-reel .reel-pip-launch').forEach(button => {
    button.innerHTML = controls.icons.pip;
  });
  document.querySelectorAll('.canal-clip').forEach(figure => syncClip(figure));

  document.addEventListener('click', event => {
    const button = event.target.closest('.ep02-reel button');
    if (!button) return;
    const figure = button.closest('.ep02-reel');
    if (button.matches('.ep01-reel-play, .clip-pause')) {
      const canal = figure.matches('.canal-clip');
      const frame = canal ? canalFrame(figure) : play(figure);
      if (frame.paused) {
        manuallyPaused.delete(figure);
        frame.play().catch(() => {});
      } else {
        if (canal) manuallyPaused.add(figure);
        frame.pause();
      }
      if (button.matches('.ep01-reel-play')) frame.focus({ preventScroll: true });
    }
    if (button.matches('.clip-sound')) {
      const frame = canalFrame(figure);
      manuallyPaused.delete(figure);
      frame.muted = !frame.muted;
      if (frame.paused) frame.play().catch(() => {});
    }
    if (button.matches('.reel-pip-launch')) float(figure);
  });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        for (const figure of entry.target.querySelectorAll('.canal-clip')) {
          if (player?.figure === figure && player.shell) continue;
          const frame = canalFrames.get(figure);
          if (!entry.isIntersecting) {
            frame?.pause();
          } else if (!reducedMotion.matches && !manuallyPaused.has(figure) && frame?.muted !== false) {
            canalFrame(figure).play().catch(() => {});
          }
        }
      }
    }, { threshold: 0.25 });
    document.querySelectorAll('.canal-clips').forEach(section => {
      const clip = section.querySelector('.canal-clip');
      if (clip && !clip.dataset.video.startsWith('data:')) observer.observe(section);
    });
    reducedMotion.addEventListener('change', () => {
      if (reducedMotion.matches) {
        document.querySelectorAll('.canal-clip').forEach(figure => {
          if (player?.figure !== figure || !player.shell) canalFrames.get(figure)?.pause();
        });
      }
    });
  }

  document.querySelectorAll('details.stop').forEach(station => {
    station.addEventListener('toggle', () => {
      if (!station.open) {
        station.querySelectorAll('.canal-clip').forEach(figure => {
          if (player?.figure !== figure || !player.shell) canalFrames.get(figure)?.pause();
        });
      }
      if (!station.open && player && !player.shell && station.contains(player.figure)) {
        player.frame.pause();
      }
    });
  });
})();
