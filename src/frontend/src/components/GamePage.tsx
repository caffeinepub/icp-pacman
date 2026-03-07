import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import PacmanGame from "./PacmanGame";

type GamePhase = "pregame" | "confirming" | "playing" | "gameover";

export default function GamePage() {
  const { actor, isFetching } = useActor();
  const { identity, login, isLoggingIn } = useInternetIdentity();
  const [phase, setPhase] = useState<GamePhase>("pregame");
  const [isStarting, setIsStarting] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentLives, setCurrentLives] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);

  const isLoggedIn = !!identity && !identity.getPrincipal().isAnonymous();

  // Fetch jackpot balance
  const { data: jackpotBalance, isLoading: jackpotLoading } = useQuery({
    queryKey: ["jackpotBalance"],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.getJackpotBalance();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });

  const jackpotICP = jackpotBalance ? Number(jackpotBalance) / 100_000_000 : 0;

  const handlePlayClick = () => {
    if (!isLoggedIn) {
      login();
      return;
    }
    setPhase("confirming");
  };

  const handleConfirmStart = async () => {
    if (!actor) return;
    setIsStarting(true);
    try {
      const result = await actor.startGame();
      if (result.ok) {
        setPhase("playing");
        setCurrentScore(0);
        setCurrentLives(3);
        setSubmitted(false);
        setCurrentLevel(1);
      } else {
        toast.error(`Failed to start game: ${result.message}`);
        setPhase("pregame");
      }
    } catch {
      toast.error("Failed to start game. Please try again.");
      setPhase("pregame");
    } finally {
      setIsStarting(false);
    }
  };

  const handleGameOver = useCallback((score: number) => {
    setFinalScore(score);
    setPhase("gameover");
  }, []);

  const handleScoreUpdate = useCallback((score: number) => {
    setCurrentScore(score);
  }, []);

  const handleLivesUpdate = useCallback((lives: number) => {
    setCurrentLives(lives);
  }, []);

  const handleSubmitScore = async () => {
    if (!actor || submitted) return;
    setIsSubmitting(true);
    try {
      await actor.submitScore(BigInt(finalScore));
      setSubmitted(true);
      toast.success(`Score of ${finalScore} submitted to leaderboard!`);
    } catch {
      toast.error("Failed to submit score.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePlayAgain = () => {
    setPhase("pregame");
    setFinalScore(0);
    setCurrentScore(0);
    setSubmitted(false);
  };

  // ── Pre-game ──────────────────────────────────────────
  if (phase === "pregame") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4 py-8 pixel-fade-in">
        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="font-arcade text-5xl md:text-7xl font-black text-pac-yellow neon-text tracking-widest">
            PAC-MAN
          </h1>
          <p className="font-arcade text-sm text-pac-blue tracking-widest">
            POWERED BY ICP BLOCKCHAIN
          </p>
        </div>

        {/* Ghost row decoration */}
        <div className="flex gap-6 text-4xl">
          <span
            className="ghost-blinky"
            style={{ filter: "drop-shadow(0 0 6px #ff0000)" }}
          >
            👻
          </span>
          <span className="text-pac-yellow text-5xl">🟡</span>
          <span
            className="ghost-pinky"
            style={{ filter: "drop-shadow(0 0 6px #ffb8ff)" }}
          >
            👻
          </span>
          <span
            className="ghost-inky"
            style={{ filter: "drop-shadow(0 0 6px #00ffff)" }}
          >
            👻
          </span>
          <span
            className="ghost-clyde"
            style={{ filter: "drop-shadow(0 0 6px #ffb847)" }}
          >
            👻
          </span>
        </div>

        {/* Jackpot display */}
        <div className="arcade-border rounded-xl px-8 py-5 text-center space-y-1 bg-pac-navy/60">
          <p className="font-arcade text-xs text-muted-foreground tracking-widest">
            JACKPOT POOL
          </p>
          {jackpotLoading || isFetching ? (
            <Skeleton className="h-10 w-40 mx-auto" />
          ) : (
            <p className="font-arcade text-4xl font-black jackpot-glow text-pac-gold">
              {jackpotICP.toFixed(4)} ICP
            </p>
          )}
          <p className="font-arcade text-xs text-muted-foreground">
            25% of each play goes to the jackpot
          </p>
        </div>

        {/* Play button */}
        <div className="text-center space-y-4">
          {isLoggedIn ? (
            <Button
              data-ocid="game.play_button"
              onClick={handlePlayClick}
              size="lg"
              className="font-arcade text-lg px-12 py-6 bg-pac-yellow text-pac-dark hover:bg-pac-yellow/90 font-black glow-yellow transition-all hover:scale-105 rounded-full"
            >
              ▶ PLAY NOW — 0.25 ICP
            </Button>
          ) : (
            <div className="space-y-3">
              <Button
                data-ocid="game.play_button"
                onClick={handlePlayClick}
                disabled={isLoggingIn}
                size="lg"
                className="font-arcade text-lg px-12 py-6 bg-pac-yellow text-pac-dark hover:bg-pac-yellow/90 font-black glow-yellow transition-all hover:scale-105 rounded-full"
              >
                {isLoggingIn ? "CONNECTING..." : "LOGIN TO PLAY"}
              </Button>
              <p className="font-arcade text-xs text-muted-foreground">
                Connect your Internet Identity to play
              </p>
            </div>
          )}

          {/* Cost breakdown */}
          <div className="font-arcade text-xs text-muted-foreground space-y-1">
            <p>0.25 ICP per play</p>
            <p className="flex items-center justify-center gap-3">
              <span className="text-pac-blue">5% → cycles</span>
              <span className="text-pac-gold">25% → jackpot</span>
              <span className="text-pac-cyan">70% → payout</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────
  if (phase === "playing") {
    return (
      <div className="flex flex-col items-center gap-4 py-6 px-4 pixel-fade-in">
        {/* Live stats bar */}
        <div className="flex items-center gap-6 font-arcade text-sm">
          <span className="text-pac-yellow">SCORE: {currentScore}</span>
          <span className="text-pac-cyan">
            LIVES: {"❤️".repeat(Math.max(0, currentLives))}
          </span>
          <span className="text-pac-blue">LEVEL: {currentLevel}</span>
        </div>
        <PacmanGame
          onScoreUpdate={handleScoreUpdate}
          onGameOver={handleGameOver}
          onLivesUpdate={handleLivesUpdate}
          initialLevel={currentLevel}
        />
      </div>
    );
  }

  // ── Game Over ──────────────────────────────────────────
  if (phase === "gameover") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 px-4 pixel-fade-in">
        <div className="text-center space-y-2">
          <h2
            className="font-arcade text-5xl font-black text-pac-red"
            style={{
              textShadow:
                "0 0 15px oklch(0.65 0.25 25), 0 0 30px oklch(0.65 0.25 25 / 0.4)",
            }}
          >
            GAME OVER
          </h2>
          <p className="font-arcade text-sm text-muted-foreground">
            BETTER LUCK NEXT TIME!
          </p>
        </div>

        {/* Score display */}
        <div className="arcade-border-yellow rounded-xl px-10 py-6 text-center bg-pac-navy/60">
          <p className="font-arcade text-xs text-muted-foreground mb-1">
            FINAL SCORE
          </p>
          <p className="font-arcade text-5xl font-black text-pac-yellow jackpot-glow">
            {finalScore.toLocaleString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {!submitted ? (
            <Button
              data-ocid="game.submit_score_button"
              onClick={handleSubmitScore}
              disabled={isSubmitting || !actor}
              size="lg"
              className="font-arcade px-8 py-4 bg-pac-blue hover:bg-pac-blue/80 text-white glow-blue rounded-full"
            >
              {isSubmitting ? "SUBMITTING..." : "📤 SUBMIT SCORE"}
            </Button>
          ) : (
            <div
              data-ocid="game.success_state"
              className="font-arcade text-sm text-pac-cyan px-6 py-3 border border-pac-cyan/40 rounded-full"
            >
              ✓ SCORE SUBMITTED!
            </div>
          )}
          <Button
            onClick={handlePlayAgain}
            variant="outline"
            size="lg"
            className="font-arcade px-8 py-4 border-pac-yellow/50 text-pac-yellow hover:bg-pac-yellow/10 rounded-full"
          >
            🔄 PLAY AGAIN
          </Button>
        </div>

        {/* High scores note */}
        <p className="font-arcade text-xs text-muted-foreground">
          CHECK THE LEADERBOARD TO SEE YOUR RANK
        </p>
      </div>
    );
  }

  // ── Payment Confirmation Dialog ────────────────────────
  return (
    <>
      {/* Show pregame behind dialog */}
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 px-4 py-8 opacity-30 blur-sm">
        <h1 className="font-arcade text-5xl font-black text-pac-yellow neon-text">
          PAC-MAN
        </h1>
      </div>

      <Dialog
        open={phase === "confirming"}
        onOpenChange={(open) => {
          if (!open) setPhase("pregame");
        }}
      >
        <DialogContent className="bg-pac-navy border-pac-blue/40 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-arcade text-pac-yellow text-xl text-center">
              READY TO PLAY?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Cost */}
            <div className="text-center">
              <p className="font-arcade text-3xl font-black text-pac-gold jackpot-glow">
                0.25 ICP
              </p>
              <p className="font-arcade text-xs text-muted-foreground mt-1">
                PER PLAY
              </p>
            </div>

            {/* Breakdown */}
            <div className="rounded-lg bg-muted/20 p-4 space-y-2 border border-border">
              <p className="font-arcade text-xs text-muted-foreground mb-3 text-center">
                PAYMENT BREAKDOWN
              </p>
              <div className="flex justify-between font-arcade text-xs">
                <span className="text-pac-blue">5% — Network Cycles</span>
                <span className="text-pac-blue">0.0125 ICP</span>
              </div>
              <div className="flex justify-between font-arcade text-xs">
                <span className="text-pac-gold">25% — Jackpot Pool</span>
                <span className="text-pac-gold">0.0625 ICP</span>
              </div>
              <div className="flex justify-between font-arcade text-xs">
                <span className="text-pac-cyan">70% — Payout Wallet</span>
                <span className="text-pac-cyan">0.175 ICP</span>
              </div>
            </div>

            <p className="font-arcade text-xs text-center text-muted-foreground">
              Payment is processed on the ICP blockchain.
              <br />
              Scores are recorded on-chain.
            </p>
          </div>

          <DialogFooter className="flex gap-3 sm:flex-row">
            <Button
              data-ocid="game.cancel_button"
              variant="outline"
              onClick={() => setPhase("pregame")}
              className="font-arcade flex-1 border-muted text-muted-foreground hover:bg-muted/20"
            >
              CANCEL
            </Button>
            <Button
              data-ocid="game.confirm_button"
              onClick={handleConfirmStart}
              disabled={isStarting || !actor}
              className="font-arcade flex-1 bg-pac-yellow text-pac-dark hover:bg-pac-yellow/90 font-black glow-yellow"
            >
              {isStarting ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span> STARTING...
                </span>
              ) : (
                "▶ START GAME"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading state */}
      {isStarting && (
        <div data-ocid="game.loading_state" className="sr-only">
          Starting game...
        </div>
      )}
    </>
  );
}
