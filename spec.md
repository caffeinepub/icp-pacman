# ICP Pacman

## Current State
- Authorization uses `_initializeAccessControlWithSecret` with a token from env var — callers must know the secret to become admin.
- `startGame` always increments jackpotBalance (simulated payment) for all callers.
- Frontend always shows the payment confirmation dialog before starting a game.
- Header shows the principal but no admin indicator.

## Requested Changes (Diff)

### Add
- Backend: a `registerCaller` function (or inline logic in `startGame`) that auto-assigns #admin to the very first non-anonymous principal that calls it, and #user to everyone after.
- Backend: `isAdminFreePlay` check in `startGame` — if caller is admin, skip the jackpotBalance increment (free play), still return `{ ok = true }`.
- Frontend: query `isCallerAdmin()` after login and cache result in state.
- Frontend: when admin clicks Play, skip the payment dialog and go straight to `startGame` / playing phase.
- Frontend: show a "FREE PLAY" badge on the Play button and game area when caller is admin.

### Modify
- Backend `startGame`: add auto-registration of first-time callers (first = admin, rest = user), and bypass payment for admin.
- `access-control.mo` `initialize`: change so it does NOT require an adminToken match — the very first caller automatically becomes admin regardless.
- Frontend `GamePage`: detect `isAdmin` prop/state; if true, skip `setPhase("confirming")` and call `handleConfirmStart` directly.
- Frontend `Header`: optionally show a small "ADMIN" badge next to principal when caller is admin.

### Remove
- Dependency on `_initializeAccessControlWithSecret` for first-time admin assignment (replaced by auto-first-login logic).

## Implementation Plan
1. Update `access-control.mo`: remove token-check requirement so first non-anonymous caller always becomes admin.
2. Update `main.mo` `startGame`: call `AccessControl.initialize` to auto-register caller, then check `isAdmin` to decide whether to increment jackpot.
3. Update `GamePage.tsx`: fetch `isCallerAdmin` after actor is ready + logged in; store in state. If admin, `handlePlayClick` bypasses confirmation dialog and calls `handleConfirmStart` directly. Show "FREE PLAY" on the button.
4. Update `Header.tsx`: show "ADMIN" badge next to principal when `isAdmin` is true.
