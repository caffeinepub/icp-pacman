import { useEffect, useRef, useState } from "react";

// ── Maze Layout ──────────────────────────────────────────
// 0=open  1=wall  2=pellet  3=power-pellet  4=ghost-house-interior
const MAZE_TEMPLATE: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 3, 1],
  [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 4, 4, 4, 4, 4, 0, 1, 2, 1, 1, 1, 1],
  [0, 0, 0, 0, 2, 0, 0, 4, 4, 4, 4, 4, 0, 0, 2, 0, 0, 0, 0],
  [1, 1, 1, 1, 2, 1, 0, 4, 4, 4, 4, 4, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 2, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 3, 2, 1, 2, 2, 2, 2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 3, 1],
  [1, 1, 2, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 2, 1, 1],
  [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

const ROWS = MAZE_TEMPLATE.length;
const COLS = 19;
const TILE = 28;
const HUD_HEIGHT = TILE;
const CANVAS_W = COLS * TILE;
const CANVAS_H = ROWS * TILE + HUD_HEIGHT;

// Pacman speed: tiles per second
const PAC_SPEED = 7.5;
// Ghost speed: tiles per second
const GHOST_SPEED = 5.5;
const POWER_DURATION = 8; // seconds

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};
const DIR_LIST = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

// Tile coordinate position (float, in tile units)
interface Pos {
  x: number;
  y: number;
}

interface Ghost {
  pos: Pos; // tile-unit position (center of current tile + sub-tile offset)
  dir: Dir;
  nextDir: Dir;
  color: string;
  mode: "chase" | "scatter" | "frightened" | "eaten";
  frightenTimer: number;
  scatterTarget: { tx: number; ty: number };
  releaseTimer: number; // seconds before this ghost leaves the house
}

interface GameState {
  maze: number[][];
  pacPos: Pos; // tile-unit position
  pacDir: Dir;
  pacNextDir: Dir;
  pacMouthAngle: number;
  pacMouthOpen: boolean;
  ghosts: Ghost[];
  score: number;
  lives: number;
  level: number;
  pelletsLeft: number;
  powerActive: boolean;
  powerTimer: number;
  gameStatus: "playing" | "dying" | "levelclear" | "gameover";
  statusTimer: number; // seconds remaining in dying/levelclear states
}

function deepCopyMaze(template: number[][]): number[][] {
  return template.map((row) => [...row]);
}

function countPellets(maze: number[][]): number {
  let n = 0;
  for (const row of maze) for (const c of row) if (c === 2 || c === 3) n++;
  return n;
}

function tileAt(maze: number[][], col: number, row: number): number {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 0;
  return maze[row][col];
}

// Pacman can walk through anything except walls (1)
function pacPassable(maze: number[][], col: number, row: number): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1;
}

// Ghosts can walk through open tiles, pellet tiles, and ghost-house interior
// but NOT walls (1) and NOT the ghost-house *door* row unless leaving
function ghostPassable(maze: number[][], col: number, row: number): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1;
}

function initGhosts(level: number): Ghost[] {
  const speed = Math.min(GHOST_SPEED + (level - 1) * 0.3, 9);
  void speed;
  // All ghosts start just outside the house at the corridor, staggered by releaseTimer
  return [
    {
      pos: { x: 9, y: 8 }, // Blinky starts outside immediately
      dir: DIRS.left,
      nextDir: DIRS.left,
      color: "#FF0000",
      mode: "chase",
      frightenTimer: 0,
      scatterTarget: { tx: 17, ty: 0 },
      releaseTimer: 0,
    },
    {
      pos: { x: 9, y: 10 }, // Pinky inside house
      dir: DIRS.up,
      nextDir: DIRS.up,
      color: "#FFB8FF",
      mode: "scatter",
      frightenTimer: 0,
      scatterTarget: { tx: 1, ty: 0 },
      releaseTimer: 4,
    },
    {
      pos: { x: 8, y: 10 }, // Inky inside house
      dir: DIRS.down,
      nextDir: DIRS.down,
      color: "#00FFFF",
      mode: "scatter",
      frightenTimer: 0,
      scatterTarget: { tx: 17, ty: 21 },
      releaseTimer: 8,
    },
    {
      pos: { x: 10, y: 10 }, // Clyde inside house
      dir: DIRS.up,
      nextDir: DIRS.up,
      color: "#FFB847",
      mode: "scatter",
      frightenTimer: 0,
      scatterTarget: { tx: 1, ty: 21 },
      releaseTimer: 12,
    },
  ];
}

