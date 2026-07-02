import { Router, type Request } from 'express';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  parseInboundMessages,
  verifyWebhookSignature,
} from '../modules/whatsapp/client.js';
import { handleInbound } from '../modules/conversations/pipeline.js';

export const webhooksRouter = Router();

// Verificação do webhook (handshake da Meta)
webhooksRouter.get('/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.whatsapp.verifyToken) {
    logger.info('Webhook do WhatsApp verificado com sucesso.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recebimento de eventos (mensagens)
webhooksRouter.post('/whatsapp', async (req: Request & { rawBody?: Buffer }, res) => {
  const signature = req.header('x-hub-signature-256');
  if (req.rawBody && !verifyWebhookSignature(req.rawBody, signature)) {
    logger.warn('Assinatura inválida no webhook do WhatsApp.');
    return res.sendStatus(401);
  }

  // responde rápido à Meta e processa de forma assíncrona
  res.sendStatus(200);

  try {
    const messages = parseInboundMessages(req.body);
    for (const msg of messages) {
      await handleInbound({
        waMessageId: msg.waMessageId,
        from: msg.from,
        phoneNumberId: msg.phoneNumberId,
        text: msg.text,
        contactName: msg.contactName,
      });
    }
  } catch (err) {
    logger.error({ err }, 'Erro ao processar webhook do WhatsApp.');
  }
});
