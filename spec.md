# ICP Pacman

## Current State
Empty project shell. No backend logic, no frontend components, no game code.

## Requested Changes (Diff)

### Add
- Full Pacman game playable in browser (canvas-based, keyboard controls, ghosts, pellets, power pellets, score)
- Internet Identity authentication (login/logout)
- ICP payment: 25 cents per play, deducted on game start
- Revenue split per play: 5% to cycles wallet, 25% to jackpot pool, 70% to payout wallet
- Live leaderboard page showing top scores with player principal IDs
- Admin panel (admin-only, gated by principal ID) with:
  - Manual jackpot payout trigger
  - Countdown timer for automatic jackpot disbursement
  - View current jackpot balance
- Persistent payout countdown timer visible in top-right corner of all pages

### Modify
- Nothing (new project)

### Remove
- Nothing

## Implementation Plan
1. Backend (Motoko):
   - Player authentication via Internet Identity (principal-based)
   - Store leaderboard entries (principal, score, timestamp)
   - Track jackpot pool balance (ICP)
   - Track payment splits: cycles (5%), jackpot (25%), payout wallet (70%)
   - Record game sessions and payment status
   - Admin functions: set admin principal, trigger jackpot payout, set countdown timer
   - Query functions: getLeaderboard, getJackpot, getCountdown, isAdmin
   - Update functions: startGame (requires payment), submitScore, triggerPayout, setCountdown

2. Frontend:
   - Login/logout via Internet Identity
   - Home page with Pacman game canvas (keyboard + touch controls)
   - Game start requires login + payment confirmation
   - Game over screen with score submission
   - Leaderboard page (live, auto-refreshing)
   - Admin page (principal-gated): jackpot display, payout trigger, countdown setter
   - Global header with: logo, nav links, login/logout, payout timer (top-right)
