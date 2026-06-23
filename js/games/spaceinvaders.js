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

  var PLAYER_W = 36, PLAYER_H = 20, PLAYER_Y = H - 50;
  var PLAYER_SPEED = 4;
  var BULLET_W = 3, BULLET_H = 12;
  var INV_COLS = 11, INV_ROWS = 5;
  var INV_W = 32, INV_H = 24, INV_PAD_X = 6, INV_PAD_Y = 12;
  var SHIELD_COUNT = 4;

  // Invader pixel sprites (8x6 grid for each type)
  var INVADER_SPRITES = [
    // Type 0 (top 2 rows) - small alien
    [[0,0,1,0,0,0,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,0,1,1,1,0,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1]],
    // Type 1 (middle 2 rows) - crab
    [[0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0],[0,1,1,1,1,1,1,1,0],[1,1,0,1,1,1,0,1,1],[1,1,1,1,1,1,1,1,1],[0,1,0,0,0,0,0,1,0]],
    // Type 2 (bottom row) - squid
    [[0,0,0,1,1,0,0,0,0],[0,0,1,1,1,1,0,0,0],[0,1,1,1,1,1,1,0,0],[1,1,0,1,1,0,1,1,0],[1,1,1,1,1,1,1,1,0],[0,0,1,0,0,1,0,0,0]]
  ];

  var INVADER_COLORS = ['#ff2255', '#ff6b35', '#ffd700'];

  var state = {};
  var gameActive = false;
  var paused = false;
  var input = new InputHandler(canvas);
  input.bindButton('btn-left', 'left');
  input.bindButton('btn-right', 'right');
  input.bindButton('btn-fire', 'fire');

  function makeInvaders() {
    var invaders = [];
    var startX = (W - (INV_COLS * (INV_W + INV_PAD_X))) / 2;
    var startY = 80;
    for (var r = 0; r < INV_ROWS; r++) {
      for (var c = 0; c < INV_COLS; c++) {
        var typeIdx = r < 2 ? 0 : (r < 4 ? 1 : 2);
        invaders.push({
          x: startX + c * (INV_W + INV_PAD_X),
          y: startY + r * (INV_H + INV_PAD_Y),
          alive: true,
          type: typeIdx,
          frame: 0
        });
      }
    }
    return invaders;
  }

  function makeShields() {
    var shields = [];
    var gap = W / (SHIELD_COUNT + 1);
    for (var i = 0; i < SHIELD_COUNT; i++) {
      var sx = gap * (i + 1) - 24;
      var sy = H - 120;
      var pixels = [];
      for (var r = 0; r < 8; r++) {
        pixels[r] = [];
        for (var c2 = 0; c2 < 12; c2++) {
          // Arch shape: remove top corners
          var dead = (r < 3 && (c2 < 2 || c2 > 9));
          pixels[r][c2] = !dead;
        }
      }
      shields.push({ x: sx, y: sy, pixels: pixels });
    }
    return shields;
  }

  function init() {
    state = {
      player: { x: W / 2 - PLAYER_W / 2, y: PLAYER_Y },
      bullet: null,
      invaderBullets: [],
      invaders: makeInvaders(),
      shields: makeShields(),
      score: 0,
      lives: 3,
      wave: 1,
      marchDir: 1,
      marchX: 0,
      marchY: 0,
      marchAccum: 0,
      marchInterval: 800,
      shootAccum: 0,
      shootInterval: 1500,
      animFrame: 0,
      animAccum: 0
    };
    gameActive = false;
    paused = false;
    updateUI();
    showOverlay('SPACE INVADERS', 'ARROWS/BUTTONS TO MOVE\nSPACE/FIRE TO SHOOT\nPRESS START', '');
    render();
  }

  function updateUI() {
    if (scoreEl) scoreEl.textContent = state.score;
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('spaceinvaders');
    if (livesEl) livesEl.textContent = '♥ '.repeat(state.lives).trim();
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

  function countAlive() {
    return state.invaders.filter(function(inv) { return inv.alive; }).length;
  }

  function getAliveInvaders() {
    return state.invaders.filter(function(inv) { return inv.alive; });
  }

  var lastFireKey = false;

  function update(dt) {
    if (!gameActive) return;

    // Player movement
    if (input.isDown('ArrowLeft') || input.isDown('a') || input.isDown('A') || input.isAction('left')) {
      state.player.x -= PLAYER_SPEED;
    }
    if (input.isDown('ArrowRight') || input.isDown('d') || input.isDown('D') || input.isAction('right')) {
      state.player.x += PLAYER_SPEED;
    }
    state.player.x = Math.max(0, Math.min(W - PLAYER_W, state.player.x));

    // Fire
    var fireNow = input.isDown(' ') || input.isAction('fire');
    if (fireNow && !lastFireKey && !state.bullet) {
      state.bullet = {
        x: state.player.x + PLAYER_W / 2 - BULLET_W / 2,
        y: state.player.y - BULLET_H,
        vy: -10
      };
    }
    lastFireKey = fireNow;

    // Player bullet movement
    if (state.bullet) {
      state.bullet.y += state.bullet.vy;
      if (state.bullet.y < 0) { state.bullet = null; }

      if (state.bullet) {
        // Check shield hit
        for (var si = 0; si < state.shields.length; si++) {
          var sh = state.shields[si];
          if (hitShield(state.bullet, sh)) { state.bullet = null; break; }
        }
      }

      if (state.bullet) {
        // Check invader hit
        for (var i = 0; i < state.invaders.length; i++) {
          var inv = state.invaders[i];
          if (!inv.alive) continue;
          if (state.bullet.x + BULLET_W > inv.x && state.bullet.x < inv.x + INV_W &&
              state.bullet.y < inv.y + INV_H && state.bullet.y + BULLET_H > inv.y) {
            inv.alive = false;
            state.bullet = null;
            var pts = inv.type === 0 ? 30 : (inv.type === 1 ? 20 : 10);
            state.score += pts;
            if (scoreEl) scoreEl.textContent = state.score;
            ScoreManager.save('spaceinvaders', state.score);
            if (highscoreEl) highscoreEl.textContent = ScoreManager.load('spaceinvaders');
            break;
          }
        }
      }
    }

    // Win check
    if (countAlive() === 0) {
      nextWave();
      return;
    }

    // Invader march
    var alive = countAlive();
    var speedFactor = Math.max(0.2, alive / (INV_COLS * INV_ROWS));
    var interval = state.marchInterval * speedFactor;
    state.marchAccum += dt;
    if (state.marchAccum >= interval) {
      state.marchAccum = 0;
      state.animFrame = 1 - state.animFrame;

      // Check bounds before moving
      var aliveInvaders = getAliveInvaders();
      var minX = Math.min.apply(null, aliveInvaders.map(function(inv) { return inv.x; }));
      var maxX = Math.max.apply(null, aliveInvaders.map(function(inv) { return inv.x + INV_W; }));
      var maxY = Math.max.apply(null, aliveInvaders.map(function(inv) { return inv.y + INV_H; }));

      if (maxY >= PLAYER_Y - 10) { gameOver('INVADERS LANDED!'); return; }

      var needDrop = false;
      if (state.marchDir === 1 && maxX + 8 > W) needDrop = true;
      if (state.marchDir === -1 && minX - 8 < 0) needDrop = true;

      if (needDrop) {
        state.marchDir = -state.marchDir;
        state.invaders.forEach(function(inv) { if (inv.alive) inv.y += 16; });
      } else {
        var step = 8 * state.marchDir;
        state.invaders.forEach(function(inv) { if (inv.alive) inv.x += step; });
      }
    }

    // Invader shoot
    state.shootAccum += dt;
    if (state.shootAccum >= state.shootInterval) {
      state.shootAccum = 0;
      var aliveInvs = getAliveInvaders();
      if (aliveInvs.length > 0) {
        var shooter = aliveInvs[Math.floor(Math.random() * aliveInvs.length)];
        state.invaderBullets.push({
          x: shooter.x + INV_W / 2,
          y: shooter.y + INV_H,
          vy: 4 + state.wave * 0.5
        });
      }
      state.shootInterval = Math.max(500, 1500 - state.wave * 100);
    }

    // Invader bullets
    for (var bi = state.invaderBullets.length - 1; bi >= 0; bi--) {
      var b = state.invaderBullets[bi];
      b.y += b.vy;

      if (b.y > H) { state.invaderBullets.splice(bi, 1); continue; }

      // Shield hit
      var hitSh = false;
      for (var si2 = 0; si2 < state.shields.length; si2++) {
        if (hitShield(b, state.shields[si2])) { state.invaderBullets.splice(bi, 1); hitSh = true; break; }
      }
      if (hitSh) continue;

      // Player hit
      if (b.x > state.player.x && b.x < state.player.x + PLAYER_W &&
          b.y > state.player.y && b.y < state.player.y + PLAYER_H) {
        state.invaderBullets.splice(bi, 1);
        state.lives--;
        updateUI();
        if (state.lives <= 0) { gameOver('GAME OVER'); return; }
      }
    }
  }

  function hitShield(bullet, shield) {
    var bx = Math.floor((bullet.x - shield.x) / 4);
    var by = Math.floor((bullet.y - shield.y) / 4);
    if (bx < 0 || bx >= 12 || by < 0 || by >= 8) return false;
    if (shield.pixels[by] && shield.pixels[by][bx]) {
      // Damage surrounding area
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var py = by + dy, px2 = bx + dx;
          if (py >= 0 && py < 8 && px2 >= 0 && px2 < 12) {
            if (shield.pixels[py]) shield.pixels[py][px2] = false;
          }
        }
      }
      return true;
    }
    return false;
  }

  function nextWave() {
    state.wave++;
    state.invaders = makeInvaders();
    state.invaderBullets = [];
    state.bullet = null;
    state.marchInterval = Math.max(300, 800 - state.wave * 50);
    state.shootInterval = Math.max(500, 1500 - state.wave * 100);
    showOverlay('WAVE ' + state.wave, 'INCOMING!', 'SCORE: ' + state.score);
    gameActive = false;
    loop.stop();
    setTimeout(function() {
      hideOverlay();
      gameActive = true;
      loop.start();
    }, 2000);
  }

  function gameOver(msg) {
    gameActive = false;
    loop.stop();
    ScoreManager.save('spaceinvaders', state.score);
    if (highscoreEl) highscoreEl.textContent = ScoreManager.load('spaceinvaders');
    showOverlay(msg || 'GAME OVER', 'PRESS START TO PLAY AGAIN', 'SCORE: ' + state.score);
    btnStart.textContent = 'PLAY AGAIN';
  }

  function drawInvader(inv) {
    var sprite = INVADER_SPRITES[inv.type];
    var color = INVADER_COLORS[inv.type];
    var pw = INV_W / 9;
    var ph = INV_H / 6;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 9; c++) {
        if (sprite[r][c]) {
          ctx.fillRect(inv.x + c * pw, inv.y + r * ph, pw - 0.5, ph - 0.5);
        }
      }
    }
    ctx.shadowBlur = 0;
  }

  function drawPlayer() {
    var p = state.player;
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 10;
    // Body
    ctx.fillRect(p.x + 4, p.y + 8, PLAYER_W - 8, PLAYER_H - 8);
    // Cannon
    ctx.fillRect(p.x + PLAYER_W / 2 - 3, p.y, 6, 10);
    // Wings
    ctx.fillRect(p.x, p.y + 12, 10, 8);
    ctx.fillRect(p.x + PLAYER_W - 10, p.y + 12, 10, 8);
    ctx.shadowBlur = 0;
  }

  function render() {
    clearCanvas(ctx);

    // Ground line
    ctx.strokeStyle = 'rgba(57,255,20,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, PLAYER_Y + PLAYER_H + 5);
    ctx.lineTo(W, PLAYER_Y + PLAYER_H + 5);
    ctx.stroke();

    // Invaders
    for (var i = 0; i < state.invaders.length; i++) {
      if (state.invaders[i].alive) drawInvader(state.invaders[i]);
    }

    // Shields
    for (var si = 0; si < state.shields.length; si++) {
      var sh = state.shields[si];
      ctx.fillStyle = '#39ff14';
      ctx.shadowColor = '#39ff14';
      ctx.shadowBlur = 3;
      for (var r = 0; r < 8; r++) {
        for (var c = 0; c < 12; c++) {
          if (sh.pixels[r] && sh.pixels[r][c]) {
            ctx.fillRect(sh.x + c * 4, sh.y + r * 4, 4, 4);
          }
        }
      }
    }
    ctx.shadowBlur = 0;

    // Player
    drawPlayer();

    // Player bullet
    if (state.bullet) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fillRect(state.bullet.x, state.bullet.y, BULLET_W, BULLET_H);
      ctx.shadowBlur = 0;
    }

    // Invader bullets
    for (var bi = 0; bi < state.invaderBullets.length; bi++) {
      var b = state.invaderBullets[bi];
      ctx.fillStyle = '#ff6b35';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 6;
      ctx.fillRect(b.x - 2, b.y, 4, 10);
      ctx.shadowBlur = 0;
    }

    // Score in canvas
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = 'rgba(57,255,20,0.3)';
    ctx.textAlign = 'left';
    ctx.fillText('WAVE ' + state.wave, 8, 20);
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
