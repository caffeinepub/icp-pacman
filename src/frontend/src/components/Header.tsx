import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import type { Page } from "../App";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

interface HeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

function formatCountdown(targetNs: bigint): string {
  const nowMs = Date.now();
  const targetMs = Number(targetNs / 1_000_000n);
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "JACKPOT LIVE!";
  const totalSec = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function truncatePrincipal(principal: string): string {
  if (principal.length <= 12) return principal;
  return `${principal.slice(0, 5)}...${principal.slice(-4)}`;
}

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const { actor } = useActor();
  const { identity, login, clear, isLoggingIn, isInitializing } =
    useInternetIdentity();

  const [countdownTarget, setCountdownTarget] = useState<bigint>(0n);
  const [displayText, setDisplayText] = useState<string>("");
  const [isLive, setIsLive] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchCountdown = useCallback(async () => {
    if (!actor) return;
    try {
      const target = await actor.getCountdownTarget();
      setCountdownTarget(target);
    } catch {
      // ignore
    }
  }, [actor]);

  // Poll countdown target every 5 seconds
  useEffect(() => {
    fetchCountdown();
    const interval = setInterval(fetchCountdown, 5000);
    return () => clearInterval(interval);
  }, [fetchCountdown]);

  // Update display text every second
  useEffect(() => {
    const update = () => {
      if (countdownTarget === 0n) {
        setDisplayText("");
        setIsLive(false);
        return;
      }
      const text = formatCountdown(countdownTarget);
      if (text === "JACKPOT LIVE!") {
        setIsLive(true);
        setDisplayText("JACKPOT LIVE!");
      } else {
        setIsLive(false);
        setDisplayText(`JACKPOT IN: ${text}`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [countdownTarget]);

  const principal = identity?.getPrincipal().toString();
  const isLoggedIn = !!identity && !identity.getPrincipal().isAnonymous();

  const navLinks: Array<{ page: Page; label: string; ocid: string }> = [
    { page: "game", label: "GAME", ocid: "header.game_link" },
    {
      page: "leaderboard",
      label: "LEADERBOARD",
      ocid: "header.leaderboard_link",
    },
    { page: "admin", label: "ADMIN", ocid: "header.admin_link" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-pac-dark/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <button
          type="button"
          onClick={() => onNavigate("game")}
          className="flex items-center gap-2 cursor-pointer group"
          aria-label="ICP Pacman Home"
        >
          <span className="text-2xl font-arcade font-black neon-text text-pac-yellow tracking-widest group-hover:scale-105 transition-transform">
            🟡 ICP PACMAN
          </span>
        </button>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ page, label, ocid }) => (
            <button
              key={page}
              type="button"
              data-ocid={ocid}
              onClick={() => onNavigate(page)}
              className={`font-arcade text-sm px-4 py-2 rounded-md transition-all ${
                currentPage === page
                  ? "bg-pac-blue/20 text-pac-yellow border border-pac-blue/60 shadow-glow-blue"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right: Countdown + Auth */}
        <div className="flex items-center gap-3">
          {/* Countdown Timer */}
          {displayText && (
            <div
              data-ocid="header.countdown_panel"
              className={`hidden sm:flex items-center gap-1.5 font-arcade text-xs px-3 py-1.5 rounded-md border ${
                isLive
                  ? "live-glow border-pac-gold/40 bg-pac-gold/10"
                  : "countdown-animate border-pac-yellow/40 bg-pac-yellow/10"
              }`}
            >
              <span>{isLive ? "🎰" : "⏱"}</span>
              <span>{displayText}</span>
            </div>
          )}
          {!displayText && (
            <div
              data-ocid="header.countdown_panel"
              className="hidden sm:flex items-center gap-1.5 font-arcade text-xs px-3 py-1.5 rounded-md border border-muted/30 text-muted-foreground"
            >
              <span>⏱</span>
              <span>NO TIMER SET</span>
            </div>
          )}

          {/* Auth button */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:block font-arcade text-xs text-pac-cyan">
                {truncatePrincipal(principal!)}
              </span>
              <Button
                data-ocid="header.logout_button"
                onClick={clear}
                variant="outline"
                size="sm"
                className="font-arcade text-xs border-pac-red/50 text-pac-red hover:bg-pac-red/20 hover:border-pac-red"
              >
                LOGOUT
              </Button>
            </div>
          ) : (
            <Button
              data-ocid="header.login_button"
              onClick={login}
              disabled={isLoggingIn || isInitializing}
              size="sm"
              className="font-arcade text-xs bg-pac-yellow text-pac-dark hover:bg-pac-yellow/90 font-bold glow-yellow transition-all"
            >
              {isLoggingIn ? "LOGGING IN..." : "LOGIN"}
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden text-muted-foreground hover:text-foreground p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              role="img"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-pac-dark px-4 py-3 flex flex-col gap-2">
          {/* Mobile countdown */}
          {displayText && (
            <div
              className={`font-arcade text-xs px-3 py-2 rounded-md border text-center ${
                isLive
                  ? "live-glow border-pac-gold/40 bg-pac-gold/10"
                  : "countdown-animate border-pac-yellow/40 bg-pac-yellow/10"
              }`}
            >
              {isLive ? "🎰 " : "⏱ "}
              {displayText}
            </div>
          )}
          {navLinks.map(({ page, label, ocid }) => (
            <button
              key={page}
              type="button"
              data-ocid={ocid}
              onClick={() => {
                onNavigate(page);
                setMobileMenuOpen(false);
              }}
              className={`font-arcade text-sm px-4 py-2 rounded-md text-left transition-all ${
                currentPage === page
                  ? "bg-pac-blue/20 text-pac-yellow border border-pac-blue/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
