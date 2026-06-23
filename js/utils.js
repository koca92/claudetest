/* Shared utilities for Retro Arcade */

/* ── InputHandler ── */
function InputHandler(canvas) {
  this._keys = new Set();
  this._swipe = null;
  this._touchStart = null;
  this._actions = {};

  var self = this;

  document.addEventListener('keydown', function(e) {
    self._keys.add(e.key);
    // Prevent page scroll for game keys
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','w','a','s','d','W','A','S','D'].includes(e.key)) {
      e.preventDefault();
    }
  });

  document.addEventListener('keyup', function(e) {
    self._keys.delete(e.key);
  });

  if (canvas) {
    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      var t = e.touches[0];
      self._touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
    }, { passive: false });

    canvas.addEventListener('touchend', function(e) {
      e.preventDefault();
      if (!self._touchStart) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - self._touchStart.x;
      var dy = t.clientY - self._touchStart.y;
      var dt = Date.now() - self._touchStart.time;
      var dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < 10 && dt < 200) {
        self._swipe = 'tap';
      } else if (dist > 30) {
        if (Math.abs(dx) > Math.abs(dy)) {
          self._swipe = dx > 0 ? 'right' : 'left';
        } else {
          self._swipe = dy > 0 ? 'down' : 'up';
        }
      }
      self._touchStart = null;
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
    }, { passive: false });
  }
}

InputHandler.prototype.isDown = function(key) {
  return this._keys.has(key);
};

InputHandler.prototype.consumeSwipe = function() {
  var s = this._swipe;
  this._swipe = null;
  return s;
};

InputHandler.prototype.bindButton = function(elementId, action) {
  var self = this;
  var el = document.getElementById(elementId);
  if (!el) return;
  el.addEventListener('pointerdown', function(e) {
    e.preventDefault();
    self._actions[action] = true;
  });
  el.addEventListener('pointerup', function() {
    self._actions[action] = false;
  });
  el.addEventListener('pointercancel', function() {
    self._actions[action] = false;
  });
  el.addEventListener('pointerleave', function() {
    self._actions[action] = false;
  });
};

InputHandler.prototype.isAction = function(action) {
  return !!this._actions[action];
};

InputHandler.prototype.consumeAction = function(action) {
  var v = this._actions[action];
  this._actions[action] = false;
  return v;
};

/* ── ScoreManager ── */
var ScoreManager = {
  save: function(gameName, score) {
    try {
      var key = 'retro_' + gameName + '_highscore';
      var current = parseInt(localStorage.getItem(key) || '0', 10);
      if (score > current) {
        localStorage.setItem(key, String(score));
        return true;
      }
    } catch(e) {}
    return false;
  },
  load: function(gameName) {
    try {
      return parseInt(localStorage.getItem('retro_' + gameName + '_highscore') || '0', 10);
    } catch(e) { return 0; }
  }
};

/* ── Game Loop ── */
function createGameLoop(updateFn, renderFn) {
  var running = false;
  var paused = false;
  var lastTime = null;
  var rafId = null;

  function tick(timestamp) {
    if (!running) return;
    if (!lastTime) lastTime = timestamp;
    var dt = Math.min(timestamp - lastTime, 100); // cap at 100ms to avoid spiral
    lastTime = timestamp;
    if (!paused) {
      updateFn(dt);
      renderFn();
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    start: function() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = null;
      rafId = requestAnimationFrame(tick);
    },
    stop: function() {
      running = false;
      paused = false;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      lastTime = null;
    },
    pause: function() { paused = true; },
    resume: function() {
      paused = false;
      lastTime = null;
    },
    isPaused: function() { return paused; },
    isRunning: function() { return running; }
  };
}

/* ── Canvas utilities ── */
function clearCanvas(ctx, color) {
  ctx.fillStyle = color || '#0a0a0a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawPixelText(ctx, text, x, y, size, color) {
  ctx.font = size + 'px "Press Start 2P", monospace';
  ctx.fillStyle = color || '#39ff14';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/* ── Touch paddle helper for Breakout/Pong ── */
function getTouchCanvasX(canvas, touchEvent) {
  var rect = canvas.getBoundingClientRect();
  var t = touchEvent.touches[0] || touchEvent.changedTouches[0];
  var scaleX = canvas.width / rect.width;
  return (t.clientX - rect.left) * scaleX;
}

function getTouchCanvasY(canvas, touchEvent) {
  var rect = canvas.getBoundingClientRect();
  var t = touchEvent.touches[0] || touchEvent.changedTouches[0];
  var scaleY = canvas.height / rect.height;
  return (t.clientY - rect.top) * scaleY;
}
