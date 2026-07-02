import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { emitToOrg } from '../../realtime/io.js';
import { orchestrate } from '../ai/orchestrator.js';
import { generateAgentReply } from '../ai/agent.js';
import { sendWhatsAppText } from '../whatsapp/client.js';
import { tryHandleNpsResponse } from '../nps/nps.js';

export interface InboundEvent {
  waMessageId?: string;
  from: string; // waId do cliente
  phoneNumberId: string; // canal que recebeu
  text: string;
  contactName?: string;
}

/**
 * Pipeline principal: processa uma mensagem recebida do WhatsApp.
 * 1. resolve canal / contato / conversa
 * 2. persiste a mensagem do cliente
 * 3. se for resposta de NPS, consome e encerra
 * 4. roteia via orquestrador (intenção → fila → agente)
 * 5. aplica classificação + tags automáticas
 * 6. gera e envia resposta do agente (se em modo IA)
 */
export async function handleInbound(event: InboundEvent): Promise<void> {
  const channel = await prisma.whatsAppChannel.findUnique({
    where: { phoneNumberId: event.phoneNumberId },
  });
  if (!channel) {
    logger.warn({ phoneNumberId: event.phoneNumberId }, 'Canal WhatsApp não cadastrado, ignorando.');
    return;
  }
  const organizationId = channel.organizationId;

  // idempotência: evita reprocessar a mesma mensagem da Meta
  if (event.waMessageId) {
    const exists = await prisma.message.findUnique({ where: { waMessageId: event.waMessageId } });
    if (exists) return;
  }

  // contato
  const contact = await prisma.contact.upsert({
    where: { organizationId_waId: { organizationId, waId: event.from } },
    update: event.contactName ? { name: event.contactName } : {},
    create: { organizationId, waId: event.from, name: event.contactName },
  });

  // conversa aberta existente ou nova
  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, channelId: channel.id, status: { in: ['OPEN', 'WAITING'] } },
    orderBy: { lastMessageAt: 'desc' },
  });
  const isNewConversation = !conversation;
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        organizationId,
        contactId: contact.id,
        channelId: channel.id,
        status: 'OPEN',
        handlingMode: 'AI',
      },
    });
  }

  // persiste mensagem do cliente
  const contactMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderType: 'CONTACT',
      text: event.text,
      waMessageId: event.waMessageId,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), status: 'OPEN' },
  });
  emitToOrg(organizationId, 'message:new', { conversationId: conversation.id, message: contactMessage });

  // É resposta de pesquisa NPS?
  const wasNps = await tryHandleNpsResponse(conversation.id, organizationId, event.text);
  if (wasNps) {
    await sendWhatsAppText({
      to: contact.waId,
      text: 'Obrigado pela sua avaliação! 💚',
      phoneNumberId: channel.phoneNumberId,
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'CLOSED' } });
    return;
  }

  // histórico recente para contexto
  const history = await loadHistory(conversation.id);

  // roteia se for conversa nova ou ainda sem fila
  if (isNewConversation || !conversation.queueId) {
    await routeConversation(conversation.id, organizationId, event.text, history);
    conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } });
  }

  // se um humano assumiu, não respondemos automaticamente
  if (conversation.handlingMode === 'HUMAN') {
    logger.debug({ conversationId: conversation.id }, 'Conversa em modo humano, IA não responde.');
    return;
  }

  await respondWithAgent(conversation.id, organizationId);
}

/** Carrega o histórico (texto) recente da conversa. */
async function loadHistory(conversationId: string) {
  const messages = await prisma.message.findMany({
    where: { conversationId, senderType: { in: ['CONTACT', 'AI', 'HUMAN'] } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  return messages.map((m) => ({
    role: (m.senderType === 'CONTACT' ? 'contact' : 'agent') as 'contact' | 'agent',
    text: m.text,
  }));
}

/** Usa o orquestrador para definir fila, agente, classificação e tags. */
async function routeConversation(
  conversationId: string,
  organizationId: string,
  message: string,
  history: { role: 'contact' | 'agent'; text: string }[],
) {
  const queues = await prisma.queue.findMany({
    where: { organizationId, active: true },
    select: { id: true, name: true, description: true, keywords: true },
  });

  const result = await orchestrate({ message, history, queues });

  // agente especialista da fila escolhida
  let aiAgentId: string | null = null;
  if (result.queueId) {
    const agent = await prisma.aIAgent.findFirst({
      where: { organizationId, queueId: result.queueId, active: true },
    });
    aiAgentId = agent?.id ?? null;
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { queueId: result.queueId ?? undefined, aiAgentId: aiAgentId ?? undefined },
  });

  // classificação automática
  await prisma.classification.upsert({
    where: { conversationId },
    update: {
      intent: result.intent,
      category: result.category,
      sentiment: result.sentiment,
      priority: result.priority,
      confidence: result.confidence,
    },
    create: {
      conversationId,
      intent: result.intent,
      category: result.category,
      sentiment: result.sentiment,
      priority: result.priority,
      confidence: result.confidence,
    },
  });

  // tags automáticas
  for (const tagName of result.tags ?? []) {
    const tag = await prisma.tag.upsert({
      where: { organizationId_name: { organizationId, name: tagName } },
      update: {},
      create: { organizationId, name: tagName, color: '#a855f7' },
    });
    await prisma.conversationTag.upsert({
      where: { conversationId_tagId: { conversationId, tagId: tag.id } },
      update: {},
      create: { conversationId, tagId: tag.id, auto: true },
    });
  }

  emitToOrg(organizationId, 'conversation:routed', {
    conversationId,
    queueId: result.queueId,
    classification: result,
  });
  logger.info({ conversationId, queueId: result.queueId, intent: result.intent }, 'Conversa roteada.');
}

/** Gera e envia a resposta do agente especialista. */
async function respondWithAgent(conversationId: string, organizationId: string) {
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { aiAgent: true, contact: true, channel: true, organization: true },
  });

  const history = await loadHistory(conversationId);

  const replyText = await generateAgentReply({
    agent: conversation.aiAgent
      ? {
          name: conversation.aiAgent.name,
          systemPrompt: conversation.aiAgent.systemPrompt,
          knowledge: conversation.aiAgent.knowledge,
          model: conversation.aiAgent.model,
          effort: conversation.aiAgent.effort,
        }
      : {
          name: 'Assistente KIM',
          systemPrompt:
            'Você é um atendente virtual geral. Seja cordial e ajude o cliente ou encaminhe para a área correta.',
        },
    organizationName: conversation.organization.name,
    contactName: conversation.contact.name,
    history,
  });

  const sent = await sendWhatsAppText({
    to: conversation.contact.waId,
    text: replyText,
    phoneNumberId: conversation.channel.phoneNumberId,
  });

  const agentMessage = await prisma.message.create({
    data: {
      conversationId,
      senderType: 'AI',
      senderId: conversation.aiAgentId,
      text: replyText,
      waMessageId: sent.messageId,
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  emitToOrg(organizationId, 'message:new', { conversationId, message: agentMessage });
}