function createInitialState(level = 1): GameState {
  const maze = deepCopyMaze(MAZE_TEMPLATE);
  return {
    maze,
    pacPos: { x: 9, y: 16 },
    pacDir: DIRS.none,
    pacNextDir: DIRS.left,
    pacMouthAngle: 0.25,
    pacMouthOpen: true,
    ghosts: initGhosts(level),
    score: 0,
    lives: 3,
    level,
    pelletsLeft: countPellets(maze),
    powerActive: false,
    powerTimer: 0,
    gameStatus: "playing",
    statusTimer: 0,
  };
}

// Tile-aligned means the fractional part of position is near 0
function isTileAligned(pos: Pos, threshold = 0.2): boolean {
  return (
    Math.abs(pos.x - Math.round(pos.x)) < threshold &&
    Math.abs(pos.y - Math.round(pos.y)) < threshold
  );
}

function snapPos(pos: Pos): Pos {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

function canMove(
  maze: number[][],
  pos: Pos,
  dir: Dir,
  isGhost = false,
): boolean {
  if (dir.x === 0 && dir.y === 0) return false;
  const col = Math.round(pos.x) + dir.x;
  const row = Math.round(pos.y) + dir.y;
  return isGhost ? ghostPassable(maze, col, row) : pacPassable(maze, col, row);
}

// Ghost AI: pick best direction at a junction
function pickGhostDir(ghost: Ghost, state: GameState): Dir {
  const col = Math.round(ghost.pos.x);
  const row = Math.round(ghost.pos.y);

  // While still in the release timer, just bounce up/down inside house
  if (ghost.releaseTimer > 0) {
    // Try to keep moving up/down
    const preferred = ghost.dir.y !== 0 ? ghost.dir : DIRS.up;
    if (ghostPassable(state.maze, col + preferred.x, row + preferred.y))
      return preferred;
    const flip = { x: -preferred.x, y: -preferred.y };
    if (ghostPassable(state.maze, col + flip.x, row + flip.y)) return flip;
    return DIRS.none;
  }

  // Exiting house: navigate toward col=9, row=8 (the door)
  if (row >= 8 && row <= 12 && col >= 6 && col <= 12) {
    // Inside house area: move toward exit at (9, 8)
    if (col !== 9) {
      const dx = col < 9 ? DIRS.right : DIRS.left;
      if (ghostPassable(state.maze, col + dx.x, row + dx.y)) return dx;
    }
    if (row > 8) {
      if (ghostPassable(state.maze, col, row - 1)) return DIRS.up;
    }
  }

  const target =
    ghost.mode === "scatter"
      ? ghost.scatterTarget
      : ghost.mode === "frightened"
        ? {
            tx: Math.floor(Math.random() * COLS),
            ty: Math.floor(Math.random() * ROWS),
          }
        : { tx: Math.round(state.pacPos.x), ty: Math.round(state.pacPos.y) };

  const reverse = { x: -ghost.dir.x, y: -ghost.dir.y };

  let bestDir: Dir = DIRS.none;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const d of DIR_LIST) {
    // No reversing (unless it's the only option)
    if (d.x === reverse.x && d.y === reverse.y) continue;
    const nc = col + d.x;
    const nr = row + d.y;
    if (!ghostPassable(state.maze, nc, nr)) continue;
    const dist = (nc - target.tx) ** 2 + (nr - target.ty) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestDir = d;
    }
  }

  // If completely stuck (reverse only option), allow reverse
  if (bestDir === DIRS.none) {
    if (ghostPassable(state.maze, col + reverse.x, col + reverse.y)) {
      return reverse;
    }
  }

  return bestDir.x !== undefined ? bestDir : ghost.dir;
}

