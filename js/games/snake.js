(function() {
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var highscoreEl = document.getElementById('highscore');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayMsg = document.getElementById('overlay-msg');
  var overlayScore = document.getElementById('overlay-score');
  var btnStart = document.getElementById('btn-start');

  var COLS = 20, ROWS = 20, CELL = 20;
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  var input = new InputHandler(canvas);
  input.bindButton('btn-up', 'up');
  input.bindButton('btn-down', 'down');
  input.bindButton('btn-left', 'left');
  input.bindButton('btn-right', 'right');

  var state = {};
  var tickAccum = 0;
  var gameActive = false;
  var paused = false;

  function getTickInterval() {
    return Math.max(80, 200 - state.score * 3);
  }

  function randomFood() {
    var occupied = new Set(state.body.map(function(s) { return s.x + ',' + s.y; }));
    var x, y;
    do {
      x = Math.floor(Math.random() * COLS);
      y = Math.floor(Math.random() * ROWS);
    } while (occupied.has(x + ',' + y));
    return { x: x, y: y };
  }

  function init() {
    var mid = Math.floor(COLS / 2);
    state = {
      body: [
        { x: mid, y: 10 },
        { x: mid - 1, y: 10 },
        { x: mid - 2, y: 10 }
      ],
      dir: { dx: 1, dy: 0 },
      nextDir: { dx: 1, dy: 0 },
      food: null,
      score: 0,
      lives: 0
    };
    state.food = randomFood();
    tickAccum = 0;
    gameActive = false;
    paused = false;
    if (scoreEl) scoreEl.textContent = '0';
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('snake');
    showOverlay('SNAKE', 'PRESS START OR TAP', '');
    render();
  }

  function showOverlay(title, msg, scoreText) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    if (overlayScore) overlayScore.textContent = scoreText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function startGame() {
    init();
    gameActive = true;
    hideOverlay();
    loop.start();
  }

  function gameOver() {
    gameActive = false;
    loop.stop();
    var isHigh = ScoreManager.save('snake', state.score);
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('snake');
    var msg = isHigh ? 'NEW HIGH SCORE!' : 'PRESS START TO PLAY AGAIN';
    showOverlay('GAME OVER', msg, 'SCORE: ' + state.score);
    btnStart.textContent = 'PLAY AGAIN';
  }

  function update(dt) {
    if (!gameActive) return;

    // Input
    var swipe = input.consumeSwipe();
    if (swipe === 'up' || input.consumeAction('up')) tryDir(0, -1);
    else if (swipe === 'down' || input.consumeAction('down')) tryDir(0, 1);
    else if (swipe === 'left' || input.consumeAction('left')) tryDir(-1, 0);
    else if (swipe === 'right' || input.consumeAction('right')) tryDir(1, 0);

    if (input.isDown('ArrowUp') || input.isDown('w') || input.isDown('W')) tryDir(0, -1);
    if (input.isDown('ArrowDown') || input.isDown('s') || input.isDown('S')) tryDir(0, 1);
    if (input.isDown('ArrowLeft') || input.isDown('a') || input.isDown('A')) tryDir(-1, 0);
    if (input.isDown('ArrowRight') || input.isDown('d') || input.isDown('D')) tryDir(1, 0);

    if (input.isDown('p') || input.isDown('P')) {
      if (!paused) { paused = true; loop.pause(); showOverlay('PAUSED', 'PRESS P TO RESUME', ''); }
    }
    if (paused) return;

    // Tick-based movement
    tickAccum += dt;
    if (tickAccum < getTickInterval()) return;
    tickAccum = 0;

    state.dir = state.nextDir;
    var head = state.body[0];
    var newHead = {
      x: (head.x + state.dir.dx + COLS) % COLS,
      y: (head.y + state.dir.dy + ROWS) % ROWS
    };

    // Self-collision
    for (var i = 0; i < state.body.length; i++) {
      if (state.body[i].x === newHead.x && state.body[i].y === newHead.y) {
        gameOver();
        return;
      }
    }

    state.body.unshift(newHead);

    if (newHead.x === state.food.x && newHead.y === state.food.y) {
      state.score++;
      if (scoreEl) scoreEl.textContent = state.score;
      state.food = randomFood();
    } else {
      state.body.pop();
    }
  }

  function tryDir(dx, dy) {
    // Prevent reversing
    if (state.dir.dx === -dx && state.dir.dy === -dy) return;
    state.nextDir = { dx: dx, dy: dy };
  }

  function render() {
    clearCanvas(ctx);

    // Grid lines (subtle)
    ctx.strokeStyle = 'rgba(57,255,20,0.05)';
    ctx.lineWidth = 0.5;
    for (var c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, canvas.height); ctx.stroke();
    }
    for (var r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(canvas.width, r * CELL); ctx.stroke();
    }

    // Food
    if (state.food) {
      ctx.fillStyle = '#ff6b35';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 10;
      ctx.fillRect(state.food.x * CELL + 2, state.food.y * CELL + 2, CELL - 4, CELL - 4);
      ctx.shadowBlur = 0;
    }

    // Snake body
    for (var i = state.body.length - 1; i >= 0; i--) {
      var seg = state.body[i];
      var isHead = i === 0;
      ctx.fillStyle = isHead ? '#ffffff' : '#39ff14';
      ctx.shadowColor = isHead ? '#ffffff' : '#39ff14';
      ctx.shadowBlur = isHead ? 12 : 6;
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.shadowBlur = 0;
  }

  var loop = createGameLoop(update, render);

  btnStart.addEventListener('click', startGame);

  // Resume on P key
  document.addEventListener('keydown', function(e) {
    if ((e.key === 'p' || e.key === 'P') && paused) {
      paused = false;
      hideOverlay();
      loop.resume();
    }
    if ((e.key === 'Enter' || e.key === ' ') && !gameActive) {
      startGame();
    }
  });

  // Page visibility auto-pause
  document.addEventListener('visibilitychange', function() {
    if (document.hidden && gameActive && !paused) {
      paused = true;
      loop.pause();
      showOverlay('PAUSED', 'TAB INACTIVE - CLICK TO RESUME', '');
    }
  });

  init();
})();
