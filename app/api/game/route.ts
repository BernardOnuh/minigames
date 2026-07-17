import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      const { wallet, gameSlug } = body;
      if (!wallet || !gameSlug) {
        return NextResponse.json({ error: "Missing wallet address or game slug" }, { status: 400 });
      }

      const w = wallet.toLowerCase();
      const { data: game } = await supabase
        .from("games")
        .select("id")
        .eq("game_id", gameSlug)
        .single();

      if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
      }

      const { data, error } = await supabase
        .from("game_results")
        .insert([{ wallet: w, game_id: game.id, score: 0, xp_earned: 0, duration_seconds: 0, status: "playing" }])
        .select()
        .single();

      if (error) {
        console.error("Error starting session:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ session: data });
    }

    if (action === "complete") {
      const { resultId, score, duration, baseXp } = body;
      if (!resultId || score === undefined) {
        return NextResponse.json({ error: "Missing resultId or score" }, { status: 400 });
      }

      const xpEarned = Math.max(100, Math.floor((score / 100) * (baseXp || 50)));

      const { data, error } = await supabase
        .from("game_results")
        .update({ status: "completed", score, xp_earned: xpEarned, duration_seconds: duration || 0 })
        .eq("id", resultId)
        .select()
        .single();

      if (error) {
        console.error("Error completing game:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data) {
        const wallet = data.wallet.toLowerCase();
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("xp, wins, losses, username, avatar_color, avatar_text")
          .eq("wallet", wallet)
          .maybeSingle();

        const currentXp = Number(profile?.xp ?? 0);
        const currentWins = Number(profile?.wins ?? 0);

        await supabase
          .from("user_profiles")
          .upsert({ wallet, xp: currentXp + xpEarned, wins: currentWins + 1, updated_at: new Date().toISOString() }, { onConflict: "wallet" });

        await supabase
          .from("leaderboard_weekly")
          .upsert({
            wallet,
            username: profile?.username || null,
            xp: currentXp + xpEarned,
            earnings: 0,
            wins: currentWins + 1,
            losses: Number(profile?.losses ?? 0),
            avatar_color: profile?.avatar_color || "#a78bfa",
            avatar_text: profile?.avatar_text || "#000",
          }, { onConflict: "wallet" });
      }

      return NextResponse.json({ result: data });
    }

    if (action === "fail") {
      const { resultId } = body;
      if (!resultId) {
        return NextResponse.json({ error: "Missing game result ID" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("game_results")
        .update({ status: "failed", xp_earned: 0, metadata: { failed_at: new Date().toISOString() } })
        .eq("id", resultId)
        .select()
        .single();

      if (error) {
        console.error("Error failing game:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (data) {
        const wallet = data.wallet.toLowerCase();
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("xp, wins, losses, username, avatar_color, avatar_text")
          .eq("wallet", wallet)
          .maybeSingle();

        const currentLosses = Number(profile?.losses ?? 0);

        await supabase
          .from("user_profiles")
          .upsert({ wallet, losses: currentLosses + 1, updated_at: new Date().toISOString() }, { onConflict: "wallet" });

        await supabase
          .from("leaderboard_weekly")
          .upsert({
            wallet,
            username: profile?.username || null,
            xp: Number(profile?.xp ?? 0),
            earnings: 0,
            wins: Number(profile?.wins ?? 0),
            losses: currentLosses + 1,
            avatar_color: profile?.avatar_color || "#a78bfa",
            avatar_text: profile?.avatar_text || "#000",
          }, { onConflict: "wallet" });
      }

      return NextResponse.json({ result: data });
    }

      return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
  } catch (err) {
    console.error("API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}