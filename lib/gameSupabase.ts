import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
export type GameResult = {
    id?: number;
    wallet: string;
    game_id: string;
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

// ─── Game Session Management ───────────────────────────────────────────────

export async function startGameSession(
  rawWallet: string,
  gameSlug: string,
) {
  try {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", wallet: rawWallet, gameSlug }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Error starting game session:", json.error);
      return null;
    }
    return json.session as GameResult;
  } catch (e) {
    console.error("Error starting game session:", e);
    return null;
  }
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
  try {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", resultId, score: finalScore, duration: durationSeconds, baseXp }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Error completing game:", json.error);
      return null;
    }
    return json.result as GameResult;
  } catch (e) {
    console.error("Error completing game:", e);
    return null;
  }
}

/**
 * Fail a game (no XP awarded)
 */
export async function failGameResult(
  resultId: number,
) {
  try {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fail", resultId }),
    });
    const json = await res.json();
    if (!res.ok) {
      console.error("Error failing game:", json.error);
      return null;
    }
    return json.result as GameResult;
  } catch (e) {
    console.error("Error failing game:", e);
    return null;
  }
}

// ─── User Profile ─────────────────────────────────────────────────────────

/**
 * Get or create user profile
 */
export async function upsertUserProfile(
  wallet: string,
  username?: string
) {
  const w = wallet.toLowerCase();
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({
      wallet: w,
      username: username || w.slice(0, 6) + "...",
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
export async function fetchUserGameHistory(wallet: string, limit: number = 20) {
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

