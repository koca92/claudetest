(function() {
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var highscoreEl = document.getElementById('highscore');
  var livesEl = document.getElementById('lives');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayMsg = document.getElementById('overlay-msg');
  var overlayScore = document.getElementById('overlay-score');
  var btnStart = document.getElementById('btn-start');

  var W = 480, H = 600;
  canvas.width = W;
  canvas.height = H;

  var PADDLE_W = 90, PADDLE_H = 12, PADDLE_Y = H - 40;
  var BALL_R = 7;
  var BRICK_ROWS = 7, BRICK_COLS = 10;
  var BRICK_W = 44, BRICK_H = 18, BRICK_PAD = 4;
  var BRICK_OFFSET_X = (W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;
  var BRICK_OFFSET_Y = 60;

  var COLORS = ['#ff2255','#ff6b35','#ffd700','#39ff14','#00d4ff','#a855f7','#ff69b4'];

  var state = {};
  var gameActive = false;
  var paused = false;
  var mousePaddleX = null;

  var input = new InputHandler(canvas);

  function makeBricks() {
    var bricks = [];
    for (var r = 0; r < BRICK_ROWS; r++) {
      for (var c = 0; c < BRICK_COLS; c++) {
        bricks.push({
          x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_PAD),
          y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_PAD),
          alive: true,
          color: COLORS[r % COLORS.length],
          hits: r < 2 ? 2 : 1
        });
      }
    }
    return bricks;
  }

  function init() {
    state = {
      paddle: { x: W / 2 - PADDLE_W / 2, y: PADDLE_Y },
      ball: { x: W / 2, y: PADDLE_Y - 20, vx: 3.5 * (Math.random() > 0.5 ? 1 : -1), vy: -4 },
      bricks: makeBricks(),
      score: 0,
      lives: 3,
      launched: false
    };
    gameActive = false;
    paused = false;
    mousePaddleX = null;
    updateScoreUI();
    showOverlay('BREAKOUT', 'MOVE PADDLE TO AIM\nPRESS START', '');
    render();
  }

  function updateScoreUI() {
    if (scoreEl) scoreEl.textContent = state.score;
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('breakout');
    if (livesEl) livesEl.textContent = '♥ '.repeat(state.lives).trim();
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

  function loseLife() {
    state.lives--;
    updateScoreUI();
    if (state.lives <= 0) {
      gameOver();
    } else {
      resetBall();
    }
  }

  function resetBall() {
    state.ball = { x: W / 2, y: PADDLE_Y - 20, vx: 3.5 * (Math.random() > 0.5 ? 1 : -1), vy: -4 };
    state.launched = false;
    state.paddle.x = W / 2 - PADDLE_W / 2;
    mousePaddleX = null;
  }

  function gameOver() {
    gameActive = false;
    loop.stop();
    ScoreManager.save('breakout', state.score);
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('breakout');
    showOverlay('GAME OVER', 'PRESS START TO PLAY AGAIN', 'SCORE: ' + state.score);
    btnStart.textContent = 'PLAY AGAIN';
  }

  function winGame() {
    gameActive = false;
    loop.stop();
    ScoreManager.save('breakout', state.score);
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('breakout');
    showOverlay('YOU WIN!', 'ALL BRICKS CLEARED!', 'SCORE: ' + state.score);
    btnStart.textContent = 'PLAY AGAIN';
  }

  canvas.addEventListener('mousemove', function(e) {
    var rect = canvas.getBoundingClientRect();
    var scaleX = W / rect.width;
    mousePaddleX = (e.clientX - rect.left) * scaleX - PADDLE_W / 2;
  });

  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    var x = getTouchCanvasX(canvas, e) - PADDLE_W / 2;
    state.paddle.x = Math.max(0, Math.min(W - PADDLE_W, x));
  }, { passive: false });

  function update(dt) {
    if (!gameActive) return;

    // Paddle keyboard
    var speed = 7;
    if (input.isDown('ArrowLeft') || input.isDown('a') || input.isDown('A')) state.paddle.x -= speed;
    if (input.isDown('ArrowRight') || input.isDown('d') || input.isDown('D')) state.paddle.x += speed;
    if (mousePaddleX !== null) state.paddle.x = mousePaddleX;
    state.paddle.x = Math.max(0, Math.min(W - PADDLE_W, state.paddle.x));

    // Ball follows paddle until launched
    if (!state.launched) {
      state.ball.x = state.paddle.x + PADDLE_W / 2;
      state.ball.y = PADDLE_Y - BALL_R - 2;
      if (input.isDown(' ') || input.isDown('ArrowUp')) {
        state.launched = true;
      }
      return;
    }

    var b = state.ball;
    b.x += b.vx;
    b.y += b.vy;

    // Wall bounce
    if (b.x - BALL_R <= 0) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
    if (b.x + BALL_R >= W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
    if (b.y - BALL_R <= 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

    // Floor
    if (b.y + BALL_R >= H) {
      loseLife();
      return;
    }

    // Paddle collision
    var p = state.paddle;
    if (b.vy > 0 &&
        b.y + BALL_R >= p.y &&
        b.y - BALL_R <= p.y + PADDLE_H &&
        b.x >= p.x && b.x <= p.x + PADDLE_W) {
      var hitPos = (b.x - (p.x + PADDLE_W / 2)) / (PADDLE_W / 2);
      b.vx = hitPos * 5;
      if (Math.abs(b.vx) < 0.5) b.vx = b.vx >= 0 ? 0.5 : -0.5;
      b.vy = -Math.abs(b.vy);
      var speed2 = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      var maxSpeed = 7;
      if (speed2 > maxSpeed) { b.vx = b.vx / speed2 * maxSpeed; b.vy = b.vy / speed2 * maxSpeed; }
      b.y = p.y - BALL_R - 1;
    }

    // Brick collision
    var allDead = true;
    for (var i = 0; i < state.bricks.length; i++) {
      var br = state.bricks[i];
      if (!br.alive) continue;
      allDead = false;
      if (b.x + BALL_R > br.x && b.x - BALL_R < br.x + BRICK_W &&
          b.y + BALL_R > br.y && b.y - BALL_R < br.y + BRICK_H) {
        br.hits--;
        if (br.hits <= 0) {
          br.alive = false;
          state.score += 10;
        } else {
          state.score += 5;
          br.color = '#ffffff';
        }
        if (scoreEl) scoreEl.textContent = state.score;

        // Determine which side was hit
        var overlapL = (b.x + BALL_R) - br.x;
        var overlapR = (br.x + BRICK_W) - (b.x - BALL_R);
        var overlapT = (b.y + BALL_R) - br.y;
        var overlapB = (br.y + BRICK_H) - (b.y - BALL_R);
        var minOvX = Math.min(overlapL, overlapR);
        var minOvY = Math.min(overlapT, overlapB);
        if (minOvX < minOvY) b.vx = -b.vx;
        else b.vy = -b.vy;
        if (state.bricks.every(function(b2) { return !b2.alive; })) { winGame(); return; }
        break;
      }
    }
  }

  function render() {
    clearCanvas(ctx);

    // Bricks
    for (var i = 0; i < state.bricks.length; i++) {
      var br = state.bricks[i];
      if (!br.alive) continue;
      ctx.fillStyle = br.color;
      ctx.shadowColor = br.color;
      ctx.shadowBlur = 6;
      ctx.fillRect(br.x, br.y, BRICK_W, BRICK_H);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(br.x, br.y, BRICK_W, BRICK_H);
    }
    ctx.shadowBlur = 0;

    // Paddle
    var p = state.paddle;
    ctx.fillStyle = '#00d4ff';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(p.x, p.y, PADDLE_W, PADDLE_H);
    ctx.shadowBlur = 0;

    // Ball
    var b = state.ball;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Launch hint
    if (!state.launched && gameActive) {
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE / TAP TO LAUNCH', W / 2, PADDLE_Y - 30);
    }
  }

  var loop = createGameLoop(update, render);

  btnStart.addEventListener('click', startGame);

  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (!state.launched && gameActive) state.launched = true;
  }, { passive: false });

  document.addEventListener('keydown', function(e) {
    if ((e.key === 'p' || e.key === 'P') && gameActive) {
      if (!paused) { paused = true; loop.pause(); showOverlay('PAUSED', 'PRESS P TO RESUME', ''); }
      else { paused = false; hideOverlay(); loop.resume(); }
    }
    if ((e.key === 'Enter') && !gameActive) startGame();
  });

  document.addEventListener('visibilitychange', function() {
    if (document.hidden && gameActive && !paused) {
      paused = true; loop.pause(); showOverlay('PAUSED', 'TAB INACTIVE', '');
    }
  });

  init();
})();
