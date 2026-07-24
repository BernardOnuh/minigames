import { createClient } from "@supabase/supabase-js";

// ─── Client ───────────────────────────────────────────────────────────────────
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Game {
  id: string;       // UUID — used as React key only
  gameId: string;   // slug e.g. "flappy_bird" — used for routing
  title: string;
  type: "arcade" | "multi" | "trivia";
  icon: string;
  reward: string;
  players: string;
  thumbBg: string;
}

export interface LeaderboardEntry {
  name: string;
  initials: string;
  xp: string;
  coins: string;
  avatarColor: string;
  avatarText: string;
}

export interface LiveMatch {
  gameId: string;
  gameTitle: string;
  round: number;
  playerCount: number;
  pool: string;
}

export interface ChatMessage {
  id: number;
  wallet: string;
  username: string;
  message: string;
  createdAt: string;
  isSystem?: boolean;
}

export interface UserStats {
  xp: string;
  earnings: string;
  winRate: string;
  xpPct: number;
  earningsPct: number;
  winPct: number;
}

// ─── Games ────────────────────────────────────────────────────────────────────

export async function fetchGames(): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, game_id, title, type, icon, reward, thumb_bg")
    .eq("is_active", true)
    .order("created_at");

  if (error || !data) {
    console.warn("fetchGames:", error?.message);
    return [];
  }

  const { data: playerCounts } = await supabase
    .from("match_players")
    .select("match_id, matches!inner(game_id, status)")
    .in("matches.status", ["waiting", "live"]);

  const countByGame: Record<string, number> = {};
  (playerCounts ?? []).forEach((row: any) => {
    const gid = row.matches?.game_id;
    if (gid) countByGame[gid] = (countByGame[gid] ?? 0) + 1;
  });

  return data.map((g) => ({
    id: g.id,
    gameId: g.game_id,        // ← slug for routing
    title: g.title,
    type: g.type as Game["type"],
    icon: g.icon,
    reward: g.reward,
    thumbBg: g.thumb_bg,
    players:
      countByGame[g.id] != null
        ? `${countByGame[g.id]} playing`
        : "0 playing",
  }));
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function fetchLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_weekly")
    .select("wallet, username, xp, earnings, avatar_color, avatar_text")
    .order("xp", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("fetchLeaderboard:", error?.message);
    return [];
  }

  return data.map((e) => ({
    name: e.username || shortenWallet(e.wallet),
    initials: (e.username || e.wallet).charAt(0).toUpperCase(),
    xp: `${Number(e.xp).toLocaleString()} XP`,
    coins: `${Number(e.earnings).toLocaleString()} USDm`,
    avatarColor: e.avatar_color ?? "#a78bfa",
    avatarText: e.avatar_text ?? "#000",
  }));
}

// ─── Live match ───────────────────────────────────────────────────────────────

export async function fetchLiveMatch(): Promise<LiveMatch | null> {
  const { data, error } = await supabase
    .from("matches")
    .select("id, game_id, round, pool, status, games(title)")
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { count } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true })
    .eq("match_id", data.id);

  return {
    gameId: data.game_id,
    gameTitle: (data.games as any)?.title ?? "Unknown",
    round: data.round,
    playerCount: count ?? 0,
    pool: `${Number(data.pool).toFixed(0)} USDm`,
  };
}

// ─── User profile & stats ─────────────────────────────────────────────────────

export async function upsertUserProfile(wallet: string): Promise<void> {
  const w = wallet.toLowerCase();
  const { error } = await supabase
    .from("user_profiles")
    .upsert({ wallet: w, updated_at: new Date().toISOString() }, { onConflict: "wallet", ignoreDuplicates: true });

  if (error) console.warn("upsertUserProfile:", error.message);

  const { error: lbErr } = await supabase
    .from("leaderboard_weekly")
    .upsert({ wallet: w, xp: 0, earnings: 0, wins: 0, losses: 0, rank: 999 }, { onConflict: "wallet", ignoreDuplicates: true });

  if (lbErr) console.warn("upsertUserProfile leaderboard:", lbErr.message);
}

export async function fetchUserStats(rawWallet: string): Promise<UserStats> {
  const wallet = rawWallet.toLowerCase();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("xp, earnings, wins, losses")
    .eq("wallet", wallet)
    .maybeSingle();

  if (error || !data) {
    return { xp: "—", earnings: "— USDm", winRate: "—", xpPct: 0, earningsPct: 0, winPct: 0 };
  }

  const total = (data.wins ?? 0) + (data.losses ?? 0);
  const winPct = total > 0 ? Math.round((data.wins / total) * 100) : 0;

  return {
    xp: Number(data.xp).toLocaleString(),
    earnings: `${Number(data.earnings).toLocaleString()} USDm`,
    winRate: total > 0 ? `${winPct}%` : "—",
    xpPct: Math.min(100, Math.round((data.xp / 20_000) * 100)),
    earningsPct: Math.min(100, Math.round((Number(data.earnings) / 200) * 100)),
    winPct,
  };
}

// ─── Lobby chat ───────────────────────────────────────────────────────────────

export async function fetchChatHistory(limit = 30): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("lobby_chat")
    .select("id, wallet, username, message, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("fetchChatHistory:", error?.message);
    return [];
  }

  return data
    .reverse()
    .map((m) => ({
      id: m.id,
      wallet: m.wallet,
      username: m.username || shortenWallet(m.wallet),
      message: m.message,
      createdAt: m.created_at,
    }));
}

export async function sendChatMessage(
  wallet: string,
  message: string,
  username?: string
): Promise<boolean> {
  const { error } = await supabase.from("lobby_chat").insert({
    wallet: wallet.toLowerCase(),
    username: username || shortenWallet(wallet),
    message: message.trim().slice(0, 280),
  });

  if (error) {
    console.warn("sendChatMessage:", error.message);
    return false;
  }
  return true;
}

export function subscribeLobbyChat(
  onMessage: (msg: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel("lobby-chat")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "lobby_chat" },
      (payload) => {
        const r = payload.new as any;
        onMessage({
          id: r.id,
          wallet: r.wallet,
          username: r.username || shortenWallet(r.wallet),
          message: r.message,
          createdAt: r.created_at,
        });
      }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export function subscribeLiveMatches(onUpdate: () => void): () => void {
  const channel = supabase
    .channel("live-matches")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "matches" },
      onUpdate
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── Player count ─────────────────────────────────────────────────────────────

export async function fetchPlayerCount(): Promise<string> {
  const { count, error } = await supabase
    .from("match_players")
    .select("*", { count: "exact", head: true });

  if (error) return "—";
  return (count ?? 0).toLocaleString();
}

// ─── Game-specific leaderboard ────────────────────────────────────────────

export async function fetchGameLeaderboard(
  gameSlug: string,
  limit = 10
): Promise<{ wallet: string; username: string; score: number; created_at: string }[]> {
  const { data, error } = await supabase
    .from("game_results")
    .select("wallet, score, created_at, games!inner(game_id)")
    .eq("games.game_id", gameSlug)
    .eq("status", "completed")
    .order("score", { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.warn("fetchGameLeaderboard:", error?.message);
    return [];
  }

  return data.map((r) => ({
    wallet: r.wallet,
    username: shortenWallet(r.wallet),
    score: r.score,
    created_at: r.created_at,
  }));
}

// ─── Helper ─────────────────────────────────────────────────────

export function shortenWallet(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}