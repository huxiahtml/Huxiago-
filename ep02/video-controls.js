(() => {
  const glyph = inner => '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  const speaker = '<path d="M4 9h3l4.5-3.5v13L7 15H4Z"/>';
  const icons = {
    pip: glyph('<rect x="2.5" y="4.5" width="19" height="15" rx="2.6"/><rect x="12.3" y="11.9" width="6.5" height="4.7" rx="1.15" fill="currentColor" stroke="none"/>'),
    return: glyph('<path d="M9 5H6a1.5 1.5 0 0 0-1.5 1.5V9M15 5h3a1.5 1.5 0 0 1 1.5 1.5V9M4.5 15v2.5A1.5 1.5 0 0 0 6 19h3m10.5-4v2.5A1.5 1.5 0 0 1 18 19h-3"/><rect x="9" y="9.5" width="6" height="5" rx="1"/>'),
    instagram: glyph('<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.75"/><circle cx="17.25" cy="6.85" r=".9" fill="currentColor" stroke="none"/>'),
    original: glyph('<path d="M8 12a4 4 0 0 1 4-4h4a4 4 0 0 1 0 8h-2m2-4a4 4 0 0 1-4 4H8a4 4 0 1 1 0-8h2"/>'),
    play: glyph('<path d="M9 5.9a.75.75 0 0 0-1.15.63v10.94c0 .6.67.96 1.15.64l8.6-5.47a.75.75 0 0 0 0-1.28Z" fill="currentColor" stroke="none"/>'),
    pause: glyph('<rect x="7" y="6" width="3.6" height="12" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="6" width="3.6" height="12" rx="1.2" fill="currentColor" stroke="none"/>'),
    sound: glyph(speaker + '<path d="M15 9.3a3.7 3.7 0 0 1 0 5.4m2.4-7.7a7.2 7.2 0 0 1 0 10"/>'),
    mute: glyph(speaker + '<path d="m15.6 9.8 4.4 4.4m0-4.4-4.4 4.4"/>'),
  };
  const labels = {
    'zh-Hant': ['返回頁面影片', '開啟原片', '播放影片', '暫停影片', '開啟聲音', '關閉聲音'],
    'zh-Hans': ['返回页面视频', '打开原片', '播放视频', '暂停视频', '开启声音', '关闭声音'],
    en: ['Return to inline video', 'Open original video', 'Play video', 'Pause video', 'Unmute', 'Mute'],
  };
  let active;
  function button(className, label, icon) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    element.setAttribute('aria-label', label);
    element.innerHTML = icon;
    return element;
  }

  function move(video, target) {
    const playing = !video.paused;
    target.append(video);
    if (playing) video.play().catch(() => {});
  }

  function enableDrag(surface, shell) {
    let press;
    let suppressClick = false;
    surface.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      const rect = shell.getBoundingClientRect();
      press = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
      suppressClick = false;
      surface.setPointerCapture(event.pointerId);
    });
    surface.addEventListener('pointermove', event => {
      if (press?.id !== event.pointerId) return;
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (!suppressClick && Math.hypot(dx, dy) < 8) return;
      suppressClick = true;
      const left = Math.max(0, Math.min(innerWidth - shell.offsetWidth, press.left + dx));
      const top = Math.max(0, Math.min(innerHeight - shell.offsetHeight, press.top + dy));
      Object.assign(shell.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto' });
    });
    surface.addEventListener('lostpointercapture', () => { press = null; });
    surface.addEventListener('click', event => {
      if (!suppressClick || event.detail === 0) return;
      suppressClick = false;
      event.stopImmediatePropagation();
    }, true);
  }

  function open({ media, kind, title, original, close: onClose, playbackChanged, focusControls = false }) {
    active?.close();
    const [returnLabel, originalLabel, playLabel, pauseLabel, unmuteLabel, muteLabel] =
      labels[document.documentElement.lang] || labels['zh-Hant'];
    const shell = document.createElement('aside');
    shell.className = 'hux-reel-pip hux-video-pip';
    shell.dataset.kind = kind;
    shell.setAttribute('aria-label', title);
    const screen = document.createElement('div');
    screen.className = 'hux-reel-pip-screen';
    const controls = document.createElement('div');
    controls.className = 'hux-pip-controls';
    const back = button('hux-pip-icon hux-pip-return', returnLabel, icons.return);
    const loud = button('hux-pip-icon hux-pip-sound', muteLabel, icons.sound);
    const surface = button('hux-pip-surface', pauseLabel, '');
    const video = media instanceof HTMLVideoElement ? media : null;
    const previousControls = video?.controls;
    let timer;
    const events = ['play', 'pause', 'ended', 'volumechange', 'loadedmetadata'];
    const session = { media, shell, close };
    if (original) {
      const link = document.createElement('a');
      link.className = 'hux-pip-icon hux-pip-original';
      link.href = original;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', originalLabel);
      link.innerHTML = /(^|\.)instagram\.com$/i.test(new URL(link.href).hostname) ? icons.instagram : icons.original;
      controls.append(link);
    }
    controls.append(back);
    if (video) {
      controls.prepend(surface);
      enableDrag(surface, shell);
      shell.addEventListener('pointermove', event => {
        if (event.pointerType === 'mouse' && !event.buttons) showControls();
      });
      controls.append(loud);
      surface.addEventListener('click', () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        playbackChanged?.(video.paused);
      });
      loud.addEventListener('click', () => { video.muted = !video.muted; });
      video.controls = false;
      events.forEach(name => video.addEventListener(name, sync));
    }
    back.addEventListener('click', close);
    screen.append(controls);
    shell.append(screen);
    document.body.append(shell);
    active = session;
    if (video) move(video, screen);
    else screen.append(media);
    screen.append(controls);
    sync();
    if (focusControls) back.focus({preventScroll:true});
    return session;

    function showControls() {
      clearTimeout(timer);
      shell.classList.add('hux-pip-ready');
      if (video && !video.paused) timer = setTimeout(() => shell.classList.remove('hux-pip-ready'), 3200);
    }

    function sync() {
      showControls();
      if (!video) return;
      if (video.videoWidth && video.videoHeight) {
        shell.style.setProperty('--hux-video-ratio', video.videoWidth + ' / ' + video.videoHeight);
        shell.style.setProperty('--hux-video-ratio-number', String(video.videoWidth / video.videoHeight));
      }
      surface.innerHTML = video.paused ? icons.play : '';
      surface.setAttribute('aria-label', video.paused ? playLabel : pauseLabel);
      loud.innerHTML = video.muted ? icons.mute : icons.sound;
      loud.setAttribute('aria-label', video.muted ? unmuteLabel : muteLabel);
      loud.setAttribute('aria-pressed', String(video.muted));
    }
    function close() {
      if (active !== session) return;
      active = null;
      clearTimeout(timer);
      if (video) {
        events.forEach(name => video.removeEventListener(name, sync));
        video.controls = previousControls;
      }
      onClose();
      shell.remove();
    }
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]')) active?.close();
  });
  window.huxVideoControls = {
    icons, open, move,
    isFloating: media => active?.media === media,
    close(media) { if (active?.media === media) active.close(); },
  };
})();
