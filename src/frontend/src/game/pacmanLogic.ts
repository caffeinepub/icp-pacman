// Pure game logic extracted from PacmanGame.tsx for unit testing.
// No React, no canvas, no DOM dependencies.

// ── Maze Layout ──────────────────────────────────────────
// 0=open  1=wall  2=pellet  3=power-pellet  4=ghost-house-interior  5=ghost-door(passable only by ghosts leaving)
export const MAZE_TEMPLATE: number[][] = [
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

export const ROWS = MAZE_TEMPLATE.length;
export const COLS = 19;

// Ghost house bounds
export const HOUSE_COL_MIN = 7;
export const HOUSE_COL_MAX = 11;
export const HOUSE_ROW_MIN = 9;
export const HOUSE_ROW_MAX = 11;
export const HOUSE_EXIT_COL = 9;
export const HOUSE_EXIT_ROW = 8;

// Speeds in tiles/second
export const PAC_SPEED = 7.0;
export const GHOST_SPEED = 5.0;
export const DT_MAX = 0.05; // dt cap used in the game loop

export type Dir = { x: number; y: number };

export const DIRS: Record<string, Dir> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

export const DIR_LIST: Dir[] = [DIRS.up, DIRS.down, DIRS.left, DIRS.right];

export interface Pos {
  x: number;
  y: number;
}

export interface Ghost {
  pos: Pos;
  dir: Dir;
  color: string;
  mode: "house" | "exiting" | "chase" | "scatter" | "frightened" | "eaten";
  frightenTimer: number;
  scatterTarget: { tx: number; ty: number };
  releaseTimer: number;
}

export interface GameState {
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

export function deepCopyMaze(template: number[][]): number[][] {
  return template.map((row) => [...row]);
}

export function countPellets(maze: number[][]): number {
  let n = 0;
  for (const row of maze) for (const c of row) if (c === 2 || c === 3) n++;
  return n;
}

export function tileAt(maze: number[][], col: number, row: number): number {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 1;
  return maze[row][col];
}

export function pacPassable(
  maze: number[][],
  col: number,
  row: number,
): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1 && t !== 4;
}

export function ghostPassableNormal(
  maze: number[][],
  col: number,
  row: number,
): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1 && t !== 4;
}

export function ghostPassableInHouse(
  maze: number[][],
  col: number,
  row: number,
): boolean {
  const t = tileAt(maze, col, row);
  return t !== 1;
}

// Is pos within threshold tiles of its nearest tile center?
// Use 0.15 (smaller than max step 0.35) so we detect crossing precisely.
export function isTileAligned(pos: Pos, threshold = 0.15): boolean {
  return (
    Math.abs(pos.x - Math.round(pos.x)) < threshold &&
    Math.abs(pos.y - Math.round(pos.y)) < threshold
  );
}

export function snapToTile(pos: Pos): Pos {
  return { x: Math.round(pos.x), y: Math.round(pos.y) };
}

export function canMoveDir(
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

export function initGhosts(_level: number): Ghost[] {
  return [
    {
      pos: { x: HOUSE_EXIT_COL, y: HOUSE_ROW_MIN },
      dir: DIRS.up,
      color: "#FF0000",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 17, ty: 0 },
      releaseTimer: 0,
    },
    {
      pos: { x: 9, y: 10 },
      dir: DIRS.up,
      color: "#FFB8FF",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 1, ty: 0 },
      releaseTimer: 5,
    },
    {
      pos: { x: 8, y: 10 },
      dir: DIRS.down,
      color: "#00FFFF",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 17, ty: 21 },
      releaseTimer: 10,
    },
    {
      pos: { x: 10, y: 10 },
      dir: DIRS.up,
      color: "#FFB847",
      mode: "house",
      frightenTimer: 0,
      scatterTarget: { tx: 1, ty: 21 },
      releaseTimer: 15,
    },
  ];
}

export function createInitialState(level = 1): GameState {
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

/**
 * Advance Pacman's position by one dt step given a current direction.
 * Does not read keyboard -- caller sets pacDir and pacNextDir before calling.
 * Returns the updated pos (mutates state.pacPos in place and returns it).
 */
export function stepPacman(state: GameState, dt: number): Pos {
  const pacStep = PAC_SPEED * dt;

  // At a tile center: try to change direction
  if (isTileAligned(state.pacPos)) {
    state.pacPos = snapToTile(state.pacPos);
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
        state.pacPos.x = col; // snap to tile center on wall hit
      } else {
        state.pacPos.x = nx;
      }
    } else if (state.pacDir.y !== 0) {
      const ny = state.pacPos.y + state.pacDir.y * pacStep;
      const nRow = Math.round(ny);
      if (nRow !== row && !pacPassable(state.maze, col, nRow)) {
        state.pacPos.y = row; // snap to tile center on wall hit
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

  return state.pacPos;
}

/**
 * Advance a single ghost's house-bounce phase by dt.
 * Returns true if ghost should transition to "exiting".
 */
export function stepGhostHouse(
  ghost: Ghost,
  maze: number[][],
  dt: number,
): boolean {
  ghost.releaseTimer -= dt;
  const step = GHOST_SPEED * 0.4 * dt;
  const col = Math.round(ghost.pos.x);
  const row = Math.round(ghost.pos.y);
  const nd = ghost.dir.y !== 0 ? ghost.dir : DIRS.up;

  const nextY = ghost.pos.y + nd.y * step;
  if (
    nextY >= HOUSE_ROW_MIN &&
    nextY <= HOUSE_ROW_MAX &&
    ghostPassableInHouse(maze, col, row + nd.y)
  ) {
    ghost.pos = { x: ghost.pos.x, y: nextY };
  } else {
    ghost.dir = { x: 0, y: -nd.y };
    ghost.pos.y = Math.max(HOUSE_ROW_MIN, Math.min(HOUSE_ROW_MAX, ghost.pos.y));
  }

  return ghost.releaseTimer <= 0;
}
