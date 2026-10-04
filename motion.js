// Romeo landing — motion.
// One rAF loop drives everything from Lenis's smoothed scroll value plus a
// clock (for the hero's drifting stories and the endless film strip).
// Only transform and opacity animate on scroll. Videos play only on screen.
// Sound effects are off until the visitor turns them on.
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x) => Math.min(1, Math.max(0, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const out = (p) => 1 - Math.pow(1 - p, 3);
  const inOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const play = (v) => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  const set = (n, v) => { if (n.__t !== v) { n.style.transform = v; n.__t = v; } };
  const fade = (n, v) => { const s = clamp(v).toFixed(3); if (n.__o !== s) { n.style.opacity = s; n.__o = s; } };

  // ── Sound: soft UI effects, off by default ─────────────────────────────
  const Sound = (() => {
    let on = false; try { on = localStorage.getItem('romeo-sound') === '1'; } catch (e) {}
    const lib = {}, vol = { tick: 0.18, pop: 0.22, whoosh2: 0.16, whoosh: 0.14, sparkle: 0.16 };
    const get = (n) => (lib[n] ||= Object.assign(new Audio(`assets/sfx/${n}.mp3`), { preload: 'auto', volume: vol[n] || 0.2 }));
    const btn = $('[data-sound]');
    const sync = () => btn && btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn && btn.addEventListener('click', () => { on = !on; try { localStorage.setItem('romeo-sound', on ? '1' : '0'); } catch (e) {} sync(); if (on) fx('pop'); });
    sync();
    function fx(n) { if (!on || reduce) return; const a = get(n).cloneNode(); a.volume = vol[n] || 0.2; const p = a.play(); if (p && p.catch) p.catch(() => {}); }
    return { fx };
  })();

  // ── Reveals ────────────────────────────────────────────────────────────
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px' });
  $$('[data-reveal], [data-stagger]').forEach((n) => (reduce ? n.classList.add('in') : io.observe(n)));
  // a soft whoosh as each big section arrives
  const sio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) Sound.fx('whoosh2'); }), { threshold: 0.35 });
  $$('[data-scene="convo"], [data-scene="create"], [data-scene="film"], [data-scene="manifesto"], .try').forEach((n) => sio.observe(n));

  // ── Ink-in words ───────────────────────────────────────────────────────
  const ink = $('[data-ink]'), words = [];
  $$('p', ink).forEach((p) => { p.innerHTML = p.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' '); words.push(...$$('.w', p)); });

  // ── The film: a frame that grows, play/pause on view, optional sound ──
  const intro = $('[data-scene="filmintro"]'), reel = $('[data-scene="reel"]'), reelFrame = $('.reel__frame'), reelVideo = $('[data-reel]'), reelSound = $('[data-reel-sound]');
    // Player: play/pause, ±15 s, sound (muted by default). Scrolling only resumes it if the visitor hadn't paused.
  const player = $('[data-player]'), bar = $('[data-bar]'), timeEl = $('[data-time]');
  let userPaused = false;
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const syncPlayer = () => { player.classList.toggle('is-paused', reelVideo.paused); $('[data-toggle]').setAttribute('aria-label', reelVideo.paused ? 'Play' : 'Pause'); };
  reelVideo.muted = true;
  reelVideo.addEventListener('play', syncPlayer); reelVideo.addEventListener('pause', syncPlayer);
  reelVideo.addEventListener('timeupdate', () => { const d = reelVideo.duration || 1; bar.style.transform = `scaleX(${(reelVideo.currentTime / d).toFixed(4)})`; timeEl.textContent = fmt(reelVideo.currentTime); });
  $('[data-toggle]').addEventListener('click', () => { if (reelVideo.paused) { userPaused = false; play(reelVideo); } else { userPaused = true; reelVideo.pause(); } });
  $$('[data-skip]').forEach((b) => b.addEventListener('click', () => { const d = reelVideo.duration || 0; reelVideo.currentTime = Math.max(0, Math.min(d - 0.1, reelVideo.currentTime + +b.dataset.skip)); }));
  reelSound.addEventListener('click', () => { reelVideo.muted = !reelVideo.muted; reelSound.setAttribute('aria-pressed', reelVideo.muted ? 'false' : 'true'); reelSound.setAttribute('aria-label', reelVideo.muted ? 'Turn sound on' : 'Turn sound off'); if (!reelVideo.muted && !userPaused) play(reelVideo); });
  syncPlayer();
  new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? (userPaused || play(reelVideo)) : reelVideo.pause())), { threshold: 0.25 }).observe(reelFrame);

  // ── Conversation ───────────────────────────────────────────────────────
  const convo = $('[data-scene="convo"]'), thread = $('[data-thread]'), msgs = $$('[data-at]', thread);
  const pinnedLayout = (n) => getComputedStyle(n).position === 'sticky';
  let shown = -1;
  function setConvo(p) {
    let last = -1;
    msgs.forEach((m, i) => {
      const at = +m.dataset.at, until = m.dataset.until ? +m.dataset.until : 2, on = p >= at;
      if (on && !m.classList.contains('on')) Sound.fx(m.classList.contains('msg--story') ? 'sparkle' : 'pop');
      m.classList.toggle('on', on); m.classList.toggle('gone', p >= until);
      const v = $('video', m); if (v) on ? play(v) : v.pause();
      if (on && p < until) last = i;
    });
    if (last === shown) return; shown = last;
    const node = msgs[last];
    if (!node) { thread.style.setProperty('--shift', '0px'); return; }
    const bottom = node.offsetTop + node.offsetHeight, room = thread.clientHeight * 0.92;
    thread.style.setProperty('--shift', `${-Math.max(0, bottom - room)}px`);
  }

  // ── Create: a live iPhone, scrubbed by scroll ──────────────────────────
  // Every step's visuals come from scroll progress alone (no timers), so the
  // copy on the left and the phone on the right can never drift apart.
  const create = $('[data-scene="create"]'), steps = $$('.create__steps li'), rail = $('[data-rail]'), phone = $('[data-iphone]'), island = $('[data-island]');
  const arc = $('[data-arc]'), research = $('[data-research]'), wordsEl = $('[data-words]');
  const vGas = $('video[data-v="gas"]'), vCompare = $('video[data-v="compare"]');
  const Q1 = 'Why is gas so expensive in San Francisco?'.split(' '), Q2 = 'How does the rest of California compare?'.split(' ');
  const STATUS = ['Searching the web', 'Pulling insights', 'Writing the script', 'Making videos', 'Adding the voice'];
  let createVisible = false, cur = { step: -1, state: '', island: '', words: '', status: '' };
  const setText = (el, key, v) => { if (cur[key] !== v) { el.textContent = v; cur[key] = v; } };
  function setIsland(mode, p = 0) {           // rest | live | done
    if (cur.island !== mode) { island.classList.toggle('is-live', mode !== 'rest'); island.classList.toggle('is-done', mode === 'done');
      if (mode === 'live') Sound.fx('whoosh'); if (mode === 'done') Sound.fx('pop'); cur.island = mode; }
    arc.style.strokeDashoffset = (100 - clamp(p) * 100).toFixed(1);
  }
  function setState(s) {
    if (cur.state === s) return; cur.state = s; phone.dataset.state = s;
    const want = s === 'answer' ? vCompare : ['story', 'listen2', 'making2'].includes(s) ? vGas : null;
    [vGas, vCompare].forEach((v) => { if (v !== want) v.pause(); });
    if (want && createVisible && s !== 'listen2') { if (s === 'story' || s === 'answer') { try { want.currentTime = 0; } catch (e) {} } play(want); }
  }
  function scrubCreate(p) {
    const x = Math.min(3.999, p * 4), step = Math.floor(x), f = x - step;
    if (step !== cur.step) { Sound.fx('tick'); cur.step = step; }
    steps.forEach((s, i) => { s.classList.toggle('on', i === step); s.classList.toggle('done', i < step); });
    rail.style.transform = `scaleY(${clamp((x + 0.5) / 4).toFixed(3)})`;
    if (step === 0) { setState('listen'); setIsland('rest'); setText(wordsEl, 'words', Q1.slice(0, Math.ceil(clamp(f / 0.8) * Q1.length)).join(' ')); }
    else if (step === 1) { setState('research'); setIsland('live', f); setText(research, 'status', STATUS[Math.min(4, Math.floor(f * 5))]); }
    else if (step === 2) { if (f < 0.22) { setState('research'); setIsland('done', 1); } else { setState('story'); setIsland('rest'); } }
    else {
      if (f < 0.32) { setState('listen2'); setIsland('rest'); setText(wordsEl, 'words', Q2.slice(0, Math.ceil(clamp(f / 0.28) * Q2.length)).join(' ')); }
      else if (f < 0.68) { setState('making2'); setIsland('live', (f - 0.32) / 0.34); }
      else if (f < 0.78) { setState('making2'); setIsland('done', 1); }
      else { setState('answer'); setIsland('rest'); }
    }
  }
  new IntersectionObserver((es) => es.forEach((e) => { createVisible = e.isIntersecting;
    if (!createVisible) { vGas.pause(); vCompare.pause(); }
    else { const v = cur.state === 'answer' ? vCompare : ['story', 'making2'].includes(cur.state) ? vGas : null; if (v) play(v); } })).observe(create);

  // ── Hero: stories drift on waves, then scatter as you scroll ──────────
  const hero = $('[data-scene="hero"]'), copy = $('.hero__copy'), field = $$('.hero__field > *'), heroClouds = $('.hero__clouds');
  const items = field.map((el, i) => { const [x, y, d] = el.dataset.p.split(',').map(Number); return { el, x, y, d, i, w: 0, h: 0 }; });
  const t0 = performance.now();

  // ── Library: an endless strip ─────────────────────────────────────────
  const strip = $('[data-strip]'), filmSec = $('[data-scene="film"]');
  [...strip.children].forEach((f) => strip.appendChild(f.cloneNode(true)));      // a second set makes the loop seamless
  let stripX = 0, stripW = 0, filmVisible = false;
  new IntersectionObserver((es) => es.forEach((e) => (filmVisible = e.isIntersecting))).observe(filmSec);

  const ruler = $('[data-ruler]');
  ruler.innerHTML = Array.from({ length: 60 }, (_, i) => `<span style="left:${i * 120}px">${String(i % 30 + 1).padStart(2, '0')}</span>`).join('');
  // ── Others ─────────────────────────────────────────────────────────────
  const sheet = $('[data-scene="sheet"]'), win = $('.meet__window'), winImg = $('.meet__window img');
  const mfFill = $('.manifesto__stage .clouds--fill');
  const mf = $('[data-scene="manifesto"]'), mfPh = $('.manifesto__ph'), mfFront = $('.manifesto__stage .clouds--front'), mfBack = $('.manifesto__stage .clouds--back'), mfShine = $('.iphone__shine');
  const get = $('[data-scene="get"]'), world = $('.get__world img');

  // ── Layout cache ──────────────────────────────────────────────────────
  let L = {}, vh = innerHeight, vw = innerWidth;
  const top = (n) => n.getBoundingClientRect().top + scrollY;
  function measure() {
    vh = innerHeight; vw = innerWidth;
    L = { hero: [top(hero), hero.offsetHeight], reel: [top(reel), reel.offsetHeight], convo: [top(convo), convo.offsetHeight], create: [top(create), create.offsetHeight],
      sheet: [top(sheet), sheet.offsetHeight], mf: [top(mf), mf.offsetHeight], get: [top(get), get.offsetHeight], ink: [top(ink), ink.offsetHeight] };
    stripW = strip.scrollWidth / 2;
    items.forEach((it) => { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; });
  }
  const pinned = ([t, h], y) => clamp((y - t) / Math.max(1, h - vh));
  const through = ([t, h], y) => clamp((y + vh - t) / (vh + h));

  let lastY = 0, vel = 0, lastT = performance.now();
  function frame(y, now) {
    const dt = Math.min(64, now - lastT) / 1000; lastT = now;
    vel = lerp(vel, (y - lastY) / Math.max(dt, 1 / 120), 0.15); lastY = y;
    const t = (now - t0) / 1000;

    // Hero
    if (y < L.hero[0] + L.hero[1]) {
      const p = pinned(L.hero, y), lift = inOut(clamp(p / 0.5));
      set(copy, `translate3d(0, ${(-lift * 160).toFixed(1)}px, 0) scale(${(1 - lift * 0.08).toFixed(4)})`);
      fade(copy, 1 - clamp((p - 0.1) / 0.4));
      set(heroClouds, `translate3d(0, ${(p * 80).toFixed(1)}px, 0) scale(${(1 + p * 0.12).toFixed(4)})`);
      items.forEach((it) => {
        const e = out(clamp((t - 0.25 - it.i * 0.07) / 1.6));                 // arrive along a wave
        const spread = 1 + p * 0.9 * it.d;
        const bx = it.x * vw * 0.45 * spread, by = it.y * vh * 0.4 * spread - p * vh * 0.55 * it.d;
        const wx = Math.sin(t * 0.45 + it.i * 1.3) * 16 * it.d + Math.sin(e * Math.PI) * 60 * (it.i % 2 ? 1 : -1);
        const wy = Math.cos(t * 0.37 + it.i * 1.9) * 20 * it.d + (1 - e) * (220 + 140 * it.d);
        const rot = Math.sin(t * 0.3 + it.i) * 3 + (1 - e) * (it.i % 2 ? 14 : -14);
        set(it.el, `translate3d(${(bx + wx - it.w / 2).toFixed(1)}px, ${(by + wy - it.h / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${lerp(0.7, 1, e).toFixed(3)})`);
        fade(it.el, out(clamp((t - 0.25 - it.i * 0.07) / 0.6)) * (1 - clamp((p - 0.55) / 0.4)));
      });
    }

    // Ink, then the film grows and the dark gives way to day
    const k = clamp((y + vh * 0.85 - L.ink[0]) / (L.ink[1] + vh * 0.2)), n = Math.round(k * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
    const r = pinned(L.reel, y), g = out(clamp(r / 0.45));
    set(reelFrame, `scale(${lerp(0.62, 1, g).toFixed(4)})`);
    const day = inOut(clamp((r - 0.55) / 0.4));
    const c = (a, b) => Math.round(lerp(a, b, day));
    intro.style.background = `rgb(${c(25, 246)}, ${c(27, 247)}, ${c(34, 249)})`;
    reelFrame.style.setProperty('--sh', (0.5 - 0.32 * day).toFixed(3));   // the shadow lightens with the page, so it never reads as a dark band

    // Conversation and Create
    if (pinnedLayout($('.convo__sticky'))) setConvo(pinned(L.convo, y));
    scrubCreate(pinned(L.create, y));

    // Library: always drifting; scrolling pushes it faster
    if (filmVisible && stripW) {
      stripX -= (40 + Math.min(1600, Math.abs(vel)) * 0.9) * dt;
      if (stripX <= -stripW) stripX += stripW;
      const tilt = Math.max(-1, Math.min(1, vel / 2400));
      set(strip, `translate3d(${stripX.toFixed(1)}px, 0, 0) rotateY(${(-tilt * 4).toFixed(2)}deg)`);
      set(ruler, `translate3d(${((stripX * 0.6) % 3600).toFixed(1)}px, 0, 0)`);
    }

    // Meet: the sheet opens from a window
    const s = out(clamp(through(L.sheet, y) / 0.55));
    win.style.clipPath = `inset(${((1 - s) * 12).toFixed(2)}% ${((1 - s) * 14).toFixed(2)}% round 12px)`;
    set(winImg, `scale(${lerp(1.18, 1, s).toFixed(4)})`);

    // Manifesto: the phone rises, settles below the button, and a shine sweeps it
    const q = pinned(L.mf, y), up = out(clamp(q / 0.7));
    // rises on an ease-out, settles with a slight lean, then floats very gently
    const fl = up > 0.98 ? 1 : 0, ft = now / 1000;
    set(mfPh, `translate3d(${lerp(-24, 0, up).toFixed(1)}px, ${(-(vh * 0.56) * up + fl * Math.sin(ft * 0.9) * 3).toFixed(1)}px, 0) rotate(${(lerp(-9, -4, up) + fl * Math.sin(ft * 0.7) * 0.3).toFixed(3)}deg)`);
    mfShine.style.setProperty('--sx', `${lerp(-130, 230, inOut(clamp((q - 0.42) / 0.4))).toFixed(1)}%`);   // sweeps as it settles
    set(mfFront, `translate3d(0, ${(q * 60).toFixed(1)}px, 0) scale(${(1 + q * 0.08).toFixed(4)})`);
    set(mfBack, `translate3d(0, ${(q * 24).toFixed(1)}px, 0)`);
    set(mfFill, `translate3d(0, ${(q * 40).toFixed(1)}px, 0) scale(-1, 1)`);


    // Footer world drifts up a little
    set(world, `translate3d(0, ${lerp(-40, 0, through(L.get, y)).toFixed(1)}px, 0)`);
  }

  measure();
  if (reduce) {
    words.forEach((w) => w.classList.add('on')); msgs.forEach((m) => { m.classList.add('on'); const v = $('video', m); if (v) play(v); });
    items.forEach((it) => set(it.el, `translate3d(${(it.x * vw * 0.43 - it.w / 2).toFixed(1)}px, ${(it.y * vh * 0.4 - it.h / 2).toFixed(1)}px, 0)`));
    set(mfPh, `translateY(${-vh * 0.52}px)`);
    addEventListener('scroll', () => scrubCreate(pinned(L.create, scrollY)), { passive: true }); scrubCreate(0);
    return;
  }
  if (!pinnedLayout($('.convo__sticky'))) msgs.forEach((m) => { m.classList.add('on'); const v = $('video', m); if (v) play(v); });

  const lenis = window.Lenis ? new Lenis({ duration: 1.15, easing: (x) => 1 - Math.pow(1 - x, 4), smoothWheel: true }) : null;
  const loop = (now) => { if (lenis) lenis.raf(now); frame(lenis ? lenis.scroll : scrollY, now); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  if (lenis) $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => { const tg = $(a.getAttribute('href')); if (tg) { e.preventDefault(); lenis.scrollTo(tg, { offset: -20 }); } }));
  addEventListener('resize', measure);
  addEventListener('load', measure);
})();
