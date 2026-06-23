(function() {
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var highscoreEl = document.getElementById('highscore');
  var levelEl = document.getElementById('level');
  var linesEl = document.getElementById('lines');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayMsg = document.getElementById('overlay-msg');
  var overlayScore = document.getElementById('overlay-score');
  var nextCanvas = document.getElementById('next-canvas');
  var nextCtx = nextCanvas ? nextCanvas.getContext('2d') : null;
  var btnStart = document.getElementById('btn-start');

  var COLS = 10, ROWS = 20, CELL = 30;
  var W = COLS * CELL, H = ROWS * CELL;
  canvas.width = W;
  canvas.height = H;
  if (nextCanvas) { nextCanvas.width = 120; nextCanvas.height = 120; }

  // Tetromino definitions [type][rotation][row] = column bitmask
  var PIECES = {
    I: { color: '#00d4ff', cells: [[[1,1,1,1],[0,0,0,0],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]]] },
    O: { color: '#ffd700', cells: [[[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]]] },
    T: { color: '#a855f7', cells: [[[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,1,0,0],[0,1,1,0],[0,1,0,0],[0,0,0,0]],[[0,0,0,0],[1,1,1,0],[0,1,0,0],[0,0,0,0]],[[0,1,0,0],[1,1,0,0],[0,1,0,0],[0,0,0,0]]] },
    S: { color: '#39ff14', cells: [[[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],[[0,1,0,0],[0,1,1,0],[0,0,1,0],[0,0,0,0]],[[0,0,0,0],[0,1,1,0],[1,1,0,0],[0,0,0,0]],[[1,0,0,0],[1,1,0,0],[0,1,0,0],[0,0,0,0]]] },
    Z: { color: '#ff2255', cells: [[[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,0,1,0],[0,1,1,0],[0,1,0,0],[0,0,0,0]],[[0,0,0,0],[1,1,0,0],[0,1,1,0],[0,0,0,0]],[[0,1,0,0],[1,1,0,0],[1,0,0,0],[0,0,0,0]]] },
    J: { color: '#ff6b35', cells: [[[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,1,1,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]],[[0,0,0,0],[1,1,1,0],[0,0,1,0],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[1,1,0,0],[0,0,0,0]]] },
    L: { color: '#ff9500', cells: [[[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],[[0,1,0,0],[0,1,0,0],[0,1,1,0],[0,0,0,0]],[[0,0,0,0],[1,1,1,0],[1,0,0,0],[0,0,0,0]],[[1,1,0,0],[0,1,0,0],[0,1,0,0],[0,0,0,0]]] }
  };
  var PIECE_KEYS = Object.keys(PIECES);

  var state = {};
  var gameActive = false;
  var paused = false;
  var gravityAccum = 0;
  var input = new InputHandler(canvas);
  input.bindButton('btn-left', 'left');
  input.bindButton('btn-right', 'right');
  input.bindButton('btn-rotate', 'rotate');
  input.bindButton('btn-down', 'down');

  var keyRepeat = {};
  function keyHeld(key, action, delay, interval) {
    if (!keyRepeat[key]) keyRepeat[key] = { time: 0, fired: false };
    var kr = keyRepeat[key];
    if (input.isDown(key)) {
      kr.time += 16;
      if (!kr.fired) { kr.fired = true; kr.time = 0; return true; }
      if (kr.time >= delay) { if ((kr.time - delay) % interval < 16) return true; }
    } else {
      kr.fired = false; kr.time = 0;
    }
    return false;
  }

  var actionRepeat = {};
  function keyHeldAction(action, delay, interval) {
    if (!actionRepeat[action]) actionRepeat[action] = { time: 0, fired: false };
    var kr = actionRepeat[action];
    if (input.isAction(action)) {
      kr.time += 16;
      if (!kr.fired) { kr.fired = true; kr.time = 0; return true; }
      if (kr.time >= delay) { if ((kr.time - delay) % interval < 16) return true; }
    } else {
      kr.fired = false; kr.time = 0;
    }
    return false;
  }

  function randomPiece() {
    var key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
    return { type: key, rot: 0, x: 3, y: 0 };
  }

  function getCells(piece) {
    return PIECES[piece.type].cells[piece.rot];
  }

  function isValid(piece, dx, dy, rot) {
    var cells = PIECES[piece.type].cells[rot !== undefined ? rot : piece.rot];
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (!cells[r][c]) continue;
        var nx = piece.x + c + (dx || 0);
        var ny = piece.y + r + (dy || 0);
        if (nx < 0 || nx >= COLS || ny >= ROWS) return false;
        if (ny >= 0 && state.board[ny][nx]) return false;
      }
    }
    return true;
  }

  function lockPiece() {
    var cells = getCells(state.current);
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (!cells[r][c]) continue;
        var ny = state.current.y + r;
        var nx = state.current.x + c;
        if (ny < 0) { endGame(); return; }
        state.board[ny][nx] = PIECES[state.current.type].color;
      }
    }
    clearLines();
    state.current = state.next;
    state.next = randomPiece();
    if (!isValid(state.current, 0, 0)) { endGame(); return; }
    drawNext();
  }

  function clearLines() {
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (state.board[r].every(function(c) { return c !== 0; })) {
        state.board.splice(r, 1);
        state.board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      var pts = [0, 100, 300, 500, 800][cleared] * state.level;
      state.score += pts;
      state.lines += cleared;
      state.level = Math.floor(state.lines / 10) + 1;
      if (scoreEl) scoreEl.textContent = state.score;
      if (levelEl) levelEl.textContent = state.level;
      if (linesEl) linesEl.textContent = state.lines;
    }
  }

  function getGhostY() {
    var dy = 0;
    while (isValid(state.current, 0, dy + 1)) dy++;
    return state.current.y + dy;
  }

  function hardDrop() {
    while (isValid(state.current, 0, 1)) state.current.y++;
    lockPiece();
    gravityAccum = 0;
  }

  function getGravityInterval() {
    return Math.max(80, 800 - (state.level - 1) * 70);
  }

  function init() {
    state = {
      board: Array.from({ length: ROWS }, function() { return new Array(COLS).fill(0); }),
      current: null,
      next: null,
      score: 0,
      lines: 0,
      level: 1
    };
    state.current = randomPiece();
    state.next = randomPiece();
    gravityAccum = 0;
    gameActive = false;
    paused = false;
    keyRepeat = {};
    if (scoreEl) scoreEl.textContent = '0';
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('tetris');
    if (levelEl) levelEl.textContent = '1';
    if (linesEl) linesEl.textContent = '0';
    showOverlay('TETRIS', 'ARROWS TO MOVE\nUP/BTN TO ROTATE\nPRESS START', '');
    render();
    drawNext();
  }

  function drawNext() {
    if (!nextCtx) return;
    clearCanvas(nextCtx);
    var cells = getCells(state.next);
    var color = PIECES[state.next.type].color;
    var cs = 24;
    var offsetX = (nextCanvas.width - 4 * cs) / 2;
    var offsetY = (nextCanvas.height - 4 * cs) / 2;
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        if (!cells[r][c]) continue;
        nextCtx.fillStyle = color;
        nextCtx.shadowColor = color;
        nextCtx.shadowBlur = 8;
        nextCtx.fillRect(offsetX + c * cs + 1, offsetY + r * cs + 1, cs - 2, cs - 2);
      }
    }
    nextCtx.shadowBlur = 0;
  }

  function showOverlay(title, msg, scoreText) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    if (overlayScore) overlayScore.textContent = scoreText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function startGame() {
    init();
    gameActive = true;
    hideOverlay();
    loop.start();
  }

  function endGame() {
    gameActive = false;
    loop.stop();
    ScoreManager.save('tetris', state.score);
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('tetris');
    showOverlay('GAME OVER', 'PRESS START TO PLAY AGAIN', 'SCORE: ' + state.score);
    btnStart.textContent = 'PLAY AGAIN';
  }

  var lastRotatePress = false;
  var lastHardDrop = false;

  function update(dt) {
    if (!gameActive) return;

    // Swipe for mobile
    var swipe = input.consumeSwipe();
    if (swipe === 'left') { if (isValid(state.current, -1, 0)) state.current.x--; }
    else if (swipe === 'right') { if (isValid(state.current, 1, 0)) state.current.x++; }
    else if (swipe === 'down') { if (isValid(state.current, 0, 1)) state.current.y++; }
    else if (swipe === 'up') { hardDrop(); }
    else if (swipe === 'tap') {
      var newRot = (state.current.rot + 1) % 4;
      if (isValid(state.current, 0, 0, newRot)) state.current.rot = newRot;
      else if (isValid(state.current, 1, 0, newRot)) { state.current.x++; state.current.rot = newRot; }
      else if (isValid(state.current, -1, 0, newRot)) { state.current.x--; state.current.rot = newRot; }
    }

    // Button inputs (with DAS for held buttons)
    if (keyHeldAction('left', 150, 50) && isValid(state.current, -1, 0)) state.current.x--;
    if (keyHeldAction('right', 150, 50) && isValid(state.current, 1, 0)) state.current.x++;
    if (keyHeldAction('down', 100, 50) && isValid(state.current, 0, 1)) state.current.y++;
    var rotatePressed = input.consumeAction('rotate');
    if (rotatePressed) {
      var newRot2 = (state.current.rot + 1) % 4;
      if (isValid(state.current, 0, 0, newRot2)) state.current.rot = newRot2;
    }

    // Keyboard
    if (keyHeld('ArrowLeft', 'left', 150, 50) && isValid(state.current, -1, 0)) state.current.x--;
    if (keyHeld('ArrowRight', 'right', 150, 50) && isValid(state.current, 1, 0)) state.current.x++;
    if (keyHeld('ArrowDown', 'down', 100, 50) && isValid(state.current, 0, 1)) state.current.y++;

    var upNow = input.isDown('ArrowUp') || input.isDown('x') || input.isDown('X');
    if (upNow && !lastRotatePress) {
      var nr = (state.current.rot + 1) % 4;
      if (isValid(state.current, 0, 0, nr)) state.current.rot = nr;
      else if (isValid(state.current, 1, 0, nr)) { state.current.x++; state.current.rot = nr; }
      else if (isValid(state.current, -1, 0, nr)) { state.current.x--; state.current.rot = nr; }
    }
    lastRotatePress = upNow;

    var spaceNow = input.isDown(' ');
    if (spaceNow && !lastHardDrop) hardDrop();
    lastHardDrop = spaceNow;

    // Gravity
    gravityAccum += dt;
    if (gravityAccum >= getGravityInterval()) {
      gravityAccum = 0;
      if (isValid(state.current, 0, 1)) {
        state.current.y++;
      } else {
        lockPiece();
      }
    }
  }

  function render() {
    clearCanvas(ctx);

    // Grid
    ctx.strokeStyle = 'rgba(57,255,20,0.07)';
    ctx.lineWidth = 0.5;
    for (var c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke();
    }
    for (var r2 = 0; r2 <= ROWS; r2++) {
      ctx.beginPath(); ctx.moveTo(0, r2 * CELL); ctx.lineTo(W, r2 * CELL); ctx.stroke();
    }

    // Board
    for (var r = 0; r < ROWS; r++) {
      for (var c2 = 0; c2 < COLS; c2++) {
        if (!state.board[r][c2]) continue;
        ctx.fillStyle = state.board[r][c2];
        ctx.shadowColor = state.board[r][c2];
        ctx.shadowBlur = 4;
        ctx.fillRect(c2 * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
      }
    }
    ctx.shadowBlur = 0;

    // Ghost piece
    if (gameActive && state.current) {
      var ghostY = getGhostY();
      var cells = getCells(state.current);
      var color = PIECES[state.current.type].color;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      for (var gr = 0; gr < 4; gr++) {
        for (var gc = 0; gc < 4; gc++) {
          if (!cells[gr][gc]) continue;
          ctx.fillRect((state.current.x + gc) * CELL + 1, (ghostY + gr) * CELL + 1, CELL - 2, CELL - 2);
        }
      }
      ctx.globalAlpha = 1;

      // Current piece
      ctx.shadowBlur = 8;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      for (var pr = 0; pr < 4; pr++) {
        for (var pc = 0; pc < 4; pc++) {
          if (!cells[pr][pc]) continue;
          ctx.fillRect((state.current.x + pc) * CELL + 1, (state.current.y + pr) * CELL + 1, CELL - 2, CELL - 2);
        }
      }
      ctx.shadowBlur = 0;
    }
  }

  var loop = createGameLoop(update, render);

  btnStart.addEventListener('click', startGame);

  document.addEventListener('keydown', function(e) {
    if ((e.key === 'p' || e.key === 'P') && gameActive) {
      if (!paused) { paused = true; loop.pause(); showOverlay('PAUSED', 'PRESS P TO RESUME', ''); }
      else { paused = false; hideOverlay(); loop.resume(); }
    }
    if (e.key === 'Enter' && !gameActive) startGame();
  });

  document.addEventListener('visibilitychange', function() {
    if (document.hidden && gameActive && !paused) {
      paused = true; loop.pause(); showOverlay('PAUSED', 'TAB INACTIVE', '');
    }
  });

  init();
})();
