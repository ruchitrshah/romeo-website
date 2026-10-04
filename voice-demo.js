// Romeo voice demo: a scripted, front-end-only replay of the app's voice
// flow. No mic access, no network. A story plays in the feed with the app's
// story bar on top. When the stage scrolls into view, the mic opens: the
// story pauses and blurs under the veil, the bars move, and a scripted
// question "arrives" word by word (fresh words light, settling dark after
// 320ms). It sends on its own → the question lifts off, the story resumes,
// and a new segment grows into the story bar, blinking while the new story
// is made. Scrolling away resets it, so the next visit plays again. A click
// still starts or sends. Works for any number of .gv blocks on a page.
(function () {
  var WORD_MS = 190;        // pace of the scripted "speech"
  var SETTLE_MS = 320;      // VoiceOverlay: a new word stays light this long
  var TICK_MS = 110;        // Waveform: bars retarget every tick
  var AUTO_SEND_MS = 1400;  // pause after the last word before auto-send
  var LISTEN_DELAY_MS = 2600; // let the story play a moment before the mic opens
  var MAKING_MS = 9000;     // the new segment blinks this long, then it's ready
  var MAX_NEW = 3;
  var SHAPE = [0.55, 0.85, 1, 0.85, 0.55];
  var MIN_H = 6, MAX_H = 44;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function init(root) {
    var questions = (root.getAttribute('data-questions') || 'Why did the Fed raise rates, and what does it mean for my mortgage?').split('|');
    var q = 0;
    var words = root.querySelector('.gv__words');
    var bars = Array.prototype.slice.call(root.querySelectorAll('.gv__bar'));
    var mic = root.querySelector('[data-gv="mic"]');
    var left = root.querySelector('[data-gv="left"]');
    var storybar = root.querySelector('.gv__storybar');
    var videos = Array.prototype.slice.call(root.querySelectorAll('.gv__video'));
    var segs = Array.prototype.slice.call(root.querySelectorAll('.gv__seg'));
    var timers = [];
    var waveTimer = null;
    var speaking = false;
    var inView = false;

    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function clearAll() { timers.forEach(clearTimeout); timers = []; stopWave(); }
    function setPhase(p) { root.setAttribute('data-phase', p); }
    function phase() { return root.getAttribute('data-phase'); }

    // ── Story: videos play in turn, the story bar tracks them ──────────────
    var current = 0;
    var raf = null;

    function fills(i, v) { segs[i].firstElementChild.style.transform = 'scaleX(' + v + ')'; }
    function drawBar() {
      var v = videos[current];
      var p = v && v.duration ? Math.min(1, v.currentTime / v.duration) : 0;
      segs.forEach(function (s, i) { fills(i, i < current ? 1 : i === current ? p : 0); });
    }
    function tick() {
      drawBar();
      raf = requestAnimationFrame(tick);
    }
    function wantsPlay() { return inView && phase() !== 'listening' && !reduced; }
    function syncPlayback() {
      var v = videos[current];
      if (!v) return;
      if (wantsPlay()) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
        if (!raf) raf = requestAnimationFrame(tick);
      } else {
        v.pause();
        cancelAnimationFrame(raf);
        raf = null;
        drawBar();
      }
    }
    function show(i) {
      videos[current].pause();
      current = i;
      videos.forEach(function (v, k) { v.classList.toggle('is-on', k === i); });
      videos[i].currentTime = reduced ? 1 : 0; // reduced motion: a still frame
      drawBar();
      syncPlayback();
    }
    videos.forEach(function (v, i) {
      v.addEventListener('ended', function () { show((i + 1) % videos.length); });
    });

    // ── Story bar: a new story being made ─────────────────────────────────
    function addSegment() {
      if (!storybar || storybar.querySelectorAll('.gv__seg--new').length >= MAX_NEW) return;
      var seg = document.createElement('span');
      seg.className = 'gv__seg gv__seg--new';
      storybar.appendChild(seg);
      seg.getBoundingClientRect(); // commit the start state so it grows in
      seg.classList.add('is-in', 'is-making');
      shine();
      // Not in `timers`: the story keeps being made even if you ask again.
      seg._ready = setTimeout(function () { seg.classList.remove('is-making'); }, MAKING_MS);
    }
    // One soft shine across the story as the new one joins the bar.
    var media = root.querySelector('.gv__feed-media');
    function shine() {
      if (!media) return;
      media.classList.remove('is-shine');
      media.getBoundingClientRect(); // restart the sweep if it's still running
      media.classList.add('is-shine');
    }
    if (media) media.addEventListener('animationend', function () { media.classList.remove('is-shine'); });

    function clearSegments() {
      if (!storybar) return;
      Array.prototype.forEach.call(storybar.querySelectorAll('.gv__seg--new'), function (s) {
        clearTimeout(s._ready);
        s.remove();
      });
    }

    // ── Waveform ──────────────────────────────────────────────────────────
    function startWave() {
      if (reduced) return;
      waveTimer = setInterval(function () {
        // Louder while words are arriving, a gentle idle floor otherwise.
        var level = speaking ? 0.6 + Math.random() * 0.4 : 0.3;
        bars.forEach(function (b, i) {
          var h = MIN_H + (MAX_H - MIN_H) * level * SHAPE[i] * (0.45 + Math.random() * 0.55);
          b.style.height = h.toFixed(1) + 'px';
        });
      }, TICK_MS);
    }
    function stopWave() {
      clearInterval(waveTimer);
      waveTimer = null;
      bars.forEach(function (b) { b.style.height = MIN_H + 'px'; });
    }

    // ── Words ─────────────────────────────────────────────────────────────
    function showHint() {
      words.innerHTML = '<span class="gv__hint">Listening…</span>';
    }
    function addWord(w, i) {
      if (i === 0) words.textContent = '';
      var span = document.createElement('span');
      span.className = 'gv__word gv__word--fresh';
      span.textContent = (i ? ' ' : '') + w;
      words.appendChild(span);
      later(function () { span.classList.remove('gv__word--fresh'); }, SETTLE_MS);
    }

    // ── Flow ──────────────────────────────────────────────────────────────
    function listen() {
      clearAll();
      setPhase('listening');
      syncPlayback();
      mic.setAttribute('aria-label', 'Send question');
      left.setAttribute('aria-label', 'Cancel');
      showHint();
      startWave();
      var list = questions[q % questions.length].trim().split(/\s+/);
      q += 1;
      var start = 700; // a beat of "Listening…" before the first word
      later(function () { speaking = true; }, start);
      list.forEach(function (w, i) {
        later(function () { addWord(w, i); }, start + i * WORD_MS);
      });
      var end = start + list.length * WORD_MS;
      later(function () { speaking = false; }, end);
      later(send, end + AUTO_SEND_MS);
    }

    function send() {
      if (phase() !== 'listening') return;
      clearAll();
      setPhase('sending');
      syncPlayback();
      later(function () {
        setPhase('made');
        addSegment();
        restLabels();
      }, reduced ? 300 : 460);
    }

    function cancel() {
      clearAll();
      setPhase('idle');
      restLabels();
      words.textContent = '';
      syncPlayback();
    }

    function restLabels() {
      mic.setAttribute('aria-label', 'Ask by voice');
      left.setAttribute('aria-label', 'All briefings');
    }

    // Leaving the stage: back to the first story, no new segments.
    function reset() {
      clearAll();
      setPhase('idle');
      restLabels();
      words.textContent = '';
      clearSegments();
      show(0);
    }

    mic.addEventListener('click', function () {
      if (phase() === 'listening') send();
      else listen();
    });
    left.addEventListener('click', function () {
      if (phase() === 'listening') cancel();
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && phase() === 'listening') cancel();
    });

    // The story plays while the stage is on screen. The mic opens once each
    // time the stage settles in view. Leave and come back to replay.
    var stage = root.querySelector('.gv__stage') || root;
    var armed = true;
    var armTimer = null;
    function clearArm() {
      if (!armTimer) return;
      clearTimeout(armTimer);
      armTimer = null;
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        var visible = entry.isIntersecting && entry.intersectionRatio >= 0.55;
        var gone = !entry.isIntersecting || entry.intersectionRatio < 0.12;
        inView = entry.isIntersecting;
        if (visible) {
          syncPlayback();
          if (armed && phase() === 'idle' && !armTimer) {
            armTimer = setTimeout(function () {
              armTimer = null;
              if (armed && phase() === 'idle') {
                armed = false;
                listen();
              }
            }, LISTEN_DELAY_MS);
          }
        } else if (gone) {
          clearArm();
          inView = false;
          if (!armed) reset();
          else syncPlayback();
          armed = true;
        }
      }, { threshold: [0, 0.12, 0.55, 0.8] });
      observer.observe(stage);
    }

    reset();
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('.gv'), init);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
