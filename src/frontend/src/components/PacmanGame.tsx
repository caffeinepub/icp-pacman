import { useEffect, useRef, useState } from "react";

// ── Maze Layout ──────────────────────────────────────────
// 0=open  1=wall  2=pellet  3=power-pellet  4=ghost-house-interior  5=ghost-door(passable only by ghosts leaving)
const MAZE_TEMPLATE: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 3, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 3, 1],
  [1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 2, 1],
  [1, 2, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 1, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 2, 1, 1, 1, 0, 1, 0, 1, 1, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 0, 0, 5, 0, 0, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 4, 4, 4, 4, 4, 0, 1, 2, 1, 1, 1, 1],
  [0, 0, 0, 0, 2, 0, 0, 4, 4, 4, 4, 4, 0, 0, 2, 0, 0, 0, 0],
  [1, 1, 1, 1, 2, 1, 0, 4, 4, 4, 4, 4, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1],
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

// Ghost house bounds (the interior region)
const HOUSE_COL_MIN = 7;
const HOUSE_COL_MAX = 11;
const HOUSE_ROW_MIN = 9;
const HOUSE_ROW_MAX = 11;
const HOUSE_EXIT_COL = 9;
const HOUSE_EXIT_ROW = 8; // the door tile row

// Speeds in tiles/second
const PAC_SPEED = 7.0;
const GHOST_SPEED = 5.0;
const POWER_DURATION = 8;

type Dir = { x: number; y: number };
const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};
const DIR_LIST: Dir[] = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

interface Pos {
  x: number;
  y: number;
}

interface Ghost {
  pos: Pos;
  dir: Dir;
  color: string;
  mode: "house" | "exiting" | "chase" | "scatter" | "frightened" | "eaten";
  frightenTimer: number;
  scatterTarget: { tx: number; ty: number };
  releaseTimer: number; // seconds until ghost starts leaving house (0 = already out)
}

interface GameState {
  maze: number[][];
  pacPos: Pos;
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
  statusTimer: number;
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
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 1; // treat OOB as wall
  return maze[row][col];
}

// Pacman can walk on: open(0), pellet(2), power-pellet(3), door(5) -- NOT wall(1), NOT ghost-interior(4)
function pacPassable(maze: number[][], col: number, row: number): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1 && t !== 4;
}

// Ghosts in normal mode can walk on open/pellet/door tiles -- NOT walls, NOT ghost-interior (unless exiting)
function ghostPassableNormal(
  maze: number[][],
  col: number,
  row: number,
): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1 && t !== 4;
}

// Ghosts inside house or exiting can walk on everything except walls
function ghostPassableInHouse(
  maze: number[][],
  col: number,
  row: number,
): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1;
}

function initGhosts(_level: number): Ghost[] {
  return [
    {
      pos: { x: HOUSE_EXIT_COL, y: HOUSE_ROW_MIN }, // Blinky starts at top of house interior
      dir: DIRS.up,
      color: "#FF0000",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 17, ty: 0 },
      releaseTimer: 0, // exits immediately
    },
    {
      pos: { x: 9, y: 10 }, // Pinky inside house center
      dir: DIRS.up,
      color: "#FFB8FF",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 1, ty: 0 },
      releaseTimer: 5,
    },
    {
      pos: { x: 8, y: 10 }, // Inky inside house left
      dir: DIRS.down,
      color: "#00FFFF",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 17, ty: 21 },
      releaseTimer: 10,
    },
    {
      pos: { x: 10, y: 10 }, // Clyde inside house right
      dir: DIRS.up,
      color: "#FFB847",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 1, ty: 21 },
      releaseTimer: 15,
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

// Is pos within threshold tiles of its nearest tile center?
function isTileAligned(pos: Pos, threshold = 0.15): boolean {
  return (
    Math.abs(pos.x - Math.round(pos.x)) < threshold &&
    Math.abs(pos.y - Math.round(pos.y)) < threshold
  );
}

