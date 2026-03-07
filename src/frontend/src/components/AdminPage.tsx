import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function AdminPage() {
  const { actor, isFetching } = useActor();
  const { identity, login, isLoggingIn } = useInternetIdentity();
  const isLoggedIn = !!identity && !identity.getPrincipal().isAnonymous();

  const [walletInput, setWalletInput] = useState("");
  const [countdownInput, setCountdownInput] = useState("");
  const [showPayoutConfirm, setShowPayoutConfirm] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [isSettingCountdown, setIsSettingCountdown] = useState(false);
  const [isClearingCountdown, setIsClearingCountdown] = useState(false);
  const [payoutResult, setPayoutResult] = useState<{
    ok: boolean;
    message: string;
    amount: bigint;
  } | null>(null);

  // Check admin status
  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      if (!actor || !isLoggedIn) return false;
      return actor.isCallerAdmin();
    },
    enabled: !!actor && !isFetching && isLoggedIn,
  });

  // Admin stats
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getAdminStats();
    },
    enabled: !!actor && !isFetching && !!isAdmin,
    refetchInterval: 15_000,
  });

  // Payout wallet
  const {
    data: payoutWallet,
    isLoading: walletLoading,
    refetch: refetchWallet,
  } = useQuery({
    queryKey: ["payoutWallet"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getPayoutWallet();
    },
    enabled: !!actor && !isFetching && !!isAdmin,
  });

  // Pre-fill wallet input from fetched wallet
  useEffect(() => {
    if (payoutWallet) {
      setWalletInput(payoutWallet.toString());
    }
  }, [payoutWallet]);

  const jackpotICP = stats?.jackpotBalance
    ? Number(stats.jackpotBalance) / 100_000_000
    : 0;
  const totalPlays = stats?.totalPlays ? Number(stats.totalPlays) : 0;

  const handleSaveWallet = async () => {
    if (!actor || !walletInput.trim()) return;
    setIsSavingWallet(true);
    try {
      const principal = Principal.fromText(walletInput.trim());
      await actor.setPayoutWallet(principal);
      await refetchWallet();
      toast.success("Payout wallet updated successfully!");
    } catch {
      toast.error("Invalid principal or failed to save wallet.");
    } finally {
      setIsSavingWallet(false);
    }
  };

  const handleSetCountdown = async () => {
    if (!actor || !countdownInput) return;
    setIsSettingCountdown(true);
    try {
      const date = new Date(countdownInput);
      const nsTimestamp = BigInt(date.getTime()) * 1_000_000n;
      await actor.setCountdown(nsTimestamp);
      toast.success("Countdown timer set!");
      setCountdownInput("");
    } catch {
      toast.error("Failed to set countdown timer.");
    } finally {
      setIsSettingCountdown(false);
    }
  };

  const handleClearCountdown = async () => {
    if (!actor) return;
    setIsClearingCountdown(true);
    try {
      await actor.setCountdown(0n);
      toast.success("Countdown timer cleared.");
    } catch {
      toast.error("Failed to clear countdown.");
    } finally {
      setIsClearingCountdown(false);
    }
  };

  const handleTriggerPayout = async () => {
    if (!actor) return;
    setIsTriggering(true);
    try {
      const result = await actor.triggerPayout();
      setPayoutResult(result);
      setShowPayoutConfirm(false);
      if (result.ok) {
        toast.success(
          `Payout successful! ${(Number(result.amount) / 100_000_000).toFixed(4)} ICP sent.`,
        );
      } else {
        toast.error(`Payout failed: ${result.message}`);
      }
      await refetchStats();
    } catch {
      toast.error("Failed to trigger payout.");
      setShowPayoutConfirm(false);
    } finally {
      setIsTriggering(false);
    }
  };

  // ── Auth guards ──────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
        <p className="text-5xl">🔒</p>
        <h2 className="font-arcade text-2xl text-pac-yellow text-center">
          LOGIN REQUIRED
        </h2>
        <p className="font-arcade text-sm text-muted-foreground text-center">
          You must be logged in to access the admin panel.
        </p>
        <Button
          onClick={login}
          disabled={isLoggingIn}
          className="font-arcade bg-pac-yellow text-pac-dark hover:bg-pac-yellow/90 font-black glow-yellow rounded-full px-8 py-4"
        >
          {isLoggingIn ? "CONNECTING..." : "LOGIN"}
        </Button>
      </div>
    );
  }

  if (checkingAdmin || isFetching) {
    return (
      <div
        data-ocid="admin.loading_state"
        className="flex flex-col items-center justify-center min-h-[70vh] gap-4"
      >
        <div className="font-arcade text-pac-yellow animate-pulse text-xl">
          CHECKING ACCESS...
        </div>
        <div className="flex gap-2">
          {(["blinky", "pinky", "inky"] as const).map((name, i) => (
            <span
              key={name}
              className="text-2xl animate-bounce"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              👻
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-4">
        <p className="text-5xl">🚫</p>
        <h2 className="font-arcade text-2xl text-pac-red text-center">
          ACCESS DENIED
        </h2>
        <p className="font-arcade text-sm text-muted-foreground text-center max-w-sm">
          You do not have admin privileges for this game.
        </p>
        <div
          data-ocid="admin.error_state"
          className="font-arcade text-xs text-pac-red px-6 py-3 border border-pac-red/40 rounded-full"
        >
          UNAUTHORIZED
        </div>
      </div>
    );
  }

  // ── Admin Panel ──────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8 pixel-fade-in">
      {/* Title */}
      <div className="text-center">
        <h1 className="font-arcade text-3xl md:text-4xl font-black text-pac-yellow neon-text tracking-widest">
          ADMIN PANEL
        </h1>
        <p className="font-arcade text-xs text-pac-blue mt-1">
          GAME ADMINISTRATION CONTROLS
        </p>
      </div>

      {/* Stats Card */}
      <div className="arcade-border rounded-xl p-6 bg-pac-navy/60 space-y-4">
        <h2 className="font-arcade text-sm text-pac-blue tracking-widest">
          ◆ GAME STATS
        </h2>
        {statsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-arcade text-xs text-muted-foreground">
                JACKPOT BALANCE
              </p>
              <p className="font-arcade text-2xl font-black text-pac-gold jackpot-glow mt-1">
                {jackpotICP.toFixed(4)} ICP
              </p>
            </div>
            <div>
              <p className="font-arcade text-xs text-muted-foreground">
                TOTAL PLAYS
              </p>
              <p className="font-arcade text-2xl font-black text-pac-cyan mt-1">
                {totalPlays.toLocaleString()}
              </p>
            </div>
          </div>
        )}
        <div>
          <p className="font-arcade text-xs text-muted-foreground">
            PAYOUT WALLET
          </p>
          {walletLoading ? (
            <Skeleton className="h-5 w-48 mt-1" />
          ) : (
            <p className="font-mono text-xs text-foreground mt-1 break-all">
              {payoutWallet?.toString() ?? "Not set"}
            </p>
          )}
        </div>
      </div>

      {/* Set Payout Wallet */}
      <div className="arcade-border rounded-xl p-6 bg-pac-navy/60 space-y-4">
        <h2 className="font-arcade text-sm text-pac-blue tracking-widest">
          ◆ PAYOUT WALLET
        </h2>
        <div className="space-y-2">
          <Label
            htmlFor="wallet-input"
            className="font-arcade text-xs text-muted-foreground"
          >
            PRINCIPAL ID
          </Label>
          <Input
            id="wallet-input"
            data-ocid="admin.wallet_input"
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value)}
            placeholder="xxxx-xxxx-xxxx-xxxx-xxx"
            className="font-mono text-xs bg-muted/20 border-border focus:border-pac-blue"
          />
        </div>
        <Button
          data-ocid="admin.save_wallet_button"
          onClick={handleSaveWallet}
          disabled={isSavingWallet || !walletInput.trim()}
          className="font-arcade text-sm bg-pac-blue hover:bg-pac-blue/80 text-white glow-blue rounded-full px-6"
        >
          {isSavingWallet ? "SAVING..." : "SAVE WALLET"}
        </Button>
      </div>

      {/* Set Countdown */}
      <div className="arcade-border rounded-xl p-6 bg-pac-navy/60 space-y-4">
        <h2 className="font-arcade text-sm text-pac-blue tracking-widest">
          ◆ JACKPOT COUNTDOWN TIMER
        </h2>
        <div className="space-y-2">
          <Label
            htmlFor="countdown-input"
            className="font-arcade text-xs text-muted-foreground"
          >
            TARGET DATE &amp; TIME
          </Label>
          <Input
            id="countdown-input"
            data-ocid="admin.countdown_input"
            type="datetime-local"
            value={countdownInput}
            onChange={(e) => setCountdownInput(e.target.value)}
            className="font-arcade text-xs bg-muted/20 border-border focus:border-pac-yellow"
          />
        </div>
        <div className="flex gap-3">
          <Button
            data-ocid="admin.set_countdown_button"
            onClick={handleSetCountdown}
            disabled={isSettingCountdown || !countdownInput}
            className="font-arcade text-sm bg-pac-yellow text-pac-dark hover:bg-pac-yellow/90 font-black glow-yellow rounded-full px-6"
          >
            {isSettingCountdown ? "SETTING..." : "⏱ SET TIMER"}
          </Button>
          <Button
            onClick={handleClearCountdown}
            disabled={isClearingCountdown}
            variant="outline"
            className="font-arcade text-sm border-muted text-muted-foreground hover:bg-muted/20 rounded-full px-6"
          >
            {isClearingCountdown ? "CLEARING..." : "CLEAR TIMER"}
          </Button>
        </div>
      </div>

      {/* Trigger Payout */}
      <div
        className="arcade-border rounded-xl p-6 bg-pac-navy/60 space-y-4"
        style={{
          borderColor: "oklch(0.65 0.25 25 / 0.5)",
          boxShadow: "0 0 12px oklch(0.65 0.25 25 / 0.2)",
        }}
      >
        <h2 className="font-arcade text-sm text-pac-red tracking-widest">
          ◆ JACKPOT PAYOUT
        </h2>
        <p className="font-arcade text-xs text-muted-foreground">
          Manually trigger the jackpot payout. This will send{" "}
          <span className="text-pac-gold font-bold">
            {jackpotICP.toFixed(4)} ICP
          </span>{" "}
          to the configured payout wallet.
        </p>
        <Button
          data-ocid="admin.payout_button"
          onClick={() => setShowPayoutConfirm(true)}
          disabled={isTriggering || jackpotICP <= 0}
          className="font-arcade text-sm bg-pac-red hover:bg-pac-red/80 text-white rounded-full px-8 py-4 w-full"
          style={{ boxShadow: "0 0 12px oklch(0.65 0.25 25 / 0.4)" }}
        >
          🎰 TRIGGER JACKPOT PAYOUT
        </Button>

        {/* Payout result */}
        {payoutResult && (
          <div
            className={`font-arcade text-xs px-4 py-3 rounded-lg border ${
              payoutResult.ok
                ? "text-pac-cyan border-pac-cyan/40 bg-pac-cyan/10"
                : "text-pac-red border-pac-red/40 bg-pac-red/10"
            }`}
            data-ocid={
              payoutResult.ok ? "admin.success_state" : "admin.error_state"
            }
          >
            {payoutResult.ok
              ? `✓ PAYOUT SENT: ${(Number(payoutResult.amount) / 100_000_000).toFixed(4)} ICP`
              : `✗ FAILED: ${payoutResult.message}`}
          </div>
        )}
      </div>

      {/* Confirm Payout Dialog */}
      <Dialog open={showPayoutConfirm} onOpenChange={setShowPayoutConfirm}>
        <DialogContent className="bg-pac-navy border-pac-red/40 text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-arcade text-pac-red text-xl text-center">
              ⚠ CONFIRM PAYOUT
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 text-center space-y-4">
            <p className="font-arcade text-3xl font-black text-pac-gold jackpot-glow">
              {jackpotICP.toFixed(4)} ICP
            </p>
            <p className="font-arcade text-xs text-muted-foreground">
              This will immediately send the full jackpot balance to the payout
              wallet. This action cannot be undone.
            </p>
            <div className="font-arcade text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border break-all">
              TO: {payoutWallet?.toString() ?? "No wallet configured"}
            </div>
          </div>

          <DialogFooter className="flex gap-3 sm:flex-row">
            <Button
              data-ocid="admin.cancel_button"
              variant="outline"
              onClick={() => setShowPayoutConfirm(false)}
              className="font-arcade flex-1 border-muted text-muted-foreground"
              disabled={isTriggering}
            >
              CANCEL
            </Button>
            <Button
              data-ocid="admin.confirm_button"
              onClick={handleTriggerPayout}
              disabled={isTriggering || !payoutWallet}
              className="font-arcade flex-1 bg-pac-red hover:bg-pac-red/80 text-white"
              style={{ boxShadow: "0 0 10px oklch(0.65 0.25 25 / 0.4)" }}
            >
              {isTriggering ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⟳</span> SENDING...
                </span>
              ) : (
                "CONFIRM PAYOUT"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
