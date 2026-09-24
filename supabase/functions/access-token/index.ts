import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const makeCode = () => {
  const part = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
      .join("");
  return `RAIO-${part(4)}-${part(4)}`;
};

const normalizeCode = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = admin();

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = typeof body?.action === "string" ? body.action : "";

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleRow;

    if (action === "redeem") {
      const code = normalizeCode(String(body?.code ?? ""));
      if (code.length < 6) return json({ error: "INVALID_CODE" }, 400);

      const { data: rows, error } = await supabase
        .from("access_tokens")
        .select("*")
        .eq("revoked", false)
        .or(`used_by.is.null,used_by.eq.${user.id}`);
      if (error) throw error;

      const match = (rows ?? []).find((row) => normalizeCode(row.code) === code);
      if (!match) return json({ error: "TOKEN_NOT_FOUND" }, 404);

      const expiresAt =
        match.plan === "lifetime"
          ? null
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error: tokenError } = await supabase
        .from("access_tokens")
        .update({ used_by: user.id, used_at: new Date().toISOString(), expires_at: expiresAt })
        .eq("id", match.id)
        .or(`used_by.is.null,used_by.eq.${user.id}`);
      if (tokenError) throw tokenError;

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, access_plan: match.plan, access_expires_at: expiresAt },
          { onConflict: "user_id" },
        );
      if (profileError) throw profileError;

      if (match.purpose === "reseller" && match.created_by && match.created_by !== user.id) {
        const panelLabel = String(match.panel_label || match.note || "NOVA REVENDA").trim().slice(0, 40);
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("whatsapp")
          .eq("user_id", match.created_by)
          .maybeSingle();
        const supportWhatsapp = String(ownerProfile?.whatsapp ?? "").replace(/\D/g, "") || null;
        const { error: linkError } = await supabase.from("panel_links").upsert(
          {
            owner_user_id: match.created_by,
            partner_user_id: user.id,
            partner_label: panelLabel,
          },
          { onConflict: "owner_user_id,partner_user_id" },
        );
        if (linkError) throw linkError;

        const { error: nameError } = await supabase.from("panel_names").upsert(
          { user_id: user.id, label: panelLabel, support_whatsapp: supportWhatsapp },
          { onConflict: "user_id" },
        );
        if (nameError) throw nameError;
      }

      return json({ ok: true, plan: match.plan, expires_at: expiresAt, purpose: match.purpose });
    }

    if (!isAdmin) return json({ error: "NOT_ALLOWED" }, 403);

    if (action === "list") {
      const { data, error } = await supabase
        .from("access_tokens")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ tokens: data ?? [] });
    }

    if (action === "create") {
      const plan = body?.plan === "lifetime" ? "lifetime" : "30d";
      const note = typeof body?.note === "string" ? body.note.slice(0, 120) : null;
      const { data, error } = await supabase
        .from("access_tokens")
        .insert({ code: makeCode(), plan, note, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return json({ token: data });
    }

    if (action === "create_reseller") {
      const panelLabel = String(body?.panelLabel ?? "").trim().slice(0, 40);
      if (!panelLabel) return json({ error: "INVALID_PANEL_LABEL" }, 400);

      const { error: revokeError } = await supabase
        .from("access_tokens")
        .update({ revoked: true })
        .eq("created_by", user.id)
        .eq("purpose", "reseller")
        .eq("panel_label", panelLabel)
        .eq("revoked", false)
        .is("used_by", null);
      if (revokeError) throw revokeError;

      const { data, error } = await supabase
        .from("access_tokens")
        .insert({
          code: makeCode(),
          plan: "lifetime",
          note: `Revenda: ${panelLabel}`,
          purpose: "reseller",
          panel_label: panelLabel,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return json({ token: data });
    }

    if (action === "revoke") {
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "INVALID_ID" }, 400);
      const { error } = await supabase.from("access_tokens").update({ revoked: true }).eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "UNKNOWN_ACTION" }, 400);
  } catch (err) {
    console.error("access-token error", err instanceof Error ? err.message : err);
    return json({ error: "INTERNAL_ERROR" }, 500);
  }
});
