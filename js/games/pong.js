(function() {
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlayMsg = document.getElementById('overlay-msg');
  var overlayScore = document.getElementById('overlay-score');
  var btnStart = document.getElementById('btn-start');

  var W = 600, H = 400;
  canvas.width = W;
  canvas.height = H;

  var PAD_W = 12, PAD_H = 80, PAD_SPEED = 5;
  var BALL_SIZE = 10;
  var WIN_SCORE = 7;

  var state = {};
  var gameActive = false;
  var paused = false;
  var input = new InputHandler(canvas);

  function resetBall(dir) {
    var angle = (Math.random() * 0.5 - 0.25) + (dir > 0 ? 0 : Math.PI);
    var speed = 5;
    state.ball = {
      x: W / 2, y: H / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed
    };
  }

  function init() {
    state = {
      player: { x: 20, y: H / 2 - PAD_H / 2, score: 0 },
      ai: { x: W - 20 - PAD_W, y: H / 2 - PAD_H / 2, score: 0 },
      ball: null,
      rally: 0
    };
    resetBall(1);
    gameActive = false;
    paused = false;
    updateScoreUI();
    showOverlay('PONG', 'W/S OR DRAG LEFT SIDE\nPRESS START', '');
    render();
  }

  function updateScoreUI() {
    if (scoreEl) scoreEl.textContent = state.player.score + ' - ' + state.ai.score;
  }

  function showOverlay(title, msg, scoreText) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    if (overlayScore) overlayScore.textContent = scoreText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() { overlay.classList.add('hidden'); }

  function startGame() {
    gameActive = true;
    hideOverlay();
    loop.start();
  }

  // Touch tracking for player paddle
  var touchY = null;
  canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    var t = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    if ((t.clientX - rect.left) < rect.width / 2) {
      touchY = getTouchCanvasY(canvas, e);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    var t = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    if ((t.clientX - rect.left) < rect.width / 2) {
      touchY = getTouchCanvasY(canvas, e);
    }
  }, { passive: false });

  canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    touchY = null;
  }, { passive: false });

  function update(dt) {
    if (!gameActive) return;

    // Player paddle
    if (touchY !== null) {
      state.player.y = touchY - PAD_H / 2;
    } else {
      if (input.isDown('ArrowUp') || input.isDown('w') || input.isDown('W')) state.player.y -= PAD_SPEED;
      if (input.isDown('ArrowDown') || input.isDown('s') || input.isDown('S')) state.player.y += PAD_SPEED;
    }
    state.player.y = Math.max(0, Math.min(H - PAD_H, state.player.y));

    // AI paddle (imperfect tracking)
    var aiCenter = state.ai.y + PAD_H / 2;
    var ballY = state.ball.y;
    var aiSpeed = 3 + Math.min(state.rally * 0.1, 2);
    if (Math.abs(aiCenter - ballY) > 5) {
      state.ai.y += (ballY > aiCenter ? 1 : -1) * aiSpeed;
    }
    state.ai.y = Math.max(0, Math.min(H - PAD_H, state.ai.y));

    // Ball movement
    var b = state.ball;
    b.x += b.vx;
    b.y += b.vy;

    // Top/bottom bounce
    if (b.y - BALL_SIZE / 2 <= 0) { b.y = BALL_SIZE / 2; b.vy = Math.abs(b.vy); }
    if (b.y + BALL_SIZE / 2 >= H) { b.y = H - BALL_SIZE / 2; b.vy = -Math.abs(b.vy); }

    // Paddle collisions
    var p = state.player;
    if (b.vx < 0 && b.x - BALL_SIZE / 2 <= p.x + PAD_W &&
        b.x + BALL_SIZE / 2 >= p.x &&
        b.y >= p.y && b.y <= p.y + PAD_H) {
      b.x = p.x + PAD_W + BALL_SIZE / 2;
      var hit = (b.y - (p.y + PAD_H / 2)) / (PAD_H / 2);
      var speed = Math.min(Math.sqrt(b.vx * b.vx + b.vy * b.vy) + 0.2, 12);
      var angle = hit * 0.8;
      b.vx = Math.cos(angle) * speed;
      b.vy = Math.sin(angle) * speed;
      state.rally++;
    }

    var ai = state.ai;
    if (b.vx > 0 && b.x + BALL_SIZE / 2 >= ai.x &&
        b.x - BALL_SIZE / 2 <= ai.x + PAD_W &&
        b.y >= ai.y && b.y <= ai.y + PAD_H) {
      b.x = ai.x - BALL_SIZE / 2;
      var hit2 = (b.y - (ai.y + PAD_H / 2)) / (PAD_H / 2);
      var speed2 = Math.min(Math.sqrt(b.vx * b.vx + b.vy * b.vy) + 0.2, 12);
      var angle2 = Math.PI - hit2 * 0.8;
      b.vx = Math.cos(angle2) * speed2;
      b.vy = Math.sin(angle2) * speed2;
      state.rally++;
    }

    // Scoring
    if (b.x < 0) {
      state.ai.score++;
      state.rally = 0;
      updateScoreUI();
      if (state.ai.score >= WIN_SCORE) { endGame('CPU WINS!'); return; }
      resetBall(1);
    }
    if (b.x > W) {
      state.player.score++;
      state.rally = 0;
      updateScoreUI();
      if (state.player.score >= WIN_SCORE) { endGame('YOU WIN!'); return; }
      resetBall(-1);
    }
  }

  function endGame(title) {
    gameActive = false;
    loop.stop();
    var scoreText = 'FINAL: ' + state.player.score + ' - ' + state.ai.score;
    showOverlay(title, 'PRESS START TO PLAY AGAIN', scoreText);
    btnStart.textContent = 'PLAY AGAIN';
  }

  function render() {
    clearCanvas(ctx);

    // Center line
    ctx.strokeStyle = 'rgba(57,255,20,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Scores on canvas
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(57,255,20,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText(state.player.score, W / 4, 40);
    ctx.fillText(state.ai.score, W * 3 / 4, 40);

    // Player paddle
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.fillRect(state.player.x, state.player.y, PAD_W, PAD_H);

    // AI paddle
    ctx.fillStyle = '#ff2255';
    ctx.shadowColor = '#ff2255';
    ctx.shadowBlur = 12;
    ctx.fillRect(state.ai.x, state.ai.y, PAD_W, PAD_H);
    ctx.shadowBlur = 0;

    // Ball
    var b = state.ball;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 15;
    ctx.fillRect(b.x - BALL_SIZE / 2, b.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
    ctx.shadowBlur = 0;
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
