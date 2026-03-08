import { Toaster } from "@/components/ui/sonner";
import { useCallback, useState } from "react";
import { UserRole } from "./backend";
import AdminPage from "./components/AdminPage";
import GamePage from "./components/GamePage";
import Header from "./components/Header";
import LeaderboardPage from "./components/LeaderboardPage";
import { useActor } from "./hooks/useActor";

export type Page = "game" | "leaderboard" | "admin";

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("game");
  const [isAdmin, setIsAdmin] = useState(false);
  const { actor } = useActor();

  const registerAndCheckAdmin = useCallback(async () => {
    if (!actor) return;
    try {
      const role = await actor.registerOrGetRole();
      setIsAdmin(role === UserRole.admin);
    } catch {
      // ignore — treat as non-admin
    }
  }, [actor]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        isAdmin={isAdmin}
        onRegister={registerAndCheckAdmin}
      />
      <main className="flex-1">
        {currentPage === "game" && <GamePage isAdmin={isAdmin} />}
        {currentPage === "leaderboard" && <LeaderboardPage />}
        {currentPage === "admin" && <AdminPage />}
      </main>
      <footer className="py-4 text-center font-arcade text-xs text-muted-foreground border-t border-border">
        © {new Date().getFullYear()}.{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pac-blue hover:text-pac-cyan transition-colors"
        >
          Built with ❤ using caffeine.ai
        </a>
      </footer>
      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "oklch(0.14 0.028 265)",
            border: "1px solid oklch(0.55 0.22 255 / 0.4)",
            color: "oklch(0.95 0.01 270)",
            fontFamily: '"JetBrains Mono", monospace',
          },
        }}
      />
    </div>
  );
}
