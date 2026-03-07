import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Principal } from "@icp-sdk/core/principal";
import { useQuery } from "@tanstack/react-query";
import { useActor } from "../hooks/useActor";

interface ScoreEntry {
  principal: Principal;
  score: bigint;
  timestamp: bigint;
}

function truncatePrincipal(p: string): string {
  if (p.length <= 14) return p;
  return `${p.slice(0, 6)}…${p.slice(-5)}`;
}

function formatDate(nsTimestamp: bigint): string {
  const ms = Number(nsTimestamp / 1_000_000n);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="text-2xl" title="1st place">
        🥇
      </span>
    );
  if (rank === 2)
    return (
      <span className="text-2xl" title="2nd place">
        🥈
      </span>
    );
  if (rank === 3)
    return (
      <span className="text-2xl" title="3rd place">
        🥉
      </span>
    );
  return (
    <span className="font-arcade text-sm text-muted-foreground">#{rank}</span>
  );
}

export default function LeaderboardPage() {
  const { actor, isFetching } = useActor();

  const { data: scores, isLoading: scoresLoading } = useQuery<ScoreEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getLeaderboard();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });

  const { data: totalPlays, isLoading: playsLoading } = useQuery<bigint>({
    queryKey: ["totalPlays"],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.getTotalPlays();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });

  const { data: jackpotBalance, isLoading: jackpotLoading } = useQuery<bigint>({
    queryKey: ["jackpotBalance"],
    queryFn: async () => {
      if (!actor) return 0n;
      return actor.getJackpotBalance();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
  });

  const isLoading = scoresLoading || isFetching;
  const jackpotICP = jackpotBalance ? Number(jackpotBalance) / 100_000_000 : 0;
  const totalPlaysNum = totalPlays ? Number(totalPlays) : 0;

  // Sort scores by score descending, take top 20
  const sortedScores = scores
    ? [...scores].sort((a, b) => Number(b.score - a.score)).slice(0, 20)
    : [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 pixel-fade-in">
      {/* Title */}
      <div className="text-center space-y-1">
        <h1 className="font-arcade text-4xl md:text-5xl font-black text-pac-yellow neon-text tracking-widest">
          LEADERBOARD
        </h1>
        <p className="font-arcade text-xs text-pac-blue tracking-widest">
          TOP PLAYERS ON THE ICP NETWORK
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-4">
        <div className="arcade-border rounded-xl px-4 py-4 text-center bg-pac-navy/60">
          <p className="font-arcade text-xs text-muted-foreground mb-1">
            JACKPOT POOL
          </p>
          {jackpotLoading || isFetching ? (
            <Skeleton className="h-8 w-28 mx-auto" />
          ) : (
            <p className="font-arcade text-2xl font-black jackpot-glow text-pac-gold">
              {jackpotICP.toFixed(4)} ICP
            </p>
          )}
        </div>
        <div className="arcade-border rounded-xl px-4 py-4 text-center bg-pac-navy/60">
          <p className="font-arcade text-xs text-muted-foreground mb-1">
            TOTAL PLAYS
          </p>
          {playsLoading || isFetching ? (
            <Skeleton className="h-8 w-20 mx-auto" />
          ) : (
            <p className="font-arcade text-2xl font-black text-pac-cyan">
              {totalPlaysNum.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div data-ocid="leaderboard.loading_state" className="space-y-2">
          {(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const).map(
            (id) => (
              <Skeleton key={id} className="h-12 w-full rounded-lg" />
            ),
          )}
        </div>
      ) : sortedScores.length === 0 ? (
        <div
          data-ocid="leaderboard.empty_state"
          className="text-center py-20 space-y-4 arcade-border rounded-xl bg-pac-navy/30"
        >
          <p className="text-6xl">👻</p>
          <p className="font-arcade text-xl text-muted-foreground">
            NO SCORES YET
          </p>
          <p className="font-arcade text-xs text-muted-foreground">
            BE THE FIRST TO CLAIM THE TOP SPOT!
          </p>
        </div>
      ) : (
        <div className="arcade-border rounded-xl overflow-hidden bg-pac-navy/30">
          <Table data-ocid="leaderboard.table">
            <TableHeader>
              <TableRow className="border-b border-pac-blue/30 hover:bg-transparent">
                <TableHead className="font-arcade text-xs text-pac-blue w-16">
                  RANK
                </TableHead>
                <TableHead className="font-arcade text-xs text-pac-blue">
                  PLAYER
                </TableHead>
                <TableHead className="font-arcade text-xs text-pac-blue text-right">
                  SCORE
                </TableHead>
                <TableHead className="font-arcade text-xs text-pac-blue text-right hidden sm:table-cell">
                  DATE
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedScores.map((entry, i) => {
                const rank = i + 1;
                const principalStr = entry.principal.toString();
                return (
                  <TableRow
                    key={`rank-${rank}`}
                    className={`border-b border-border/30 transition-colors hover:bg-pac-blue/5 ${
                      rank === 1
                        ? "bg-pac-gold/5"
                        : rank === 2
                          ? "bg-muted/5"
                          : rank === 3
                            ? "bg-pac-orange/5"
                            : ""
                    }`}
                  >
                    <TableCell className="py-3 w-16">
                      <RankBadge rank={rank} />
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className={`font-arcade text-xs ${
                          rank === 1
                            ? "text-pac-gold"
                            : rank <= 3
                              ? "text-pac-yellow"
                              : "text-foreground"
                        }`}
                      >
                        {truncatePrincipal(principalStr)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <span
                        className={`font-arcade text-sm font-bold ${
                          rank === 1
                            ? "text-pac-gold jackpot-glow"
                            : rank <= 3
                              ? "text-pac-yellow"
                              : "text-foreground"
                        }`}
                      >
                        {Number(entry.score).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-right hidden sm:table-cell">
                      <span className="font-arcade text-xs text-muted-foreground">
                        {formatDate(entry.timestamp)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="font-arcade text-xs text-center text-muted-foreground">
        AUTO-REFRESHES EVERY 10 SECONDS • POWERED BY ICP
      </p>
    </div>
  );
}
