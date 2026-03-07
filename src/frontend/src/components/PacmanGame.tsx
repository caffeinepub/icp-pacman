import { useCallback, useEffect, useRef, useState } from "react";

// ── Maze Layout ──────────────────────────────────────────
// 0=empty  1=wall  2=pellet  3=power-pellet  4=ghost-house
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

const COLS = 19;
const TILE = 28;
const HUD_HEIGHT = TILE;
const CANVAS_W = COLS * TILE;
const CANVAS_H = MAZE_TEMPLATE.length * TILE + HUD_HEIGHT;

const PACMAN_SPEED = 1.8;
const POWER_DURATION = 300; // frames

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

interface Ghost {
  x: number;
  y: number;
  dir: Dir;
  color: string;
  mode: "chase" | "scatter" | "frightened" | "eaten";
  frightenTimer: number;
  scatterTarget: { tx: number; ty: number };
  speed: number;
  moveTimer: number;
}

interface GameState {
  maze: number[][];
  pacX: number;
  pacY: number;
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
  deathTimer: number;
}

function deepCopyMaze(template: number[][]): number[][] {
  return template.map((row) => [...row]);
}

function countPellets(maze: number[][]): number {
  let count = 0;
  for (const row of maze) {
    for (const cell of row) {
      if (cell === 2 || cell === 3) count++;
    }
  }
  return count;
}

function initGhosts(level: number): Ghost[] {
  const baseSpeed = Math.min(1.2 + level * 0.1, 2.2);
  return [
    {
      x: 7 * TILE,
      y: 9 * TILE,
      dir: DIRS.left,
      color: "#FF0000",
      mode: "chase",
      frightenTimer: 0,
      scatterTarget: { tx: 16, ty: 0 },
      speed: baseSpeed,
      moveTimer: 0,
    },
    {
      x: 8 * TILE,
      y: 9 * TILE,
      dir: DIRS.up,
      color: "#FFB8FF",
      mode: "scatter",
      frightenTimer: 0,
      scatterTarget: { tx: 2, ty: 0 },
      speed: baseSpeed,
      moveTimer: 30,
    },
    {
      x: 9 * TILE,
      y: 9 * TILE,
      dir: DIRS.up,
      color: "#00FFFF",
      mode: "scatter",
      frightenTimer: 0,
      scatterTarget: { tx: 16, ty: 21 },
      speed: baseSpeed,
      moveTimer: 60,
    },
    {
      x: 10 * TILE,
      y: 9 * TILE,
      dir: DIRS.right,
      color: "#FFB847",
      mode: "scatter",
      frightenTimer: 0,
      scatterTarget: { tx: 2, ty: 21 },
      speed: baseSpeed,
      moveTimer: 90,
    },
  ];
}

function createInitialState(level = 1): GameState {
  const maze = deepCopyMaze(MAZE_TEMPLATE);
  return {
    maze,
    pacX: 9 * TILE,
    pacY: 16 * TILE,
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
    deathTimer: 0,
  };
}

function tileAt(maze: number[][], col: number, row: number): number {
  if (row < 0 || row >= maze.length) return 0;
  if (col < 0 || col >= COLS) return 0;
  return maze[row][col];
}

function isPassable(maze: number[][], col: number, row: number): boolean {
  return tileAt(maze, col, row) !== 1;
}

function canMoveDir(
  maze: number[][],
  px: number,
  py: number,
  dir: Dir,
): boolean {
  if (dir.x === 0 && dir.y === 0) return false;
  const nx = px + dir.x * 2;
  const ny = py + dir.y * 2;
  const col = Math.round(nx / TILE);
  const row = Math.round(ny / TILE);
  return isPassable(maze, col, row);
}

function snapToGrid(val: number): number {
  return Math.round(val / TILE) * TILE;
}

function isGridAligned(px: number, py: number, threshold = 4): boolean {
  return (
    Math.abs(px - snapToGrid(px)) < threshold &&
    Math.abs(py - snapToGrid(py)) < threshold
  );
}

