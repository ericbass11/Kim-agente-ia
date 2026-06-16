import { anthropic, aiEnabled, AI_MODEL, firstText, createMessage } from '../../lib/anthropic.js';
import { logger } from '../../lib/logger.js';

export interface QueueOption {
  id: string;
  name: string;
  description?: string | null;
  keywords?: string[];
}

export interface OrchestratorInput {
  message: string;
  /** histórico recente (texto) para dar contexto ao roteamento */
  history?: { role: 'contact' | 'agent'; text: string }[];
  queues: QueueOption[];
}

export interface OrchestratorResult {
  queueId: string | null;
  intent: string;
  category: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  /** tags sugeridas pela IA */
  tags: string[];
  reasoning?: string;
}

/**
 * Orquestrador: identifica a necessidade do usuário e direciona para a fila
 * do agente especialista. Usa Claude com saída estruturada (JSON schema).
 * Se a IA estiver desabilitada, faz fallback por palavras-chave.
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  if (!aiEnabled || !anthropic) {
    return keywordFallback(input);
  }

  const queueList = input.queues
    .map((q) => `- id="${q.id}" nome="${q.name}"${q.description ? ` propósito="${q.description}"` : ''}`)
    .join('\n');

  const historyText = (input.history ?? [])
    .slice(-6)
    .map((h) => `${h.role === 'contact' ? 'Cliente' : 'Atendente'}: ${h.text}`)
    .join('\n');

  const system = [
    'Você é o Orquestrador de um CRM de WhatsApp para uma rede de franquias no Brasil.',
    'Sua tarefa é analisar a mensagem do cliente e roteá-la para a fila do agente especialista correto.',
    'Classifique a intenção, categoria, sentimento e prioridade. Responda em português do Brasil.',
    'Escolha o queueId mais adequado dentre as filas disponíveis. Se nenhuma servir, use null.',
    '',
    'Filas disponíveis:',
    queueList || '(nenhuma fila cadastrada)',
  ].join('\n');

  const userContent = [
    historyText ? `Histórico recente:\n${historyText}\n` : '',
    `Mensagem atual do cliente:\n"""${input.message}"""`,
  ].join('\n');

  const queueIds = input.queues.map((q) => q.id);

  try {
    const response = await createMessage({
      model: AI_MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              queueId: { type: ['string', 'null'], enum: [...queueIds, null] },
              intent: { type: 'string' },
              category: { type: 'string' },
              sentiment: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
              priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
              confidence: { type: 'number' },
              tags: { type: 'array', items: { type: 'string' } },
              reasoning: { type: 'string' },
            },
            required: ['queueId', 'intent', 'category', 'sentiment', 'priority', 'confidence', 'tags'],
            additionalProperties: false,
          },
        },
      },
      system,
      messages: [{ role: 'user', content: userContent }],
    });

    if (response.stop_reason === 'refusal') {
      logger.warn('Orquestrador: requisição recusada pela IA, usando fallback.');
      return keywordFallback(input);
    }

    const parsed = JSON.parse(firstText(response)) as OrchestratorResult;
    // valida o queueId retornado
    if (parsed.queueId && !queueIds.includes(parsed.queueId)) {
      parsed.queueId = null;
    }
    return parsed;
  } catch (err) {
    logger.error({ err }, 'Falha no orquestrador de IA, usando fallback por palavras-chave.');
    return keywordFallback(input);
  }
}

/** Roteamento de contingência por palavras-chave (sem IA). */
function keywordFallback(input: OrchestratorInput): OrchestratorResult {
  const text = input.message.toLowerCase();
  let best: { id: string; hits: number } | null = null;

  for (const q of input.queues) {
    const hits = (q.keywords ?? []).filter((kw) => text.includes(kw.toLowerCase())).length;
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { id: q.id, hits };
    }
  }

  const negativeWords = ['reclama', 'péssimo', 'pessimo', 'horrível', 'horrivel', 'cancelar', 'insatisfeito'];
  const sentiment = negativeWords.some((w) => text.includes(w)) ? 'NEGATIVE' : 'NEUTRAL';

  return {
    queueId: best?.id ?? input.queues[0]?.id ?? null,
    intent: 'indefinido',
    category: 'Geral',
    sentiment,
    priority: sentiment === 'NEGATIVE' ? 'HIGH' : 'MEDIUM',
    confidence: best ? 0.5 : 0.2,
    tags: [],
    reasoning: 'Roteamento por palavras-chave (IA indisponível).',
  };
}
