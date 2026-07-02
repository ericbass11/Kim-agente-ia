import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

/**
 * Cliente da WhatsApp Cloud API (Meta Graph API).
 * Envia mensagens de texto e valida a assinatura do webhook.
 */

interface SendTextParams {
  to: string; // waId (E.164 sem '+')
  text: string;
  phoneNumberId?: string;
  accessToken?: string;
}

export async function sendWhatsAppText(params: SendTextParams): Promise<{ messageId?: string }> {
  const phoneNumberId = params.phoneNumberId || env.whatsapp.phoneNumberId;
  const accessToken = params.accessToken || env.whatsapp.accessToken;

  if (!env.whatsapp.enabled || !phoneNumberId || !accessToken) {
    logger.warn({ to: params.to }, '[WhatsApp DESABILITADO] Mensagem não enviada (modo demo).');
    return { messageId: `demo-${Date.now()}` };
  }

  const url = `https://graph.facebook.com/${env.whatsapp.graphVersion}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.to,
    type: 'text',
    text: { preview_url: false, body: params.text },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error({ status: res.status, errText }, 'Erro ao enviar mensagem no WhatsApp.');
    throw new Error(`WhatsApp send falhou: ${res.status}`);
  }

  const data = (await res.json()) as { messages?: { id: string }[] };
  return { messageId: data.messages?.[0]?.id };
}

/** Valida a assinatura X-Hub-Signature-256 do webhook da Meta. */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader?: string): boolean {
  if (!env.whatsapp.appSecret) {
    // sem app secret configurado, não valida (modo dev)
    return true;
  }
  if (!signatureHeader) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', env.whatsapp.appSecret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

// ───── Parsing do payload do webhook ─────

export interface ParsedInboundMessage {
  waMessageId: string;
  from: string; // waId do cliente
  phoneNumberId: string; // canal que recebeu
  text: string;
  contactName?: string;
  timestamp: number;
}

/** Extrai mensagens de texto recebidas do payload do webhook da Meta. */
export function parseInboundMessages(payload: any): ParsedInboundMessage[] {
  const result: ParsedInboundMessage[] = [];
  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = value.metadata?.phone_number_id ?? '';
      const contactsByWa: Record<string, string> = {};
      for (const c of value.contacts ?? []) {
        if (c.wa_id) contactsByWa[c.wa_id] = c.profile?.name;
      }
      for (const msg of value.messages ?? []) {
        if (msg.type !== 'text') continue; // MVP: apenas texto
        result.push({
          waMessageId: msg.id,
          from: msg.from,
          phoneNumberId,
          text: msg.text?.body ?? '',
          contactName: contactsByWa[msg.from],
          timestamp: Number(msg.timestamp) * 1000,
        });
      }
    }
  }
  return result;
}
