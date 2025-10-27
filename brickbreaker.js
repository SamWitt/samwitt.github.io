(function () {
  const NOTE_FREQUENCIES = [
    196.0, // G3
    220.0, // A3
    246.94, // B3
    261.63, // C4
    293.66, // D4
    329.63, // E4
    349.23, // F4
    392.0, // G4
    440.0, // A4
    523.25, // C5
  ];

  const PASTEL_PALETTE = [
    '#ffd1dc',
    '#c3f0ca',
    '#ffec99',
    '#b5d8ff',
    '#fbcffc',
    '#f8d8ff',
    '#c8f7f4',
  ];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  class BrickBreakerGame {
    constructor(canvas, callbacks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.callbacks = callbacks;
      this.pixelRatio = window.devicePixelRatio || 1;
      this.width = canvas.width;
      this.height = canvas.height;
      this.lastTimestamp = 0;
      this.running = true;
      this.message = '';
      this.score = 0;
      this.level = 1;
      this.lives = 3;
      this.baseBallSpeed = 360;
      this.layout = null;
      this.paddle = {
        width: 120,
        height: 16,
        x: 0,
        y: 0,
        speed: 540,
        moveDir: 0,
      };
      this.ball = {
        radius: 8,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
      };
      this.bricks = [];
      this.particles = [];
      this.audioContext = null;
      this.isPointerActive = false;
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas);
      }
      window.addEventListener('resize', () => this.resize());
      this.setupInput();
      this.resize(true);
      this.reset(true);
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    setupInput() {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
          this.paddle.moveDir = -1;
          this.resumeAudio();
        } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
          this.paddle.moveDir = 1;
          this.resumeAudio();
        } else if (event.key === ' ' && !this.running) {
          this.reset(true);
        }
      });

      document.addEventListener('keyup', (event) => {
        if (
          event.key === 'ArrowLeft' ||
          event.key === 'ArrowRight' ||
          event.key === 'a' ||
          event.key === 'A' ||
          event.key === 'd' ||
          event.key === 'D'
        ) {
          this.paddle.moveDir = 0;
        }
      });

      const handlePointerMove = (event) => {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        this.setPaddleCenter(x);
      };

      this.canvas.addEventListener('pointerdown', (event) => {
        this.isPointerActive = true;
        this.resumeAudio();
        this.canvas.setPointerCapture?.(event.pointerId);
        handlePointerMove(event);
      });

      this.canvas.addEventListener('pointermove', (event) => {
        if (!this.isPointerActive) return;
        handlePointerMove(event);
      });

      const releasePointer = () => {
        this.isPointerActive = false;
      };

      this.canvas.addEventListener('pointerup', releasePointer);
      this.canvas.addEventListener('pointercancel', releasePointer);
      this.canvas.addEventListener('pointerleave', releasePointer);
    }

    computeLayout() {
      const rows = clamp(3 + this.level, 3, 8);
      const columns = clamp(8 + Math.floor(this.level / 2), 8, 11);
      const gap = clamp(this.width * 0.015, 8, 18);
      const topOffset = clamp(this.height * 0.12, 60, 110);
      const brickHeight = clamp(this.height * 0.05, 20, 32);
      const totalGap = gap * (columns + 1);
      const availableWidth = Math.max(140, this.width - totalGap);
      const brickWidth = availableWidth / columns;
      return { rows, columns, gap, topOffset, brickHeight, brickWidth };
    }

    updateBrickPositions() {
      if (!this.layout || !this.bricks.length) return;
      const { gap, topOffset, brickHeight, brickWidth } = this.layout;
      for (const brick of this.bricks) {
        brick.width = brickWidth;
        brick.height = brickHeight;
        brick.x = gap + brick.col * (brickWidth + gap);
        brick.y = topOffset + brick.row * (brickHeight + gap);
      }
    }

    buildLevel() {
      this.layout = this.computeLayout();
      this.bricks = [];
      for (let row = 0; row < this.layout.rows; row += 1) {
        for (let col = 0; col < this.layout.columns; col += 1) {
          this.bricks.push({
            row,
            col,
            x: 0,
            y: 0,
            width: this.layout.brickWidth,
            height: this.layout.brickHeight,
            color: PASTEL_PALETTE[(row + col) % PASTEL_PALETTE.length],
            alive: true,
          });
        }
      }
      this.updateBrickPositions();
    }

    resize(force = false) {
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (!force && Math.abs(this.pixelRatio - dpr) < 0.01 && Math.abs(this.width - rect.width) < 0.5 && Math.abs(this.height - rect.height) < 0.5) {
        return;
      }
      this.pixelRatio = dpr;
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.width = rect.width;
      this.height = rect.height;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
      this.paddle.width = clamp(this.width * 0.2, 90, 160);
      this.paddle.height = clamp(this.height * 0.035, 12, 24);
      this.paddle.y = this.height - this.paddle.height * 2.6;
      this.ball.radius = clamp(this.width * 0.012, 6, 12);
      this.layout = this.computeLayout();
      this.updateBrickPositions();
      if (!this.running || this.lastTimestamp === 0) {
        this.centerPaddle();
        this.placeBallOnPaddle();
      }
    }

    reset(full = false) {
      if (full) {
        this.score = 0;
        this.level = 1;
        this.lives = 3;
      }
      this.running = true;
      this.message = '';
      this.centerPaddle();
      this.placeBallOnPaddle();
      this.buildLevel();
      this.notifyHud();
    }

    centerPaddle() {
      this.paddle.x = (this.width - this.paddle.width) / 2;
    }

    placeBallOnPaddle() {
      this.ball.x = this.paddle.x + this.paddle.width / 2;
      this.ball.y = this.paddle.y - this.ball.radius - 2;
      const angle = (Math.random() * 0.6 + 0.2) * Math.PI; // between ~36° and ~108°
      const speed = this.baseBallSpeed + (this.level - 1) * 40;
      this.ball.vx = Math.cos(angle) * speed;
      this.ball.vy = -Math.abs(Math.sin(angle) * speed);
    }

    notifyHud() {
      if (typeof this.callbacks.onScoreChange === 'function') {
        this.callbacks.onScoreChange(this.score);
      }
      if (typeof this.callbacks.onLivesChange === 'function') {
        this.callbacks.onLivesChange(this.lives);
      }
      if (typeof this.callbacks.onLevelChange === 'function') {
        this.callbacks.onLevelChange(this.level);
      }
      if (typeof this.callbacks.onMessageChange === 'function') {
        this.callbacks.onMessageChange(this.message);
      }
    }

    setPaddleCenter(x) {
      const newX = clamp(x - this.paddle.width / 2, 0, this.width - this.paddle.width);
      this.paddle.x = newX;
    }

    loop(timestamp) {
      const delta = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
      this.lastTimestamp = timestamp;
      if (this.running) {
        this.update(delta);
      }
      this.draw();
      requestAnimationFrame(this.loop);
    }

    update(delta) {
      if (delta > 0.04) {
        return;
      }

      if (this.paddle.moveDir !== 0 && !this.isPointerActive) {
        const newX = this.paddle.x + this.paddle.moveDir * this.paddle.speed * delta;
        this.paddle.x = clamp(newX, 0, this.width - this.paddle.width);
      }

      this.ball.x += this.ball.vx * delta;
      this.ball.y += this.ball.vy * delta;

      if (this.ball.x - this.ball.radius <= 0 && this.ball.vx < 0) {
        this.ball.x = this.ball.radius;
        this.ball.vx *= -1;
      } else if (this.ball.x + this.ball.radius >= this.width && this.ball.vx > 0) {
        this.ball.x = this.width - this.ball.radius;
        this.ball.vx *= -1;
      }
      if (this.ball.y - this.ball.radius <= 0 && this.ball.vy < 0) {
        this.ball.y = this.ball.radius;
        this.ball.vy *= -1;
      }

      this.handlePaddleCollision();
      this.handleBrickCollisions();
      this.updateParticles(delta);

      if (this.ball.y - this.ball.radius > this.height) {
        this.loseLife();
      }
    }

    handlePaddleCollision() {
      if (this.ball.vy >= 0) {
        const withinX =
          this.ball.x + this.ball.radius >= this.paddle.x &&
          this.ball.x - this.ball.radius <= this.paddle.x + this.paddle.width;
        const withinY = this.ball.y + this.ball.radius >= this.paddle.y;
        if (withinX && withinY && this.ball.y < this.paddle.y + this.paddle.height) {
          this.ball.y = this.paddle.y - this.ball.radius;
          const hitPos = (this.ball.x - (this.paddle.x + this.paddle.width / 2)) / (this.paddle.width / 2);
          const cappedHitPos = clamp(hitPos, -1, 1);
          const speed = Math.hypot(this.ball.vx, this.ball.vy);
          this.ball.vx = speed * cappedHitPos;
          this.ball.vy = -Math.abs(speed * (1 - Math.abs(cappedHitPos) * 0.35));
          this.playPaddleNote(this.ball.x);
        }
      }
    }

    handleBrickCollisions() {
      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        const intersects =
          this.ball.x + this.ball.radius > brick.x &&
          this.ball.x - this.ball.radius < brick.x + brick.width &&
          this.ball.y + this.ball.radius > brick.y &&
          this.ball.y - this.ball.radius < brick.y + brick.height;
        if (!intersects) continue;

        const overlapLeft = this.ball.x + this.ball.radius - brick.x;
        const overlapRight = brick.x + brick.width - (this.ball.x - this.ball.radius);
        const overlapTop = this.ball.y + this.ball.radius - brick.y;
        const overlapBottom = brick.y + brick.height - (this.ball.y - this.ball.radius);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapLeft || minOverlap === overlapRight) {
          this.ball.vx *= -1;
        } else {
          this.ball.vy *= -1;
        }

        brick.alive = false;
        this.score += 50;
        this.spawnExplosion(brick);
        this.playExplosion();
        this.notifyHud();
        break;
      }

      if (!this.bricks.some((brick) => brick.alive)) {
        this.level += 1;
        this.lives = Math.min(this.lives + 1, 5);
        this.message = 'Level up! Tempo rising…';
        this.notifyHud();
        this.centerPaddle();
        this.placeBallOnPaddle();
        this.buildLevel();
        setTimeout(() => {
          this.message = '';
          this.notifyHud();
        }, 1500);
      }
    }

    updateParticles(delta) {
      const gravity = 360;
      this.particles = this.particles.filter((particle) => {
        particle.life -= delta;
        if (particle.life <= 0) {
          return false;
        }
        particle.vy += gravity * delta;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        return true;
      });
    }

    loseLife() {
      this.lives -= 1;
      if (this.lives <= 0) {
        this.lives = 0;
        this.running = false;
        this.message = 'Game over — hit Restart to jam again.';
        this.notifyHud();
        this.centerPaddle();
        this.placeBallOnPaddle();
        return;
      }
      this.message = 'Try again! Keep the groove going.';
      this.notifyHud();
      this.centerPaddle();
      this.placeBallOnPaddle();
      setTimeout(() => {
        this.message = '';
        this.notifyHud();
      }, 1400);
    }

    spawnExplosion(brick) {
      const particleCount = 18;
      const centerX = brick.x + brick.width / 2;
      const centerY = brick.y + brick.height / 2;
      for (let i = 0; i < particleCount; i += 1) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.4;
        const speed = 180 + Math.random() * 220;
        this.particles.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.35,
          color: brick.color,
        });
      }
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    draw() {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      for (const brick of this.bricks) {
        if (!brick.alive) continue;
        ctx.fillStyle = brick.color;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 2;
        this.drawRoundedRect(ctx, brick.x, brick.y, brick.width, brick.height, 8);
        ctx.fill();
        ctx.stroke();
        const highlight = ctx.createLinearGradient(brick.x, brick.y, brick.x, brick.y + brick.height);
        highlight.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = highlight;
        this.drawRoundedRect(ctx, brick.x + 4, brick.y + 4, brick.width - 8, brick.height / 2.4, 6);
        ctx.fill();
      }

      for (const particle of this.particles) {
        const opacity = clamp(particle.life / 0.8, 0, 1);
        ctx.fillStyle = this.applyAlpha(particle.color, opacity);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 4 + opacity * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#fef9ff';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 3;
      this.drawRoundedRect(ctx, this.paddle.x, this.paddle.y, this.paddle.width, this.paddle.height, 10);
      ctx.fill();
      ctx.stroke();
      const paddleGradient = ctx.createLinearGradient(
        this.paddle.x,
        this.paddle.y,
        this.paddle.x,
        this.paddle.y + this.paddle.height
      );
      paddleGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      paddleGradient.addColorStop(1, 'rgba(160, 210, 255, 0.45)');
      ctx.fillStyle = paddleGradient;
      this.drawRoundedRect(ctx, this.paddle.x + 3, this.paddle.y + 2, this.paddle.width - 6, this.paddle.height - 4, 8);
      ctx.fill();

      const ballGradient = ctx.createRadialGradient(
        this.ball.x - this.ball.radius / 3,
        this.ball.y - this.ball.radius / 3,
        this.ball.radius / 3,
        this.ball.x,
        this.ball.y,
        this.ball.radius
      );
      ballGradient.addColorStop(0, '#ffffff');
      ballGradient.addColorStop(1, '#9fb9ff');
      ctx.fillStyle = ballGradient;
      ctx.beginPath();
      ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.stroke();

      if (!this.running && this.message) {
        this.drawOverlayMessage(this.message);
      } else if (this.message) {
        this.drawSubtleMessage(this.message);
      }

      ctx.restore();
    }

    drawOverlayMessage(message) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 24px "Monaco", "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(message, this.width / 2, this.height / 2);
      ctx.restore();
    }

    drawSubtleMessage(message) {
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      ctx.font = '600 18px "Monaco", "Courier New", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(message, this.width / 2, this.height * 0.22);
      ctx.restore();
    }

    applyAlpha(hexColor, alpha) {
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    ensureAudioContext() {
      if (this.audioContext) return this.audioContext;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.audioContext = new AudioCtx();
      return this.audioContext;
    }

    resumeAudio() {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }

    playPaddleNote(hitX) {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const normalized = clamp((hitX - this.paddle.x) / this.paddle.width, 0, 0.9999);
      const index = Math.min(NOTE_FREQUENCIES.length - 1, Math.floor(normalized * NOTE_FREQUENCIES.length));
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(NOTE_FREQUENCIES[index], now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    }

    playExplosion() {
      const ctx = this.ensureAudioContext();
      if (!ctx) return;
      const duration = 0.32;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        const fade = 1 - i / bufferSize;
        data[i] = (Math.random() * 2 - 1) * fade * fade;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600 + Math.random() * 800, now);
      filter.Q.value = 0.8;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
      source.stop(now + duration);
    }
  }

  window.initBrickbreakerWindow = function initBrickbreakerWindow(winEl) {
    const board = winEl.querySelector('[data-role="brickbreaker"]');
    if (!board) return;
    const canvas = board.querySelector('[data-role="brickbreaker-canvas"]');
    const scoreEl = board.querySelector('[data-role="score"]');
    const livesEl = board.querySelector('[data-role="lives"]');
    const levelEl = board.querySelector('[data-role="level"]');
    const restartBtn = board.querySelector('[data-action="restart"]');
    const messageEl = document.createElement('div');
    messageEl.className = 'brickbreaker-message';
    messageEl.hidden = true;
    messageEl.setAttribute('aria-live', 'polite');
    board.appendChild(messageEl);

    const game = new BrickBreakerGame(canvas, {
      onScoreChange: (value) => {
        scoreEl.textContent = value.toString();
      },
      onLivesChange: (value) => {
        livesEl.textContent = value.toString();
      },
      onLevelChange: (value) => {
        levelEl.textContent = value.toString();
      },
      onMessageChange: (message) => {
        messageEl.textContent = message;
        messageEl.hidden = !message;
      },
    });

    restartBtn?.addEventListener('click', () => {
      game.reset(true);
    });
  };
})();
