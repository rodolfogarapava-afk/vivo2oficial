import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const safeGatewayMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") return record.message;
  if (record.error && typeof record.error === "object") {
    const message = (record.error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Faça login novamente." }, 401);

    const backend = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await backend.auth.getUser();
    if (userError || !userData.user) return json({ error: "Faça login novamente." }, 401);

    const body = await req.json().catch(() => ({}));
    const clientName = String(body.clientName ?? "").trim().slice(0, 100);
    const phone = String(body.phone ?? "").trim().slice(0, 30);
    const chip = String(body.chip ?? "").trim().slice(0, 120);
    const offer = String(body.offer ?? "").trim().slice(0, 300);
    const reseller = String(body.reseller ?? "").trim().slice(0, 80);

    if (!clientName || !phone || !chip || !offer) {
      return json({ error: "Preencha os dados do cliente, do chip e da oferta." }, 400);
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "A geração de mensagens não está configurada." }, 500);

    const gatewayResponse = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          {
            role: "developer",
            content: [{
              type: "input_text",
              text: "Crie somente uma mensagem pronta para WhatsApp em português do Brasil. Seja cordial, comercial e breve. Use poucos emojis, destaque informações importantes com asteriscos e não invente preço, prazo, benefício ou condição. Não inclua explicações antes ou depois da mensagem.",
            }],
          },
          {
            role: "user",
            content: [{
              type: "input_text",
              text: `Revendedor: ${reseller || "não informado"}\nCliente: ${clientName}\nTelefone: ${phone}\nChip: ${chip}\nOferta: ${offer}`,
            }],
          },
        ],
      }),
    });

    if (!gatewayResponse.ok) {
      const payload = await gatewayResponse.json().catch(() => null);
      return json(
        { error: safeGatewayMessage(payload, "Não foi possível gerar a mensagem agora.") },
        gatewayResponse.status,
      );
    }

    if (!gatewayResponse.body) return json({ error: "A mensagem voltou vazia. Tente novamente." }, 502);

    const reader = gatewayResponse.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let message = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as { type?: string; delta?: string };
            if (parsed.type === "response.output_text.delta" && parsed.delta) message += parsed.delta;
          } catch {
            // Ignore incomplete metadata events; text deltas are accumulated above.
          }
        }
      }
    }

    if (!message.trim()) return json({ error: "A mensagem voltou vazia. Tente novamente." }, 502);
    return json({ message: message.trim() });
  } catch (error) {
    console.error("generate-whatsapp-message", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível gerar a mensagem agora." }, 500);
  }
});