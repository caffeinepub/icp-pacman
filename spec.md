# ICP Pacman

## Current State

Full-stack ICP Pacman game with:
- Canvas-based Pacman game (PacmanGame.tsx) with ghosts, pellets, power pellets, lives, levels
- Internet Identity login with first-login admin auto-assignment
- Admin plays free; regular users pay 25 cents per play (5/25/70 split)
- Live leaderboard (top 20, auto-refresh)
- Admin panel with jackpot management, payout wallet config, countdown timer

Known bugs in PacmanGame.tsx:
1. `isTileAligned` threshold is 0.15, but max step size is PAC_SPEED * dt_max = 7.0 * 0.05 = 0.35 tiles -- Pacman overshoots tile centers and never re-aligns, causing him to get stuck at walls
2. Blinky is initialized at `y: HOUSE_EXIT_ROW - 1 = 7`, which is row 7 (open maze corridor), not inside the ghost house (rows 9-11)
3. Ghost house bounce logic uses `ghostPassableInHouse` without clamping to `HOUSE_ROW_MIN/MAX`, so ghosts can drift out of the house during their wait phase
4. No automated tests -- regressions slip through undetected

## Requested Changes (Diff)

### Add
- `src/frontend/src/game/__tests__/pacmanGame.test.ts`: vitest unit tests covering:
  - Pacman straight-line movement in a corridor
  - Pacman turning at a corner (queued direction accepted at tile center)
  - Pacman blocked by a wall (does not pass through)
  - Ghost house containment (all non-Blinky ghosts start in house, stay inside until release timer expires)
  - `isTileAligned` with the corrected threshold
- `src/frontend/src/game/pacmanLogic.ts`: pure logic extracted from PacmanGame.tsx (maze helpers, isTileAligned, canMoveDir, updatePacman step, ghost house bounce) so tests can import without a DOM/canvas

### Modify
- `PacmanGame.tsx`:
  - `isTileAligned` threshold: `0.15` → `0.5`
  - Blinky start position: `y: HOUSE_EXIT_ROW - 1` (row 7) → `y: HOUSE_ROW_MIN` (row 9, just inside the house top), mode: `"scatter"` → `"house"`, releaseTimer: `0` → `0` (immediate release so he exits first)
  - Ghost bounce in `updateGhost` house phase: clamp `ghost.pos.y` to `[HOUSE_ROW_MIN, HOUSE_ROW_MAX]` to prevent drift
  - Import pure logic from `pacmanLogic.ts` instead of duplicating it

### Remove
- Nothing removed from user-visible features

## Implementation Plan

1. Create `src/frontend/src/game/pacmanLogic.ts` with exported pure functions: `MAZE_TEMPLATE`, constants, `tileAt`, `pacPassable`, `ghostPassableInHouse`, `isTileAligned`, `snapToTile`, `canMoveDir`, `createInitialState`, `updatePacStep` (one dt step for pacman only), `updateGhostHouseBounce`
2. Update `PacmanGame.tsx` to import from `pacmanLogic.ts` and apply the three bug fixes in-place
3. Create `src/frontend/src/game/__tests__/pacmanGame.test.ts` using vitest with describe/it blocks for each scenario
4. Run `vitest run` to confirm all tests pass
5. Validate full build (typecheck + lint + build)
