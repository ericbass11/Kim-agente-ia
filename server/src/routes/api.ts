import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { emitToOrg } from '../realtime/io.js';
import { handleInbound } from '../modules/conversations/pipeline.js';
import { sendWhatsAppText } from '../modules/whatsapp/client.js';
import { triggerNpsSurvey, computeNpsMetrics } from '../modules/nps/nps.js';
import { summarizeConversation } from '../modules/ai/agent.js';

export const apiRouter = Router();

const asyncH =
  (fn: (req: any, res: any) => Promise<unknown>) =>
  (req: any, res: any, next: any) =>
    fn(req, res).catch(next);

// ───── Bootstrap (org demo para o frontend) ─────
apiRouter.get(
  '/bootstrap',
  asyncH(async (_req, res) => {
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    res.json({ organization: org });
  }),
);

// ───── Organizações ─────
apiRouter.get(
  '/organizations',
  asyncH(async (_req, res) => {
    res.json(await prisma.organization.findMany({ include: { franchises: true } }));
  }),
);

// ───── Franquias ─────
apiRouter.get(
  '/organizations/:orgId/franchises',
  asyncH(async (req, res) => {
    res.json(await prisma.franchise.findMany({ where: { organizationId: req.params.orgId } }));
  }),
);

// ───── Filas ─────
apiRouter.get(
  '/organizations/:orgId/queues',
  asyncH(async (req, res) => {
    const queues = await prisma.queue.findMany({
      where: { organizationId: req.params.orgId },
      include: { aiAgents: true, _count: { select: { conversations: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(queues);
  }),
);

const queueSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  color: z.string().optional(),
  franchiseId: z.string().optional(),
});

apiRouter.post(
  '/organizations/:orgId/queues',
  asyncH(async (req, res) => {
    const data = queueSchema.parse(req.body);
    const queue = await prisma.queue.create({
      data: { organizationId: req.params.orgId, ...data, keywords: data.keywords ?? [] },
    });
    res.status(201).json(queue);
  }),
);

apiRouter.patch(
  '/queues/:id',
  asyncH(async (req, res) => {
    const data = queueSchema.partial().parse(req.body);
    res.json(await prisma.queue.update({ where: { id: req.params.id }, data }));
  }),
);

// ───── Agentes de IA ─────
apiRouter.get(
  '/organizations/:orgId/agents',
  asyncH(async (req, res) => {
    res.json(
      await prisma.aIAgent.findMany({
        where: { organizationId: req.params.orgId },
        include: { queue: true },
        orderBy: { createdAt: 'asc' },
      }),
    );
  }),
);

const agentSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  knowledge: z.string().optional(),
  queueId: z.string().optional(),
  model: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  active: z.boolean().optional(),
});

apiRouter.post(
  '/organizations/:orgId/agents',
  asyncH(async (req, res) => {
    const data = agentSchema.parse(req.body);
    const agent = await prisma.aIAgent.create({
      data: { organizationId: req.params.orgId, ...data },
    });
    res.status(201).json(agent);
  }),
);

apiRouter.patch(
  '/agents/:id',
  asyncH(async (req, res) => {
    const data = agentSchema.partial().parse(req.body);
    res.json(await prisma.aIAgent.update({ where: { id: req.params.id }, data }));
  }),
);

// ───── Conversas (inbox) ─────
apiRouter.get(
  '/organizations/:orgId/conversations',
  asyncH(async (req, res) => {
    const { status, queueId } = req.query as { status?: string; queueId?: string };
    const conversations = await prisma.conversation.findMany({
      where: {
        organizationId: req.params.orgId,
        ...(status ? { status: status as any } : {}),
        ...(queueId ? { queueId } : {}),
      },
      include: {
        contact: true,
        queue: true,
        aiAgent: true,
        classification: true,
        tags: { include: { tag: true } },
        npsSurvey: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    res.json(conversations);
  }),
);

apiRouter.get(
  '/conversations/:id',
  asyncH(async (req, res) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        contact: true,
        queue: true,
        aiAgent: true,
        classification: true,
        tags: { include: { tag: true } },
        npsSurvey: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) return res.sendStatus(404);
    res.json(conversation);
  }),
);

// Atendente humano assume a conversa
apiRouter.post(
  '/conversations/:id/takeover',
  asyncH(async (req, res) => {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { handlingMode: 'HUMAN', assignedUserId: req.body.userId ?? undefined },
    });
    emitToOrg(conversation.organizationId, 'conversation:updated', { conversationId: conversation.id });
    res.json(conversation);
  }),
);

