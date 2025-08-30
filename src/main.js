// Minesweeper in Phaser 3 (Win98 + smiley)
// Controls: LMB — reveal, RMB — flag, click an open number with matching flags to chord.

const TILE = 32;

const FR = {
  covered: 0,
  empty: 1,
  numbers: [null, 2, 3, 4, 5, 6, 7, 8, 9], // frames for numbers 1..8
  mine: 10,
  flag: 11,
  exploded: 12,
  wrong: 13,
  hover: 14,
};

function getPreset(preset) {
  switch (preset) {
    case 'beginner': return { cols: 9, rows: 9, mines: 10 };
    case 'intermediate': return { cols: 16, rows: 16, mines: 40 };
    case 'expert': return { cols: 30, rows: 16, mines: 99 };
    default: return { cols: 9, rows: 9, mines: 10 };
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
    this.gridX = 10;
    this.gridY = 10;
    this.cols = 9;
    this.rows = 9;
    this.mines = 10;
    this.firstClickDone = false;
    this.gameOver = false;
    this.revealedCount = 0;
    this.flagsPlaced = 0;
    this.timerEvent = null;
    this.elapsed = 0;
    this.cells = [];
  }

  preload() {
    this.load.spritesheet('tiles', 'assets/tiles.png', { frameWidth: TILE, frameHeight: TILE });
  }

  create() {
    this.input.mouse.disableContextMenu();

    this.$status = document.getElementById('status');
    this.$minesLeft = document.getElementById('minesLeft');
    this.$time = document.getElementById('time');
    this.$diff = document.getElementById('difficulty');
    this.$cols = document.getElementById('cols');
    this.$rows = document.getElementById('rows');
    this.$mines = document.getElementById('mines');

    this.startNewFromUI();
  }

  startNewFromUI() {
    const d = this.$diff.value;
    let cfg;
    if (d === 'custom') {
      const cols = Math.max(5, Math.min(60, parseInt(this.$cols?.value || '9', 10)));
      const rows = Math.max(5, Math.min(40, parseInt(this.$rows?.value || '9', 10)));
      const maxMines = Math.max(1, cols * rows - 1);
      const mines = Math.max(1, Math.min(maxMines, parseInt(this.$mines?.value || '10', 10)));
      cfg = { cols, rows, mines };
      if (this.$cols) this.$cols.value = cols;
      if (this.$rows) this.$rows.value = rows;
      if (this.$mines) this.$mines.value = mines;
    } else {
      cfg = getPreset(d);
      if (this.$cols) this.$cols.value = cfg.cols;
      if (this.$rows) this.$rows.value = cfg.rows;
      if (this.$mines) this.$mines.value = cfg.mines;
    }
    this.startNewGame(cfg.cols, cfg.rows, cfg.mines);
  }

  startNewGame(cols, rows, mines) {
    this.children.removeAll();
    this.cells = [];
    this.cols = cols; this.rows = rows; this.mines = mines;
    this.firstClickDone = false;
    this.gameOver = false;
    this.revealedCount = 0;
    this.flagsPlaced = 0;
    this.elapsed = 0;
    if (this.timerEvent) { this.timerEvent.remove(false); this.timerEvent = null; }
    this.$status.textContent = '';
    this.$time.textContent = '000';
    this.$minesLeft.textContent = this.mines.toString();

    const width = this.gridX * 2 + this.cols * TILE;
    const height = this.gridY * 2 + this.rows * TILE;
    this.scale.resize(width, height);

    for (let y = 0; y < this.rows; y++) {
      const row = [];
      for (let x = 0; x < this.cols; x++) {
        const img = this.add.image(this.gridX + x * TILE + TILE / 2, this.gridY + y * TILE + TILE / 2, 'tiles', FR.covered);
        img.setInteractive();
        img.setData('x', x);
        img.setData('y', y);
        row.push({
          x, y, img,
          hasMine: false, neighbor: 0,
          revealed: false, flagged: false,
          exploded: false, wrong: false,
        });
      }
      this.cells.push(row);
    }

    // Hover handlers
    this.input.on('gameobjectover', (pointer, obj) => {
      if (this.gameOver) return;
      const x = obj.getData('x'), y = obj.getData('y');
      const cell = this.cells[y][x];
      if (!cell.revealed && !cell.flagged) obj.setFrame(FR.hover);
    });

    this.input.on('gameobjectout', (pointer, obj) => {
      if (this.gameOver) return;
      const x = obj.getData('x'), y = obj.getData('y');
      const cell = this.cells[y][x];
      if (!cell.revealed && !cell.flagged) obj.setFrame(FR.covered);
    });

    // Click handlers
    this.input.on('gameobjectdown', (pointer, obj) => {
      const x = obj.getData('x'), y = obj.getData('y');
      if (this.gameOver) return;
      if (pointer.rightButtonDown()) {
        this.toggleFlag(x, y);
      } else {
        this.handleRevealClick(x, y);
      }
    });
  }

  placeMines(avoidX, avoidY) {
    const total = this.cols * this.rows;
    let positions = [];
    for (let i = 0; i < total; i++) positions.push(i);
    const avoidIndex = avoidY * this.cols + avoidX;
    positions.splice(avoidIndex, 1);

    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    const pick = positions.slice(0, this.mines);
    for (let idx of pick) {
      const x = idx % this.cols;
      const y = Math.floor(idx / this.cols);
      this.cells[y][x].hasMine = true;
    }

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (this.cells[y][x].hasMine) { this.cells[y][x].neighbor = -1; continue; }
        let c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows && this.cells[ny][nx].hasMine) c++;
        }
        this.cells[y][x].neighbor = c;
      }
    }
  }

  startTimer() {
    if (this.timerEvent) return;
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameOver) return;
        this.elapsed = Math.min(999, this.elapsed + 1);
        this.$time.textContent = this.elapsed.toString().padStart(3, '0');
      }
    });
  }

  handleRevealClick(x, y) {
    const cell = this.cells[y][x];

    // Chord on already-open number
    if (cell.revealed && cell.neighbor > 0) {
      this.tryChord(x, y);
      return;
    }
    if (!this.firstClickDone) {
      this.firstClickDone = true;
      this.placeMines(x, y);
      this.startTimer();
    }
    if (cell.flagged || cell.revealed) return;

    if (cell.hasMine) {
      this.revealAllMines(x, y);
      this.lose();
      return;
    }
    this.floodReveal(x, y);
    this.checkWin();
  }

  toggleFlag(x, y) {
    if (!this.firstClickDone || this.gameOver) return;
    const cell = this.cells[y][x];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    cell.img.setFrame(cell.flagged ? FR.flag : FR.covered);
    this.flagsPlaced += cell.flagged ? 1 : -1;
    const minesLeft = Math.max(0, this.mines - this.flagsPlaced);
    this.$minesLeft.textContent = minesLeft.toString();
  }

  floodReveal(x, y) {
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      const c = this.cells[cy][cx];
      if (c.revealed || c.flagged) continue;
      c.revealed = true;
      this.revealedCount++;
      if (c.neighbor <= 0) {
        c.img.setFrame(FR.empty);
      } else {
        c.img.setFrame(FR.numbers[c.neighbor]);
      }
      if (c.neighbor === 0) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
            const n = this.cells[ny][nx];
            if (!n.revealed && !n.flagged) stack.push([nx, ny]);
          }
        }
      }
    }
  }

  tryChord(x, y) {
    const c = this.cells[y][x];
    let flagsAround = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
        if (this.cells[ny][nx].flagged) flagsAround++;
      }
    }
    if (flagsAround !== c.neighbor) return;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
        const n = this.cells[ny][nx];
        if (!n.flagged && !n.revealed) {
          if (n.hasMine) {
            this.revealAllMines(nx, ny);
            this.lose();
            return;
          } else {
            this.floodReveal(nx, ny);
          }
        }
      }
    }
    this.checkWin();
  }

  revealAllMines(explodedX, explodedY) {
    for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
      const c = this.cells[y][x];
      if (c.hasMine) {
        if (x === explodedX && y === explodedY) {
          c.img.setFrame(FR.exploded);
        } else {
          c.img.setFrame(FR.mine);
        }
        c.revealed = true; // mark final state so hover can’t override
      } else if (c.flagged && !c.hasMine) {
        c.img.setFrame(FR.wrong);
        c.revealed = true; // keep wrong-flag frame sticky
      }
    }
  }

  lose() {
    this.gameOver = true;
    this.$status.textContent = '💥 Game Over!';
  }

  checkWin() {
    const totalSafe = this.cols * this.rows - this.mines;
    if (this.revealedCount >= totalSafe) {
      this.gameOver = true;
      this.$status.textContent = '🎉 You Win!';
      // auto-show flags
      for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
        const c = this.cells[y][x];
        if (c.hasMine && !c.flagged) { c.flagged = true; c.img.setFrame(FR.flag); }
      }
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#c0c0c0',
  width: 9 * TILE + 20,
  height: 9 * TILE + 20,
  scene: [GameScene],
};

window.game = new Phaser.Game(config);