export interface PacmanGameProps {
  onScoreUpdate: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLivesUpdate: (lives: number) => void;
  initialLevel?: number;
}

export default function PacmanGame({
  onScoreUpdate,
  onGameOver,
  onLivesUpdate,
  initialLevel = 1,
}: PacmanGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createInitialState(initialLevel));
  const animRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef<number>(0);
  const [gameStatus, setGameStatus] =
    useState<GameState["gameStatus"]>("playing");

  const onScoreUpdateRef = useRef(onScoreUpdate);
  const onGameOverRef = useRef(onGameOver);
  const onLivesUpdateRef = useRef(onLivesUpdate);
  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
  }, [onScoreUpdate]);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);
  useEffect(() => {
    onLivesUpdateRef.current = onLivesUpdate;
  }, [onLivesUpdate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally empty deps -- game loop runs once and uses refs
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    stateRef.current = createInitialState(initialLevel);
    frameRef.current = 0;
    lastTimeRef.current = 0;

    // ── Draw helpers ──────────────────────────────────
    function toPixel(tileCoord: number): number {
      return tileCoord * TILE;
    }

    function drawMaze(
      c: CanvasRenderingContext2D,
      maze: number[][],
      frame: number,
    ) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = maze[row][col];
          const px = col * TILE;
          const py = row * TILE;

          if (cell === 1) {
            c.fillStyle = "#0a0a2e";
            c.fillRect(px, py, TILE, TILE);
            c.strokeStyle = "#1a3a8e";
            c.lineWidth = 1.5;
            c.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
          } else {
            c.fillStyle = "#050510";
            c.fillRect(px, py, TILE, TILE);
          }

          if (cell === 2) {
            c.beginPath();
            c.arc(px + TILE / 2, py + TILE / 2, 2.5, 0, Math.PI * 2);
            c.fillStyle = "#ffeebb";
            c.fill();
          } else if (cell === 3) {
            const pulse = 4 + Math.sin(frame * 0.12) * 1.5;
            c.beginPath();
            c.arc(px + TILE / 2, py + TILE / 2, pulse, 0, Math.PI * 2);
            const grd = c.createRadialGradient(
              px + TILE / 2,
              py + TILE / 2,
              0,
              px + TILE / 2,
              py + TILE / 2,
              pulse,
            );
            grd.addColorStop(0, "#ffffff");
            grd.addColorStop(0.5, "#ffffaa");
            grd.addColorStop(1, "transparent");
            c.fillStyle = grd;
            c.fill();
          }
        }
      }
    }

    function drawPacman(c: CanvasRenderingContext2D, state: GameState) {
      const { pacPos, pacDir, pacMouthAngle } = state;
      const cx = toPixel(pacPos.x) + TILE / 2;
      const cy = toPixel(pacPos.y) + TILE / 2;
      const r = TILE / 2 - 2;
      const mouth = pacMouthAngle * Math.PI;

      let rotation = 0;
      if (pacDir.x === 1) rotation = 0;
      else if (pacDir.x === -1) rotation = Math.PI;
      else if (pacDir.y === -1) rotation = -Math.PI / 2;
      else if (pacDir.y === 1) rotation = Math.PI / 2;

      c.save();
      c.translate(cx, cy);
      c.rotate(rotation);
      c.shadowColor = "#ffd700";
      c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, r, mouth, 2 * Math.PI - mouth);
      c.closePath();
      const grd = c.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, "#fff176");
      grd.addColorStop(0.7, "#ffd700");
      grd.addColorStop(1, "#e6ac00");
      c.fillStyle = grd;
      c.fill();
      c.shadowBlur = 0;
      c.restore();
    }

    function drawGhostEyes(c: CanvasRenderingContext2D, ghost: Ghost) {
      const cx = toPixel(ghost.pos.x) + TILE / 2;
      const cy = toPixel(ghost.pos.y) + TILE / 2 - 2;
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.ellipse(cx - 5, cy, 4, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(cx + 5, cy, 4, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#0000cc";
      c.beginPath();
      c.ellipse(
        cx - 5 + ghost.dir.x * 2,
        cy + ghost.dir.y * 2,
        2.5,
        3,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
      c.beginPath();
      c.ellipse(
        cx + 5 + ghost.dir.x * 2,
        cy + ghost.dir.y * 2,
        2.5,
        3,
        0,
        0,
        Math.PI * 2,
      );
      c.fill();
    }

    function drawGhost(c: CanvasRenderingContext2D, ghost: Ghost) {
      if (ghost.mode === "eaten") {
        drawGhostEyes(c, ghost);
        return;
      }

      const px = toPixel(ghost.pos.x);
      const py = toPixel(ghost.pos.y);
      const x = px + 2;
      const y = py + 2;
      const w = TILE - 4;
      const h = TILE - 4;
      const cx = px + TILE / 2;

      let color = ghost.color;
      if (ghost.mode === "frightened") {
        const flashing =
          ghost.frightenTimer < 3 &&
          Math.floor(ghost.frightenTimer * 4) % 2 === 0;
        color = flashing ? "#ffffff" : "#0000cc";
      }

      c.save();
      if (ghost.mode !== "frightened") {
        c.shadowColor = color;
        c.shadowBlur = 6;
      }
      c.fillStyle = color;
      c.beginPath();
      c.arc(cx, y + w / 2, w / 2, Math.PI, 0, false);
      c.lineTo(x + w, y + h);
      const ww = w / 3;
      c.lineTo(x + w - ww / 2, y + h - 5);
      c.lineTo(x + w - ww, y + h);
      c.lineTo(x + ww / 2 + ww / 2, y + h - 5);
      c.lineTo(x + ww, y + h);
      c.lineTo(x + ww / 2, y + h - 5);
      c.lineTo(x, y + h);
      c.closePath();
      c.fill();
      c.shadowBlur = 0;

      if (ghost.mode === "frightened") {
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(cx - 5, y + h / 2 - 2, 3, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx + 5, y + h / 2 - 2, 3, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#ffffff";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx - 6, y + h / 2 + 4);
        c.lineTo(cx - 3, y + h / 2 + 2);
        c.lineTo(cx, y + h / 2 + 4);
        c.lineTo(cx + 3, y + h / 2 + 2);
        c.lineTo(cx + 6, y + h / 2 + 4);
        c.stroke();
      } else {
        drawGhostEyes(c, ghost);
      }
      c.restore();
    }

    function drawHUD(c: CanvasRenderingContext2D, state: GameState) {
      c.fillStyle = "#050510";
      c.fillRect(0, 0, CANVAS_W, HUD_HEIGHT);
      c.fillStyle = "#ffd700";
      c.font = "bold 13px 'JetBrains Mono', monospace";
      c.fillText(`SCORE: ${state.score}`, 10, 18);
      c.fillStyle = "#00ffff";
      c.fillText(`LVL ${state.level}`, CANVAS_W / 2 - 22, 18);
      c.fillStyle = "#ffd700";
      const hearts =
        state.lives > 0 ? "♥".repeat(Math.min(state.lives, 5)) : "";
      c.fillText(hearts, CANVAS_W - 10 - hearts.length * 12, 18);
    }

    function drawOverlay(c: CanvasRenderingContext2D, state: GameState) {
      if (state.gameStatus === "dying") {
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillRect(0, 0, CANVAS_W, ROWS * TILE);
        c.fillStyle = "#ff4444";
        c.font = "bold 28px 'JetBrains Mono', monospace";
        c.textAlign = "center";
        c.fillText("OUCH!", CANVAS_W / 2, (ROWS * TILE) / 2);
        c.textAlign = "left";
      } else if (state.gameStatus === "levelclear") {
        c.fillStyle = "rgba(0,0,0,0.6)";
        c.fillRect(0, 0, CANVAS_W, ROWS * TILE);
        c.textAlign = "center";
        c.fillStyle = "#ffd700";
        c.font = "bold 24px 'JetBrains Mono', monospace";
        c.fillText(
          `LEVEL ${state.level - 1} CLEAR!`,
          CANVAS_W / 2,
          (ROWS * TILE) / 2 - 10,
        );
        c.fillStyle = "#00ffff";
        c.font = "16px 'JetBrains Mono', monospace";
        c.fillText("GET READY...", CANVAS_W / 2, (ROWS * TILE) / 2 + 20);
        c.textAlign = "left";
      }
    }

    // ── Update ────────────────────────────────────────────
    function resetAfterDeath(state: GameState) {
      state.pacPos = { x: 9, y: 16 };
      state.pacDir = DIRS.none;
      state.pacNextDir = DIRS.left;
      state.ghosts = initGhosts(state.level);
      state.powerActive = false;
      state.powerTimer = 0;
    }

    function update(dt: number) {
      const state = stateRef.current;

      if (state.gameStatus === "gameover") return;

      if (state.gameStatus === "dying") {
        state.statusTimer -= dt;
        if (state.statusTimer <= 0) {
          state.lives--;
          onLivesUpdateRef.current(state.lives);
          if (state.lives <= 0) {
            state.gameStatus = "gameover";
            onGameOverRef.current(state.score);
            setGameStatus("gameover");
          } else {
            resetAfterDeath(state);
            state.gameStatus = "playing";
            setGameStatus("playing");
          }
        }
        return;
      }

      if (state.gameStatus === "levelclear") {
        state.statusTimer -= dt;
        if (state.statusTimer <= 0) {
          const nextLevel = state.level;
          const prevScore = state.score;
          const prevLives = state.lives;
          stateRef.current = {
            ...createInitialState(nextLevel),
            score: prevScore,
            lives: prevLives,
          };
          setGameStatus("playing");
        }
        return;
      }

      // ── Read keyboard ──
      if (keysRef.current.has("ArrowUp") || keysRef.current.has("w"))
        state.pacNextDir = DIRS.up;
      else if (keysRef.current.has("ArrowDown") || keysRef.current.has("s"))
        state.pacNextDir = DIRS.down;
      else if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a"))
        state.pacNextDir = DIRS.left;
      else if (keysRef.current.has("ArrowRight") || keysRef.current.has("d"))
        state.pacNextDir = DIRS.right;

      // ── Move Pacman ──
      const pacStep = PAC_SPEED * dt;

      if (isTileAligned(state.pacPos)) {
        // Snap to exact tile
        state.pacPos = snapPos(state.pacPos);
        // Try to turn
        if (canMove(state.maze, state.pacPos, state.pacNextDir, false)) {
          state.pacDir = state.pacNextDir;
        }
      }

      if (canMove(state.maze, state.pacPos, state.pacDir, false)) {
        state.pacPos = {
          x: state.pacPos.x + state.pacDir.x * pacStep,
          y: state.pacPos.y + state.pacDir.y * pacStep,
        };
        // Tunnel
        if (state.pacPos.x < -0.5) state.pacPos.x = COLS - 0.5;
        if (state.pacPos.x > COLS - 0.5) state.pacPos.x = -0.5;
      } else if (isTileAligned(state.pacPos)) {
        state.pacPos = snapPos(state.pacPos);
      }

      // ── Pacman mouth ──
      if (state.pacDir.x !== 0 || state.pacDir.y !== 0) {
        const speed = 4 * dt;
        if (state.pacMouthOpen) {
          state.pacMouthAngle = Math.max(0.02, state.pacMouthAngle - speed);
          if (state.pacMouthAngle <= 0.02) state.pacMouthOpen = false;
        } else {
          state.pacMouthAngle = Math.min(0.4, state.pacMouthAngle + speed);
          if (state.pacMouthAngle >= 0.4) state.pacMouthOpen = true;
        }
      } else {
        state.pacMouthAngle = 0.25;
      }

      // ── Eat pellets ──
      const pc = Math.round(state.pacPos.x);
      const pr = Math.round(state.pacPos.y);
      if (pr >= 0 && pr < ROWS && pc >= 0 && pc < COLS) {
        const cell = state.maze[pr][pc];
        if (cell === 2) {
          state.maze[pr][pc] = 0;
          state.score += 10;
          state.pelletsLeft--;
          onScoreUpdateRef.current(state.score);
        } else if (cell === 3) {
          state.maze[pr][pc] = 0;
          state.score += 50;
          state.pelletsLeft--;
          onScoreUpdateRef.current(state.score);
          state.powerActive = true;
          state.powerTimer = POWER_DURATION;
          for (const g of state.ghosts) {
            if (g.mode !== "eaten") {
              g.mode = "frightened";
              g.frightenTimer = POWER_DURATION;
            }
          }
        }
      }

      if (state.pelletsLeft <= 0) {
        state.gameStatus = "levelclear";
        state.statusTimer = 3;
        state.level++;
        setGameStatus("levelclear");
        return;
      }

      // ── Power timer ──
      if (state.powerActive) {
        state.powerTimer -= dt;
        if (state.powerTimer <= 0) {
          state.powerActive = false;
          for (const g of state.ghosts) {
            if (g.mode === "frightened") g.mode = "chase";
          }
        }
      }

      // ── Ghost updates ──
      for (const ghost of state.ghosts) {
        // Release timer countdown
        if (ghost.releaseTimer > 0) {
          ghost.releaseTimer -= dt;
          // While waiting, bounce up/down inside house
          const gcol = Math.round(ghost.pos.x);
          const grow = Math.round(ghost.pos.y);
          const step = GHOST_SPEED * 0.5 * dt;
          const nd = ghost.dir.y !== 0 ? ghost.dir : DIRS.up;
          const ngrow = grow + nd.y;
          if (ghostPassable(state.maze, gcol, ngrow)) {
            ghost.pos = { x: ghost.pos.x, y: ghost.pos.y + nd.y * step };
            ghost.dir = nd;
          } else {
            ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
          }
          continue;
        }

        // Frightened timer
        if (ghost.mode === "frightened") {
          ghost.frightenTimer -= dt;
          if (ghost.frightenTimer <= 0) ghost.mode = "chase";
        }

        const ghostStep =
          (ghost.mode === "frightened"
            ? GHOST_SPEED * 0.55
            : ghost.mode === "eaten"
              ? GHOST_SPEED * 2
              : GHOST_SPEED) * dt;

        // At tile boundary: pick new direction
        if (isTileAligned(ghost.pos)) {
          ghost.pos = snapPos(ghost.pos);
          ghost.dir = pickGhostDir(ghost, state);
        }

        // Move
        const ngx = ghost.pos.x + ghost.dir.x * ghostStep;
        const ngy = ghost.pos.y + ghost.dir.y * ghostStep;
        const ngCol = Math.round(ngx);
        const ngRow = Math.round(ngy);

        if (ghostPassable(state.maze, ngCol, ngRow)) {
          ghost.pos = { x: ngx, y: ngy };
          // Tunnel
          if (ghost.pos.x < -0.5) ghost.pos.x = COLS - 0.5;
          if (ghost.pos.x > COLS - 0.5) ghost.pos.x = -0.5;
        } else {
          // Snap and reverse
          ghost.pos = snapPos(ghost.pos);
          ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
        }
      }

      // ── Collision ──
      for (const ghost of state.ghosts) {
        if (ghost.mode === "eaten") continue;
        const dx = Math.abs(ghost.pos.x - state.pacPos.x);
        const dy = Math.abs(ghost.pos.y - state.pacPos.y);
        if (dx < 0.7 && dy < 0.7) {
          if (ghost.mode === "frightened") {
            ghost.mode = "eaten";
            state.score += 200;
            onScoreUpdateRef.current(state.score);
            const g = ghost;
            setTimeout(() => {
              g.pos = { x: 9, y: 10 };
              g.mode = "chase";
              g.dir = DIRS.up;
              g.releaseTimer = 0;
            }, 3000);
          } else {
            state.gameStatus = "dying";
            state.statusTimer = 2;
            setGameStatus("dying");
            return;
          }
        }
      }
    }

    function draw() {
      const state = stateRef.current;
      const frame = frameRef.current;

      drawHUD(ctx, state);
      ctx.save();
      ctx.translate(0, HUD_HEIGHT);
      drawMaze(ctx, state.maze, frame);
      for (const ghost of state.ghosts) drawGhost(ctx, ghost);
      if (state.gameStatus !== "dying" || Math.floor(frame / 4) % 2 === 0) {
        drawPacman(ctx, state);
      }
      drawOverlay(ctx, state);
      ctx.restore();
    }

    const loop = (timestamp: number) => {
      const dt = lastTimeRef.current
        ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.05) // seconds, capped at 50ms
        : 0.016;
      lastTimeRef.current = timestamp;
      frameRef.current++;

      update(dt);
      draw();

      if (stateRef.current.gameStatus !== "gameover") {
        animRef.current = requestAnimationFrame(loop);
      }
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard ──────────────────────────────────────────
  useEffect(() => {
    const gameKeys = [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "w",
      "a",
      "s",
      "d",
    ];
    const onKeyDown = (e: KeyboardEvent) => {
      if (gameKeys.includes(e.key)) {
        e.preventDefault();
        keysRef.current.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // ── Mobile D-pad ──────────────────────────────────────
  const handleDpad = (dir: string) => {
    keysRef.current.clear();
    if (dir === "up") keysRef.current.add("ArrowUp");
    else if (dir === "down") keysRef.current.add("ArrowDown");
    else if (dir === "left") keysRef.current.add("ArrowLeft");
    else if (dir === "right") keysRef.current.add("ArrowRight");
    setTimeout(() => keysRef.current.clear(), 200);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        data-ocid="game.canvas_target"
        className="arcade-border rounded-lg"
        style={{ maxWidth: "100%", imageRendering: "pixelated" }}
      />

      {/* Mobile D-pad */}
      <div className="sm:hidden flex flex-col items-center gap-1 mt-2">
        <button
          type="button"
          className="dpad-btn"
          onPointerDown={() => handleDpad("up")}
          aria-label="Up"
        >
          ▲
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => handleDpad("left")}
            aria-label="Left"
          >
            ◀
          </button>
          <div className="w-14 h-14" />
          <button
            type="button"
            className="dpad-btn"
            onPointerDown={() => handleDpad("right")}
            aria-label="Right"
          >
            ▶
          </button>
        </div>
        <button
          type="button"
          className="dpad-btn"
          onPointerDown={() => handleDpad("down")}
          aria-label="Down"
        >
          ▼
        </button>
      </div>

      <p className="hidden sm:block font-arcade text-xs text-muted-foreground">
        USE ARROW KEYS OR WASD TO MOVE
      </p>

      {gameStatus === "gameover" && (
        <div className="font-arcade text-pac-red text-lg animate-pulse">
          GAME OVER
        </div>
      )}
    </div>
  );
}