// Devolve a conversa para a IA
apiRouter.post(
  '/conversations/:id/release',
  asyncH(async (req, res) => {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { handlingMode: 'AI', assignedUserId: null },
    });
    emitToOrg(conversation.organizationId, 'conversation:updated', { conversationId: conversation.id });
    res.json(conversation);
  }),
);

// Atendente humano envia mensagem
apiRouter.post(
  '/conversations/:id/reply',
  asyncH(async (req, res) => {
    const text = z.string().min(1).parse(req.body.text);
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { contact: true, channel: true },
    });
    const sent = await sendWhatsAppText({
      to: conversation.contact.waId,
      text,
      phoneNumberId: conversation.channel.phoneNumberId,
    });
    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'HUMAN',
        senderId: req.body.userId ?? null,
        text,
        waMessageId: sent.messageId,
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
    emitToOrg(conversation.organizationId, 'message:new', { conversationId: conversation.id, message });
    res.status(201).json(message);
  }),
);

// Encerra conversa e dispara NPS
apiRouter.post(
  '/conversations/:id/resolve',
  asyncH(async (req, res) => {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED' },
    });
    await triggerNpsSurvey(conversation.id);
    emitToOrg(conversation.organizationId, 'conversation:updated', { conversationId: conversation.id });
    res.json(conversation);
  }),
);

// Gera/atualiza resumo por IA
apiRouter.post(
  '/conversations/:id/summarize',
  asyncH(async (req, res) => {
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id, senderType: { in: ['CONTACT', 'AI', 'HUMAN'] } },
      orderBy: { createdAt: 'asc' },
    });
    const summary = await summarizeConversation(
      messages.map((m) => ({ role: m.senderType === 'CONTACT' ? 'contact' : 'agent', text: m.text })),
    );
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { summary },
    });
    res.json({ summary: conversation.summary });
  }),
);

// ───── Tags ─────
apiRouter.get(
  '/organizations/:orgId/tags',
  asyncH(async (req, res) => {
    res.json(await prisma.tag.findMany({ where: { organizationId: req.params.orgId } }));
  }),
);

apiRouter.post(
  '/conversations/:id/tags',
  asyncH(async (req, res) => {
    const { name, color } = z.object({ name: z.string(), color: z.string().optional() }).parse(req.body);
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id: req.params.id } });
    const tag = await prisma.tag.upsert({
      where: { organizationId_name: { organizationId: conversation.organizationId, name } },
      update: {},
      create: { organizationId: conversation.organizationId, name, color: color ?? '#10b981' },
    });
    await prisma.conversationTag.upsert({
      where: { conversationId_tagId: { conversationId: conversation.id, tagId: tag.id } },
      update: {},
      create: { conversationId: conversation.id, tagId: tag.id, auto: false },
    });
    res.status(201).json(tag);
  }),
);

// ───── NPS ─────
apiRouter.get(
  '/organizations/:orgId/nps',
  asyncH(async (req, res) => {
    res.json(await computeNpsMetrics(req.params.orgId));
  }),
);

// ───── DEV: simular mensagem recebida (sem WhatsApp real) ─────
apiRouter.post(
  '/dev/simulate-inbound',
  asyncH(async (req, res) => {
    const { from, text } = z.object({ from: z.string(), text: z.string() }).parse(req.body);
    const channel = await prisma.whatsAppChannel.findFirst();
    if (!channel) return res.status(400).json({ error: 'Nenhum canal WhatsApp cadastrado. Rode o seed.' });
    await handleInbound({
      from,
      phoneNumberId: channel.phoneNumberId,
      text,
      contactName: req.body.name,
      waMessageId: `sim-${Date.now()}`,
    });
    res.json({ ok: true });
  }),
);