function snapToTile(pos: Pos): Pos {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

// Can the entity at `pos` move one step in `dir` next frame?
// Uses the tile center of the current position.
function canMoveDir(
  maze: number[][],
  pos: Pos,
  dir: Dir,
  isGhost: boolean,
): boolean {
  if (dir.x === 0 && dir.y === 0) return false;
  const col = Math.round(pos.x) + dir.x;
  const row = Math.round(pos.y) + dir.y;
  return isGhost
    ? ghostPassableNormal(maze, col, row)
    : pacPassable(maze, col, row);
}

// Ghost AI: pick the best direction from the current tile
function pickGhostDir(ghost: Ghost, state: GameState): Dir {
  const col = Math.round(ghost.pos.x);
  const row = Math.round(ghost.pos.y);
  const reverse: Dir = { x: -ghost.dir.x, y: -ghost.dir.y };

  const target =
    ghost.mode === "scatter"
      ? { tx: ghost.scatterTarget.tx, ty: ghost.scatterTarget.ty }
      : ghost.mode === "frightened"
        ? {
            tx: Math.floor(Math.random() * COLS),
            ty: Math.floor(Math.random() * ROWS),
          }
        : { tx: Math.round(state.pacPos.x), ty: Math.round(state.pacPos.y) };

  let bestDir: Dir | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const d of DIR_LIST) {
    // Don't reverse unless forced
    if (d.x === reverse.x && d.y === reverse.y) continue;
    const nc = col + d.x;
    const nr = row + d.y;
    if (!ghostPassableNormal(state.maze, nc, nr)) continue;
    const dist = (nc - target.tx) ** 2 + (nr - target.ty) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestDir = d;
    }
  }

  // If stuck (only reverse available), allow it
  if (!bestDir) {
    if (ghostPassableNormal(state.maze, col + reverse.x, row + reverse.y)) {
      return reverse;
    }
    return DIRS.none;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional single-run game loop
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

    function drawGhostHouseBox(c: CanvasRenderingContext2D) {
      // Draw a visible bordered box around the ghost house
      const x = HOUSE_COL_MIN * TILE;
      const y = HOUSE_ROW_MIN * TILE;
      const w = (HOUSE_COL_MAX - HOUSE_COL_MIN + 1) * TILE;
      const h = (HOUSE_ROW_MAX - HOUSE_ROW_MIN + 1) * TILE;

      // Filled background
      c.fillStyle = "#0d0d2b";
      c.fillRect(x, y, w, h);

      // Outer glow border
      c.strokeStyle = "#ff69b4";
      c.lineWidth = 2.5;
      c.shadowColor = "#ff69b4";
      c.shadowBlur = 8;
      c.strokeRect(x + 1, y + 1, w - 2, h - 2);
      c.shadowBlur = 0;

      // Door indicator (top center)
      const doorX = HOUSE_EXIT_COL * TILE;
      const doorY = HOUSE_EXIT_ROW * TILE;
      c.fillStyle = "#ff69b4";
      c.fillRect(doorX, doorY + TILE * 0.35, TILE, TILE * 0.3);
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
          } else if (cell === 4) {
            // Ghost house interior -- skip, drawn by drawGhostHouseBox
          } else if (cell === 5) {
            // Ghost door tile -- open corridor background
            c.fillStyle = "#050510";
            c.fillRect(px, py, TILE, TILE);
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

      // Draw ghost house box on top
      drawGhostHouseBox(c);
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
      const cx2 = px + TILE / 2;

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
      c.arc(cx2, y + w / 2, w / 2, Math.PI, 0, false);
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
        c.arc(cx2 - 5, y + h / 2 - 2, 3, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.arc(cx2 + 5, y + h / 2 - 2, 3, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#ffffff";
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(cx2 - 6, y + h / 2 + 4);
        c.lineTo(cx2 - 3, y + h / 2 + 2);
        c.lineTo(cx2, y + h / 2 + 4);
        c.lineTo(cx2 + 3, y + h / 2 + 2);
        c.lineTo(cx2 + 6, y + h / 2 + 4);
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

    function updateGhost(ghost: Ghost, state: GameState, dt: number) {
      // ── HOUSE: bounce and wait for release ──
      if (ghost.mode === "house") {
        ghost.releaseTimer -= dt;
        const step = GHOST_SPEED * 0.4 * dt;
        const col = Math.round(ghost.pos.x);
        const row = Math.round(ghost.pos.y);
        const nd = ghost.dir.y !== 0 ? ghost.dir : DIRS.up;

        // Bounce within the house rows -- clamp strictly to house bounds
        const nextY = ghost.pos.y + nd.y * step;
        if (
          nextY >= HOUSE_ROW_MIN &&
          nextY <= HOUSE_ROW_MAX &&
          ghostPassableInHouse(state.maze, col, row + nd.y)
        ) {
          ghost.pos = { x: ghost.pos.x, y: nextY };
        } else {
          // Hit a boundary: reverse and clamp
          ghost.dir = { x: 0, y: -nd.y };
          ghost.pos.y = Math.max(
            HOUSE_ROW_MIN,
            Math.min(HOUSE_ROW_MAX, ghost.pos.y),
          );
        }

        if (ghost.releaseTimer <= 0) {
          ghost.mode = "exiting";
          ghost.dir = DIRS.up;
        }
        return;
      }

      // ── EXITING: navigate to exit position then leave ──
      if (ghost.mode === "exiting") {
        const step = GHOST_SPEED * dt;
        const col = ghost.pos.x;
        const row = ghost.pos.y;
        const targetCol = HOUSE_EXIT_COL;
        const targetRow = HOUSE_EXIT_ROW - 1; // one tile above the door

        // First align column
        if (Math.abs(col - targetCol) > 0.05) {
          const dx = col < targetCol ? 1 : -1;
          ghost.pos = { x: ghost.pos.x + dx * step, y: ghost.pos.y };
          if (Math.abs(ghost.pos.x - targetCol) < step) ghost.pos.x = targetCol;
          ghost.dir = dx > 0 ? DIRS.right : DIRS.left;
          return;
        }

        // Column is aligned: move up to exit row
        ghost.pos.x = targetCol; // keep aligned
        if (row > targetRow) {
          ghost.pos = {
            x: ghost.pos.x,
            y: Math.max(targetRow, ghost.pos.y - step),
          };
          ghost.dir = DIRS.up;
          return;
        }

        // Reached exit position: now fully outside
        ghost.pos = { x: targetCol, y: targetRow };
        ghost.mode = "scatter";
        ghost.dir = DIRS.left;
        return;
      }

      // ── FRIGHTENED timer ──
      if (ghost.mode === "frightened") {
        ghost.frightenTimer -= dt;
        if (ghost.frightenTimer <= 0) ghost.mode = "chase";
      }

      const speed =
        ghost.mode === "eaten"
          ? GHOST_SPEED * 2
          : ghost.mode === "frightened"
            ? GHOST_SPEED * 0.55
            : GHOST_SPEED;
      const ghostStep = speed * dt;

      // At tile boundary: pick new direction
      if (isTileAligned(ghost.pos)) {
        ghost.pos = snapToTile(ghost.pos);
        ghost.dir = pickGhostDir(ghost, state);
      }

      if (ghost.dir.x === 0 && ghost.dir.y === 0) return;

      const col = Math.round(ghost.pos.x);
      const row = Math.round(ghost.pos.y);

      if (ghost.dir.x !== 0) {
        const nx = ghost.pos.x + ghost.dir.x * ghostStep;
        const nCol = Math.round(nx);
        if (nCol !== col && !ghostPassableNormal(state.maze, nCol, row)) {
          ghost.pos.x = col;
          ghost.dir = pickGhostDir(ghost, state);
        } else {
          ghost.pos.x = nx;
        }
      } else {
        const ny = ghost.pos.y + ghost.dir.y * ghostStep;
        const nRow = Math.round(ny);
        if (nRow !== row && !ghostPassableNormal(state.maze, col, nRow)) {
          ghost.pos.y = row;
          ghost.dir = pickGhostDir(ghost, state);
        } else {
          ghost.pos.y = ny;
        }
      }

      // Tunnel wrap
      if (ghost.pos.x < -0.5) ghost.pos.x = COLS - 0.5;
      if (ghost.pos.x > COLS - 0.5) ghost.pos.x = -0.5;
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

      // At a tile center: try to change direction
      if (isTileAligned(state.pacPos)) {
        state.pacPos = snapToTile(state.pacPos);
        // Accept queued direction if passable
        if (canMoveDir(state.maze, state.pacPos, state.pacNextDir, false)) {
          state.pacDir = state.pacNextDir;
        }
      }

      // Move in current direction
      if (canMoveDir(state.maze, state.pacPos, state.pacDir, false)) {
        const col = Math.round(state.pacPos.x);
        const row = Math.round(state.pacPos.y);

        if (state.pacDir.x !== 0) {
          const nx = state.pacPos.x + state.pacDir.x * pacStep;
          const nCol = Math.round(nx);
          if (nCol !== col && !pacPassable(state.maze, nCol, row)) {
            state.pacPos.x = col; // snap to tile center, stop moving
          } else {
            state.pacPos.x = nx;
          }
        } else if (state.pacDir.y !== 0) {
          const ny = state.pacPos.y + state.pacDir.y * pacStep;
          const nRow = Math.round(ny);
          if (nRow !== row && !pacPassable(state.maze, col, nRow)) {
            state.pacPos.y = row;
          } else {
            state.pacPos.y = ny;
          }
        }

        // Tunnel wrap
        if (state.pacPos.x < -0.5) state.pacPos.x = COLS - 0.5;
        if (state.pacPos.x > COLS - 0.5) state.pacPos.x = -0.5;
      } else {
        // Can't move in current direction -- snap to nearest tile center to prevent mid-tile stall
        state.pacPos = snapToTile(state.pacPos);
      }

      // ── Pacman mouth animation ──
      if (state.pacDir.x !== 0 || state.pacDir.y !== 0) {
        const mspeed = 4 * dt;
        if (state.pacMouthOpen) {
          state.pacMouthAngle = Math.max(0.02, state.pacMouthAngle - mspeed);
          if (state.pacMouthAngle <= 0.02) state.pacMouthOpen = false;
        } else {
          state.pacMouthAngle = Math.min(0.4, state.pacMouthAngle + mspeed);
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
            if (
              g.mode !== "eaten" &&
              g.mode !== "house" &&
              g.mode !== "exiting"
            ) {
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
        updateGhost(ghost, state, dt);
      }

      // ── Collision detection ──
      for (const ghost of state.ghosts) {
        if (
          ghost.mode === "eaten" ||
          ghost.mode === "house" ||
          ghost.mode === "exiting"
        )
          continue;
        const dx = Math.abs(ghost.pos.x - state.pacPos.x);
        const dy = Math.abs(ghost.pos.y - state.pacPos.y);
        if (dx < 0.65 && dy < 0.65) {
          if (ghost.mode === "frightened") {
            ghost.mode = "eaten";
            state.score += 200;
            onScoreUpdateRef.current(state.score);
            // Return ghost to house after delay
            const g = ghost;
            setTimeout(() => {
              g.pos = { x: 9, y: 10 };
              g.mode = "house";
              g.dir = DIRS.up;
              g.releaseTimer = 3;
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
        ? Math.min((timestamp - lastTimeRef.current) / 1000, 0.05)
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
