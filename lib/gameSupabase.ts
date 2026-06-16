import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export type GameResult = {
    id?: number;  // ← was string, change to number
    wallet: string;
    game_id: string;
    game_title: string;
    score: number;
    xp_earned: number;
    duration_seconds: number;
    status: "playing" | "completed" | "failed" | "abandoned";
    metadata?: Record<string, any>;
    created_at: string;
    updated_at?: string;
  };


export type GameConfig = {
  id?: number;
  game_id: string;
  game_title: string;
  game_type: "arcade" | "multi" | "trivia";
  icon: string;
  thumb_bg: string;
  base_xp: number;
  is_active: boolean;
};

export type UserProfile = {
  wallet: string;
  username?: string;
  total_xp: number;
  games_played: number;
};

export type LeaderboardEntry = {
  rank: number;
  wallet: string;
  username?: string;
  total_xp: number;
  games_played: number;
  avg_xp_per_game: number;
};

// ─── Game Session Management ───────────────────────────────────────────────

export async function startGameSession(
  wallet: string,
  gameId: string,
  gameTitle: string
) {
  const { data, error } = await supabase
    .from("game_results")
    .insert([
      {
        wallet,
        game_id: gameId,
        game_title: gameTitle,
        score: 0,
        xp_earned: 0,
        duration_seconds: 0,
        status: "playing",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error starting game session:", error);
    return null;
  }
  return data;
}

/**
 * Complete a game and award XP
 * XP is calculated as: (score / 1000) * base_xp
 */
export async function completeGameResult(
  resultId: number,
  finalScore: number,
  durationSeconds: number,
  baseXp: number = 50
) {
  // Calculate XP based on score
  const xpEarned = Math.max(10, Math.floor((finalScore / 1000) * baseXp));

  const { data, error } = await supabase
    .from("game_results")
    .update({
      status: "completed",
      score: finalScore,
      xp_earned: xpEarned,
      duration_seconds: durationSeconds,
    })
    .eq("id", resultId)
    .select()
    .single();

  if (error) {
    console.error("Error completing game result:", error);
    return null;
  }
  return data;
}

/**
 * Fail a game (no XP awarded)
 */
export async function failGameResult(
  resultId: number,
  metadata?: Record<string, any>
) {
  const { data, error } = await supabase
    .from("game_results")
    .update({
      status: "failed",
      xp_earned: 0,
      metadata: metadata || {},
    })
    .eq("id", resultId)
    .select()
    .single();

  if (error) {
    console.error("Error failing game result:", error);
    return null;
  }
  return data;
}

// ─── User Profile ─────────────────────────────────────────────────────────

/**
 * Get or create user profile
 */
export async function upsertUserProfile(
  wallet: string,
  username?: string
) {
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({
      wallet,
      username: username || wallet.slice(0, 6) + "...",
    }, { onConflict: "wallet" })
    .select()
    .single();

  if (error) {
    console.error("Error upserting user profile:", error);
    return null;
  }
  return data as UserProfile;
}

/**
 * Get user's profile and XP
 */
export async function fetchUserProfile(wallet: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("wallet", wallet)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching user profile:", error);
  }

  return data as UserProfile | null;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────

/**
 * Get global leaderboard (top players by XP)
 */
export async function fetchLeaderboard(limit: number = 50) {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .limit(limit);

  if (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }

  return (data || []) as LeaderboardEntry[];
}

/**
 * Get user's rank on leaderboard
 */
export async function fetchUserRank(wallet: string) {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("rank")
    .eq("wallet", wallet)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching user rank:", error);
  }

  return (data?.rank as number) || null;
}

/**
 * Get game config
 */
export async function fetchGameConfig(gameId: string) {
  const { data, error } = await supabase
    .from("game_config")
    .select("*")
    .eq("game_id", gameId)
    .eq("is_active", true)
    .single();

  if (error) {
    console.error("Error fetching game config:", error);
    return null;
  }
  return data as GameConfig;
}

/**
 * Get all active games
 */
export async function fetchAllGameConfigs() {
  const { data, error } = await supabase
    .from("game_config")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching game configs:", error);
    return [];
  }

  return (data || []) as GameConfig[];
}

/**
 * Get user's game history
 */
export async function fetchUserGameHistory(wallet: string, limit: number = 10) {
  const { data, error } = await supabase
    .from("game_results")
    .select("*")
    .eq("wallet", wallet)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching game history:", error);
    return [];
  }

  return (data || []) as GameResult[];
}

/**
 * Get game-specific leaderboard
 */
export async function fetchGameLeaderboard(
  gameId: string,
  limit: number = 10
) {
  const { data, error } = await supabase
    .from("game_results")
    .select("wallet, score, xp_earned, created_at, game_title")
    .eq("game_id", gameId)
    .eq("status", "completed")
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching game leaderboard:", error);
    return [];
  }

  return data || [];
}