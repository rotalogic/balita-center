// Provider WhatsApp Cloud API (Meta). Satu-satunya tempat yang memanggil Graph API.
// Nama env PERSIS seperti yang diminta halaman Ailsa di situs live:
// WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN,
// WHATSAPP_APP_SECRET, WHATSAPP_ADMIN_NUMBER.
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const VERIFY = process.env.WHATSAPP_VERIFY_TOKEN || "";
const SECRET = process.env.WHATSAPP_APP_SECRET || "";
export const ADMIN_NUMBER = (process.env.WHATSAPP_ADMIN_NUMBER || "").replace(/\D/g, "");
const BASE = (process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v21.0").replace(/\/$/, "");

export type SendResult = { ok: boolean; reason?: string; id?: string };

export type WhatsAppProvider = {
  sendText(to: string, text: string): Promise<SendResult>;
  sendTemplate(to: string, name: string, params?: string[]): Promise<SendResult>;
  sendButtons(to: string, body: string, buttons: Array<{ id: string; title: string }>): Promise<SendResult>;
};

export const TEMPLATES = ["follow_up_lead", "pengingat_trial", "laporan_harian_terbit", "pengingat_tagihan_spp"];

export function envStatus() {
  return [
    { name: "WHATSAPP_ACCESS_TOKEN", filled: Boolean(TOKEN) },
    { name: "WHATSAPP_PHONE_NUMBER_ID", filled: Boolean(PHONE_ID) },
    { name: "WHATSAPP_VERIFY_TOKEN", filled: Boolean(VERIFY) },
    { name: "WHATSAPP_APP_SECRET", filled: Boolean(SECRET) },
    { name: "WHATSAPP_ADMIN_NUMBER", filled: Boolean(ADMIN_NUMBER) },
  ];
}

export function whatsappConfigured(): boolean {
  return Boolean(TOKEN && PHONE_ID);
}

// Webhook hanya boleh menerima POST bila APP_SECRET terpasang.
export function webhookReady(): boolean {
  return Boolean(SECRET && VERIFY);
}

export function verifyToken(): string {
  return VERIFY;
}

async function kirim(payload: Record<string, unknown>): Promise<SendResult> {
  if (!whatsappConfigured()) {
    console.log(`[AILSA:DRY] ${JSON.stringify(payload).slice(0, 300)}`);
    return { ok: false, reason: "belum_dikonfigurasi" };
  }
  try {
    const res = await fetch(`${BASE}/${PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as { messages?: Array<{ id: string }>; error?: { message?: string } };
    if (!res.ok) {
      const pesan = data?.error?.message || `http_${res.status}`;
      console.error("[AILSA:ERROR]", pesan);
      return { ok: false, reason: pesan };
    }
    return { ok: true, id: data.messages?.[0]?.id };
  } catch {
    return { ok: false, reason: "gagal_kirim" };
  }
}

export const metaProvider: WhatsAppProvider = {
  sendText(to, text) {
    return kirim({ to, type: "text", text: { preview_url: false, body: text.slice(0, 4096) } });
  },
  sendTemplate(to, name, params = []) {
    return kirim({
      to,
      type: "template",
      template: {
        name,
        language: { code: "id" },
        components: params.length ? [{ type: "body", parameters: params.map((t) => ({ type: "text", text: t })) }] : [],
      },
    });
  },
  sendButtons(to, body, buttons) {
    return kirim({
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body.slice(0, 1024) },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
      },
    });
  },
};

// Logika bisnis memakai ini, bukan memanggil Graph API langsung.
export function provider(): WhatsAppProvider {
  return metaProvider;
}

export const sendText = (to: string, text: string) => provider().sendText(to, text);
export const sendTemplate = (to: string, name: string, params?: string[]) => provider().sendTemplate(to, name, params);
