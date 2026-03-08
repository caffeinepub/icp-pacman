import { beforeEach, describe, expect, it } from "vitest";
import {
  DIRS,
  DT_MAX,
  type GameState,
  HOUSE_ROW_MAX,
  HOUSE_ROW_MIN,
  PAC_SPEED,
  canMoveDir,
  createInitialState,
  isTileAligned,
  stepGhostHouse,
  stepPacman,
} from "../pacmanLogic";

// ── Helpers ──────────────────────────────────────────────

/** Run N frames of Pacman movement at DT_MAX (worst-case step size). */
function runPacFrames(state: GameState, frames: number): void {
  for (let i = 0; i < frames; i++) {
    stepPacman(state, DT_MAX);
  }
}

// ── Tests ─────────────────────────────────────────────────

describe("isTileAligned", () => {
  it("returns true when pos is exactly on a tile center", () => {
    expect(isTileAligned({ x: 9, y: 16 })).toBe(true);
    expect(isTileAligned({ x: 0, y: 0 })).toBe(true);
  });

  it("returns true when pos is within the 0.15 threshold of a tile center", () => {
    // Default threshold is 0.15 -- positions within 0.14 of a tile center are aligned
    expect(isTileAligned({ x: 9 + 0.14, y: 16 })).toBe(true);
    expect(isTileAligned({ x: 9 - 0.14, y: 16 })).toBe(true);
    // Positions beyond the threshold are not aligned (handled by snap-on-blocked instead)
    expect(isTileAligned({ x: 9 + PAC_SPEED * DT_MAX, y: 16 })).toBe(false);
  });

  it("returns false when pos is more than 0.5 away from any tile center", () => {
    expect(isTileAligned({ x: 9.5, y: 16 })).toBe(false);
    expect(isTileAligned({ x: 9, y: 16.5 })).toBe(false);
  });
});

describe("Pacman movement - straight corridor", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
    // Start at (9, 16) -- verified open tile in the maze
    state.pacPos = { x: 9, y: 16 };
    state.pacDir = DIRS.left;
    state.pacNextDir = DIRS.left;
  });

  it("moves left along row 16 without getting stuck", () => {
    // Row 16 is a corridor: cols 1-8 are open
    // Run 30 frames (~1.5 seconds) -- Pacman should travel ~10 tiles
    const startX = state.pacPos.x;
    runPacFrames(state, 30);
    expect(state.pacPos.x).toBeLessThan(startX);
    // Must not be stuck at the start
    expect(state.pacPos.x).not.toBeCloseTo(startX, 1);
  });

  it("moves right along row 16 without getting stuck", () => {
    state.pacDir = DIRS.right;
    state.pacNextDir = DIRS.right;
    const startX = state.pacPos.x;
    runPacFrames(state, 30);
    expect(state.pacPos.x).toBeGreaterThan(startX);
    expect(state.pacPos.x).not.toBeCloseTo(startX, 1);
  });

  it("does not pass through a wall tile", () => {
    // Place Pacman one tile to the left of a wall and aim right into it
    // Row 16: col 15 is a wall (value 1), so aim from col 14 rightward
    state.pacPos = { x: 14, y: 16 };
    state.pacDir = DIRS.right;
    state.pacNextDir = DIRS.right;
    runPacFrames(state, 60); // 3 simulated seconds
    // Should be clamped at col 14 (wall at col 15 blocks)
    expect(state.pacPos.x).toBeLessThanOrEqual(14.5);
    expect(state.pacPos.x).toBeGreaterThanOrEqual(13.5);
  });

  it("position never lands on a wall tile after many frames", () => {
    state.pacDir = DIRS.left;
    state.pacNextDir = DIRS.left;
    for (let i = 0; i < 120; i++) {
      stepPacman(state, DT_MAX);
      const col = Math.round(state.pacPos.x);
      const row = Math.round(state.pacPos.y);
      const tile = state.maze[row]?.[col] ?? 1;
      expect(tile).not.toBe(1); // must not be on a wall
      expect(tile).not.toBe(4); // must not be on ghost interior
    }
  });
});

