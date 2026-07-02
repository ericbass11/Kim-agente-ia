import { prisma } from '../../lib/prisma.js';
import { sendWhatsAppText } from '../whatsapp/client.js';
import { emitToOrg } from '../../realtime/io.js';
import { logger } from '../../lib/logger.js';

const NPS_QUESTION =
  'Antes de encerrar, poderia avaliar nosso atendimento? 🙏\n' +
  'De 0 a 10, o quanto você recomendaria a gente para um amigo? (responda só com o número)';

export function npsCategory(score: number): 'PROMOTER' | 'PASSIVE' | 'DETRACTOR' {
  if (score >= 9) return 'PROMOTER';
  if (score >= 7) return 'PASSIVE';
  return 'DETRACTOR';
}

/** Dispara a pesquisa de NPS ao encerrar a conversa. */
export async function triggerNpsSurvey(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, channel: true, npsSurvey: true },
  });
  if (!conversation || conversation.npsSurvey) return;

  await prisma.npsSurvey.create({
    data: { conversationId, status: 'PENDING' },
  });

  await sendWhatsAppText({
    to: conversation.contact.waId,
    text: NPS_QUESTION,
    phoneNumberId: conversation.channel.phoneNumberId,
  });

  await prisma.message.create({
    data: { conversationId, senderType: 'SYSTEM', text: NPS_QUESTION },
  });

  emitToOrg(conversation.organizationId, 'nps:sent', { conversationId });
  logger.info({ conversationId }, 'Pesquisa de NPS enviada.');
}

/**
 * Tenta interpretar uma mensagem como resposta de NPS (0–10).
 * Retorna true se a mensagem foi consumida como resposta de NPS.
 */
export async function tryHandleNpsResponse(
  conversationId: string,
  organizationId: string,
  text: string,
): Promise<boolean> {
  const survey = await prisma.npsSurvey.findUnique({ where: { conversationId } });
  if (!survey || survey.status !== 'PENDING') return false;

  const match = text.match(/\b(10|[0-9])\b/);
  if (!match) return false;

  const score = Number(match[1]);
  const category = npsCategory(score);

  await prisma.npsSurvey.update({
    where: { conversationId },
    data: { status: 'RESPONDED', score, category, respondedAt: new Date(), comment: text },
  });

  emitToOrg(organizationId, 'nps:responded', { conversationId, score, category });
  logger.info({ conversationId, score, category }, 'NPS respondido.');
  return true;
}

/** Métricas de NPS de uma organização. */
export async function computeNpsMetrics(organizationId: string) {
  const surveys = await prisma.npsSurvey.findMany({
    where: { status: 'RESPONDED', conversation: { organizationId } },
    select: { score: true, category: true },
  });
  const total = surveys.length;
  const promoters = surveys.filter((s) => s.category === 'PROMOTER').length;
  const passives = surveys.filter((s) => s.category === 'PASSIVE').length;
  const detractors = surveys.filter((s) => s.category === 'DETRACTOR').length;
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
  return { total, promoters, passives, detractors, nps };
}