function getGhostChaseTarget(state: GameState): { tx: number; ty: number } {
  return {
    tx: Math.round(state.pacX / TILE),
    ty: Math.round(state.pacY / TILE),
  };
}

function pickGhostDir(ghost: Ghost, state: GameState): Dir {
  const target =
    ghost.mode === "scatter"
      ? ghost.scatterTarget
      : ghost.mode === "frightened"
        ? {
            tx: Math.floor(Math.random() * COLS),
            ty: Math.floor(Math.random() * 22),
          }
        : getGhostChaseTarget(state);

  const col = Math.round(ghost.x / TILE);
  const row = Math.round(ghost.y / TILE);
  const reverse = { x: -ghost.dir.x, y: -ghost.dir.y };

  let bestDir = ghost.dir;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const d of [DIRS.up, DIRS.down, DIRS.left, DIRS.right]) {
    if (d.x === reverse.x && d.y === reverse.y) continue;
    const nc = col + d.x;
    const nr = row + d.y;
    if (!isPassable(state.maze, nc, nr)) continue;
    const dist = (nc - target.tx) ** 2 + (nr - target.ty) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestDir = d;
    }
  }
  return bestDir;
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

  const resetAfterDeath = useCallback((state: GameState) => {
    state.pacX = 9 * TILE;
    state.pacY = 16 * TILE;
    state.pacDir = DIRS.none;
    state.pacNextDir = DIRS.left;
    state.ghosts = initGhosts(state.level);
    state.powerActive = false;
    state.powerTimer = 0;
  }, []);

  // ── Drawing helpers ──────────────────────────────────
  const drawMaze = useCallback(
    (ctx: CanvasRenderingContext2D, maze: number[][], frame: number) => {
      for (let row = 0; row < maze.length; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = maze[row][col];
          const x = col * TILE;
          const y = row * TILE;

          if (cell === 1) {
            ctx.fillStyle = "#0a0a2e";
            ctx.fillRect(x, y, TILE, TILE);
            ctx.strokeStyle = "#1a1a6e";
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          } else {
            ctx.fillStyle = "#050510";
            ctx.fillRect(x, y, TILE, TILE);
          }

          if (cell === 2) {
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = "#ffeebb";
            ctx.fill();
          } else if (cell === 3) {
            const pulse = 3.5 + Math.sin(frame * 0.1) * 1.5;
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2, pulse, 0, Math.PI * 2);
            const grd = ctx.createRadialGradient(
              x + TILE / 2,
              y + TILE / 2,
              0,
              x + TILE / 2,
              y + TILE / 2,
              pulse,
            );
            grd.addColorStop(0, "#ffffff");
            grd.addColorStop(0.6, "#ffffaa");
            grd.addColorStop(1, "transparent");
            ctx.fillStyle = grd;
            ctx.fill();
          }
        }
      }
    },
    [],
  );

  const drawPacman = useCallback(
    (ctx: CanvasRenderingContext2D, state: GameState) => {
      const { pacX, pacY, pacDir, pacMouthAngle } = state;
      const cx = pacX + TILE / 2;
      const cy = pacY + TILE / 2;
      const r = TILE / 2 - 2;
      const startAngle = pacMouthAngle * Math.PI;
      const endAngle = (2 - pacMouthAngle) * Math.PI;

      let rotation = 0;
      if (pacDir.x === 1) rotation = 0;
      else if (pacDir.x === -1) rotation = Math.PI;
      else if (pacDir.y === -1) rotation = -Math.PI / 2;
      else if (pacDir.y === 1) rotation = Math.PI / 2;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.closePath();
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grd.addColorStop(0, "#fff176");
      grd.addColorStop(0.7, "#ffd700");
      grd.addColorStop(1, "#e6ac00");
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    },
    [],
  );

  const drawGhostEyes = useCallback(
    (ctx: CanvasRenderingContext2D, ghost: Ghost) => {
      const cx = ghost.x + TILE / 2;
      const y = ghost.y + 2;
      const h = TILE - 4;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(cx - 5, y + h / 3, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 5, y + h / 3, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0000cc";
      ctx.beginPath();
      ctx.ellipse(
        cx - 5 + ghost.dir.x * 2,
        y + h / 3 + ghost.dir.y * 2,
        2.5,
        3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        cx + 5 + ghost.dir.x * 2,
        y + h / 3 + ghost.dir.y * 2,
        2.5,
        3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    },
    [],
  );

  const drawGhost = useCallback(
    (ctx: CanvasRenderingContext2D, ghost: Ghost) => {
      if (ghost.mode === "eaten") {
        drawGhostEyes(ctx, ghost);
        return;
      }

      const x = ghost.x + 2;
      const y = ghost.y + 2;
      const w = TILE - 4;
      const h = TILE - 4;
      const cx = ghost.x + TILE / 2;

      let color = ghost.color;
      if (ghost.mode === "frightened") {
        const flashing =
          ghost.frightenTimer < 120 &&
          Math.floor(ghost.frightenTimer / 15) % 2 === 0;
        color = flashing ? "#ffffff" : "#0000cc";
      }

      ctx.save();
      if (ghost.mode !== "frightened") {
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, y + w / 2, w / 2, Math.PI, 0, false);
      ctx.lineTo(x + w, y + h);
      const waveW = w / 3;
      ctx.lineTo(x + w - waveW / 2, y + h - 5);
      ctx.lineTo(x + w - waveW, y + h);
      ctx.lineTo(x + waveW / 2 + waveW / 2, y + h - 5);
      ctx.lineTo(x + waveW, y + h);
      ctx.lineTo(x + waveW / 2, y + h - 5);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      if (ghost.mode === "frightened") {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx - 5, y + h / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 5, y + h / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 6, y + h / 2 + 4);
        ctx.lineTo(cx - 3, y + h / 2 + 2);
        ctx.lineTo(cx, y + h / 2 + 4);
        ctx.lineTo(cx + 3, y + h / 2 + 2);
        ctx.lineTo(cx + 6, y + h / 2 + 4);
        ctx.stroke();
      } else {
        drawGhostEyes(ctx, ghost);
      }
      ctx.restore();
    },
    [drawGhostEyes],
  );

  const drawHUD = useCallback(
    (ctx: CanvasRenderingContext2D, state: GameState) => {
      ctx.fillStyle = "#050510";
      ctx.fillRect(0, 0, CANVAS_W, HUD_HEIGHT);
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.fillText(`SCORE: ${state.score}`, 10, 18);
      ctx.fillStyle = "#00ffff";
      ctx.fillText(`LVL ${state.level}`, CANVAS_W / 2 - 22, 18);
      ctx.fillStyle = "#ffd700";
      const heartsStr =
        state.lives > 0 ? "♥".repeat(Math.min(state.lives, 5)) : "";
      ctx.fillText(heartsStr, CANVAS_W - 10 - heartsStr.length * 12, 18);
    },
    [],
  );

  const drawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, state: GameState, frame: number) => {
      if (state.gameStatus === "dying") {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, CANVAS_W, MAZE_TEMPLATE.length * TILE);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 28px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("OUCH!", CANVAS_W / 2, (MAZE_TEMPLATE.length * TILE) / 2);
        ctx.textAlign = "left";
      } else if (state.gameStatus === "levelclear") {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, CANVAS_W, MAZE_TEMPLATE.length * TILE);
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 24px 'JetBrains Mono', monospace";
        ctx.fillText(
          `LEVEL ${state.level - 1} CLEAR!`,
          CANVAS_W / 2,
          (MAZE_TEMPLATE.length * TILE) / 2 - 10,
        );
        ctx.fillStyle = "#00ffff";
        ctx.font = "16px 'JetBrains Mono', monospace";
        ctx.fillText(
          "GET READY...",
          CANVAS_W / 2,
          (MAZE_TEMPLATE.length * TILE) / 2 + 20,
        );
        ctx.textAlign = "left";
      }
      // suppress unused warning
      void frame;
    },
    [],
  );

  // ── Game update logic ────────────────────────────────
  const update = useCallback(
    (dt: number) => {
      const state = stateRef.current;
      const frame = frameRef.current;
      if (state.gameStatus === "gameover") return;

      if (state.gameStatus === "dying") {
        state.deathTimer -= dt;
        if (state.deathTimer <= 0) {
          state.lives--;
          onLivesUpdate(state.lives);
          if (state.lives <= 0) {
            state.gameStatus = "gameover";
            onGameOver(state.score);
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
        state.deathTimer -= dt;
        if (state.deathTimer <= 0) {
          const nextLevel = state.level; // already incremented
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

      // Pacman mouth animation
      if (state.pacDir.x !== 0 || state.pacDir.y !== 0) {
        if (state.pacMouthOpen) {
          state.pacMouthAngle = Math.max(0.02, state.pacMouthAngle - 0.04);
          if (state.pacMouthAngle <= 0.02) state.pacMouthOpen = false;
        } else {
          state.pacMouthAngle = Math.min(0.4, state.pacMouthAngle + 0.04);
          if (state.pacMouthAngle >= 0.4) state.pacMouthOpen = true;
        }
      } else {
        state.pacMouthAngle = 0.25;
      }

      // Read input
      if (keysRef.current.has("ArrowUp") || keysRef.current.has("w"))
        state.pacNextDir = DIRS.up;
      else if (keysRef.current.has("ArrowDown") || keysRef.current.has("s"))
        state.pacNextDir = DIRS.down;
      else if (keysRef.current.has("ArrowLeft") || keysRef.current.has("a"))
        state.pacNextDir = DIRS.left;
      else if (keysRef.current.has("ArrowRight") || keysRef.current.has("d"))
        state.pacNextDir = DIRS.right;

      const speed = PACMAN_SPEED * (dt / 16);
      const aligned = isGridAligned(state.pacX, state.pacY);

      if (aligned) {
        if (canMoveDir(state.maze, state.pacX, state.pacY, state.pacNextDir)) {
          state.pacDir = state.pacNextDir;
          state.pacX = snapToGrid(state.pacX);
          state.pacY = snapToGrid(state.pacY);
        }
      }

      if (canMoveDir(state.maze, state.pacX, state.pacY, state.pacDir)) {
        state.pacX += state.pacDir.x * speed;
        state.pacY += state.pacDir.y * speed;
        if (state.pacX < -TILE) state.pacX = COLS * TILE;
        if (state.pacX > COLS * TILE) state.pacX = -TILE;
      } else if (aligned) {
        state.pacX = snapToGrid(state.pacX);
        state.pacY = snapToGrid(state.pacY);
      }

      // Eat pellets
      const pacCol = Math.round(state.pacX / TILE);
      const pacRow = Math.round(state.pacY / TILE);
      if (
        pacRow >= 0 &&
        pacRow < state.maze.length &&
        pacCol >= 0 &&
        pacCol < COLS
      ) {
        const cell = state.maze[pacRow][pacCol];
        if (cell === 2) {
          state.maze[pacRow][pacCol] = 0;
          state.score += 10;
          state.pelletsLeft--;
          onScoreUpdate(state.score);
        } else if (cell === 3) {
          state.maze[pacRow][pacCol] = 0;
          state.score += 50;
          state.pelletsLeft--;
          onScoreUpdate(state.score);
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
        state.deathTimer = 180;
        state.level++;
        setGameStatus("levelclear");
        return;
      }

      // Power timer
      if (state.powerActive) {
        state.powerTimer -= dt / 16;
        if (state.powerTimer <= 0) {
          state.powerActive = false;
          for (const g of state.ghosts) {
            if (g.mode === "frightened") g.mode = "chase";
          }
        }
      }

      // Ghost updates
      for (const ghost of state.ghosts) {
        if (ghost.mode === "frightened") {
          ghost.frightenTimer -= dt / 16;
          if (ghost.frightenTimer <= 0) ghost.mode = "chase";
        }

        ghost.moveTimer -= dt / 16;
        if (ghost.moveTimer > 0) continue;

        const ghostSpeed =
          ghost.mode === "frightened"
            ? ghost.speed * 0.6
            : ghost.mode === "eaten"
              ? ghost.speed * 2
              : ghost.speed;
        const step = ghostSpeed * (dt / 16);

        if (isGridAligned(ghost.x, ghost.y, 6)) {
          ghost.dir = pickGhostDir(ghost, state);
          ghost.x = snapToGrid(ghost.x);
          ghost.y = snapToGrid(ghost.y);
        }

        const nx = ghost.x + ghost.dir.x * step;
        const ny = ghost.y + ghost.dir.y * step;
        if (
          isPassable(state.maze, Math.round(nx / TILE), Math.round(ny / TILE))
        ) {
          ghost.x = nx;
          ghost.y = ny;
          if (ghost.x < -TILE) ghost.x = COLS * TILE;
          if (ghost.x > COLS * TILE) ghost.x = -TILE;
        } else {
          const valids = [DIRS.up, DIRS.down, DIRS.left, DIRS.right].filter(
            (d) => {
              return isPassable(
                state.maze,
                Math.round(ghost.x / TILE) + d.x,
                Math.round(ghost.y / TILE) + d.y,
              );
            },
          );
          if (valids.length > 0)
            ghost.dir = valids[Math.floor(Math.random() * valids.length)];
          ghost.x = snapToGrid(ghost.x);
          ghost.y = snapToGrid(ghost.y);
        }
      }

      // Collision
      for (const ghost of state.ghosts) {
        if (ghost.mode === "eaten") continue;
        const dx = Math.abs(ghost.x - state.pacX);
        const dy = Math.abs(ghost.y - state.pacY);
        if (dx < TILE * 0.65 && dy < TILE * 0.65) {
          if (ghost.mode === "frightened") {
            ghost.mode = "eaten";
            state.score += 200;
            onScoreUpdate(state.score);
            const respawnGhost = ghost;
            setTimeout(() => {
              respawnGhost.x = 9 * TILE;
              respawnGhost.y = 9 * TILE;
              respawnGhost.mode = "chase";
              respawnGhost.dir = DIRS.up;
            }, 3000);
          } else {
            state.gameStatus = "dying";
            state.deathTimer = 120;
            setGameStatus("dying");
            return;
          }
        }
      }

      void frame;
    },
    [onScoreUpdate, onGameOver, onLivesUpdate, resetAfterDeath],
  );

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const state = stateRef.current;
      const frame = frameRef.current;

      drawHUD(ctx, state);

      ctx.save();
      ctx.translate(0, HUD_HEIGHT);
      drawMaze(ctx, state.maze, frame);
      for (const ghost of state.ghosts) {
        drawGhost(ctx, ghost);
      }
      if (state.gameStatus !== "dying" || Math.floor(frame / 4) % 2 === 0) {
        drawPacman(ctx, state);
      }
      drawOverlay(ctx, state, frame);
      ctx.restore();
    },
    [drawHUD, drawMaze, drawGhost, drawPacman, drawOverlay],
  );

  // ── Main game loop ───────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stateRef.current = createInitialState(initialLevel);
    frameRef.current = 0;
    lastTimeRef.current = 0;

    const loop = (timestamp: number) => {
      const dt = lastTimeRef.current
        ? Math.min(timestamp - lastTimeRef.current, 33)
        : 16;
      lastTimeRef.current = timestamp;
      frameRef.current++;

      update(dt);
      draw(ctx);

      if (stateRef.current.gameStatus !== "gameover") {
        animRef.current = requestAnimationFrame(loop);
      }
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [update, draw, initialLevel]);

  // ── Keyboard input ───────────────────────────────────
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

  // ── Mobile D-pad ─────────────────────────────────────
  const handleDpad = useCallback((dir: string) => {
    keysRef.current.clear();
    if (dir === "up") keysRef.current.add("ArrowUp");
    else if (dir === "down") keysRef.current.add("ArrowDown");
    else if (dir === "left") keysRef.current.add("ArrowLeft");
    else if (dir === "right") keysRef.current.add("ArrowRight");
    setTimeout(() => keysRef.current.clear(), 200);
  }, []);

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