describe("Pacman movement - corner turning", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  it("turns at a corner when queued direction is passable at tile center", () => {
    // Row 20 col 2 is open; row 19 col 2 is open (value 2) and row 18 col 2 is open.
    // Place Pacman at col 4, moving left. Queue nextDir=up.
    // Pacman will move left, and at any tile center where row 19 col X is passable, it should turn up.
    // Col 2: maze[19][2] = 2 (open) -> turn accepted here.
    state.pacPos = { x: 4, y: 20 };
    state.pacDir = DIRS.left;
    state.pacNextDir = DIRS.up;

    // Run enough frames for Pacman to travel 2 tiles left (to col 2) and turn up
    // 2 tiles / 7 tiles/sec / 0.05 dt = ~6 frames; give extra margin
    runPacFrames(state, 30);

    // After reaching col 2 and turning, Pacman should be moving up
    const hasTurnedUp = state.pacDir.y === -1 || state.pacPos.y < 20;
    expect(hasTurnedUp).toBe(true);
  });

  it("does not turn into a wall when queued direction is blocked", () => {
    // Row 20, moving left. Queue direction = up at col 3 -- but col 3 row 19 is wall (value 1)
    state.pacPos = { x: 5, y: 20 };
    state.pacDir = DIRS.left;
    state.pacNextDir = DIRS.up; // will be rejected at col 3 because row 19, col 3 is wall

    // Run until Pacman reaches col 3
    for (let i = 0; i < 100; i++) {
      stepPacman(state, DT_MAX);
      if (Math.abs(state.pacPos.x - 3) < 0.5) break;
    }

    // Direction should still be left (up was rejected)
    expect(state.pacDir).toEqual(DIRS.left);
  });
});

describe("Ghost house containment", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  it("all 4 ghosts start in house mode or exit immediately", () => {
    // Blinky (index 0) has releaseTimer 0 so starts in house but exits first.
    // The rest start in house mode.
    const modes = state.ghosts.map((g) => g.mode);
    for (const mode of modes) {
      expect(mode).toBe("house");
    }
  });

  it("all ghost start positions are within or at the edge of the house row bounds", () => {
    for (const ghost of state.ghosts) {
      expect(ghost.pos.y).toBeGreaterThanOrEqual(HOUSE_ROW_MIN);
      expect(ghost.pos.y).toBeLessThanOrEqual(HOUSE_ROW_MAX);
    }
  });

  it("ghost bounce stays within house row bounds during wait phase", () => {
    const ghost = state.ghosts[1]; // Pinky, releaseTimer=5
    // Run 10 seconds of bouncing (200 frames at DT_MAX)
    for (let i = 0; i < 200; i++) {
      stepGhostHouse(ghost, state.maze, DT_MAX);
      // Even if releaseTimer fires, we still test containment while in house
      expect(ghost.pos.y).toBeGreaterThanOrEqual(HOUSE_ROW_MIN - 0.01);
      expect(ghost.pos.y).toBeLessThanOrEqual(HOUSE_ROW_MAX + 0.01);
    }
  });

  it("ghost transitions to exiting after releaseTimer expires", () => {
    const ghost = { ...state.ghosts[1], releaseTimer: 0.01 }; // almost expired
    const shouldExit = stepGhostHouse(ghost, state.maze, DT_MAX);
    expect(shouldExit).toBe(true);
  });

  it("ghost with releaseTimer > 0 does not exit early", () => {
    const ghost = { ...state.ghosts[2], releaseTimer: 9 }; // Inky, long wait
    const shouldExit = stepGhostHouse(ghost, state.maze, DT_MAX);
    expect(shouldExit).toBe(false);
  });
});

describe("Wall collision - canMoveDir", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState();
  });

  it("returns false when moving into a wall tile", () => {
    // Row 1, col 0 is wall. Pos at col 1, row 1 -- moving left hits wall at col 0.
    const pos = { x: 1, y: 1 };
    expect(canMoveDir(state.maze, pos, DIRS.left, false)).toBe(false);
  });

  it("returns true when moving into an open tile", () => {
    // Row 20, col 9 -- moving left to col 8 which is open
    const pos = { x: 9, y: 20 };
    expect(canMoveDir(state.maze, pos, DIRS.left, false)).toBe(true);
  });

  it("returns false when Pacman tries to enter ghost house interior", () => {
    // Col 8, row 10 is tile 4 (ghost interior) -- Pacman cannot enter
    const pos = { x: 8, y: 9 };
    expect(canMoveDir(state.maze, pos, DIRS.down, false)).toBe(false);
  });

  it("returns false for DIRS.none regardless of position", () => {
    const pos = { x: 9, y: 16 };
    expect(canMoveDir(state.maze, pos, DIRS.none, false)).toBe(false);
  });
});
