# Minesweeper (Phaser 3) — Windows 98 Style

A clone of the classic **Windows 98 Minesweeper**, built with Phaser 3 and styled with a retro Win98 look.  

---

## Features
- Classic Minesweeper gameplay
- Windows 98 styled UI (buttons, panels, counters)
- Smiley button to start a new game
- Difficulty presets:
  - Beginner (9×9, 10 mines)
  - Intermediate (16×16, 40 mines)
  - Expert (30×16, 99 mines)
- Timer and remaining mines counter
- Right-click for flags, chord-click on numbers

---

## Installation & Running Locally


### 1. Install dependencies
This project uses [http-server](https://www.npmjs.com/package/http-server) as a lightweight local server.

```bash
npm install
```

### 2. Launch
```bash
npm start
```

## Controls

Left Click (LMB) — Reveal a cell

Right Click (RMB) — Place or remove a flag

Click on a revealed number with the correct number of adjacent flags — Chords the surrounding cells

🙂 Smiley button — Start a new game