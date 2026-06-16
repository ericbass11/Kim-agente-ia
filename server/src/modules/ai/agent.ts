import { anthropic, aiEnabled, AI_MODEL, firstText, createMessage } from '../../lib/anthropic.js';
import { logger } from '../../lib/logger.js';

export interface AgentConfig {
  name: string;
  systemPrompt: string;
  knowledge?: string | null;
  model?: string;
  effort?: string;
}

export interface AgentReplyInput {
  agent: AgentConfig;
  organizationName: string;
  contactName?: string | null;
  history: { role: 'contact' | 'agent'; text: string }[];
}

/**
 * Gera a resposta humanizada do agente especialista para a conversa.
 */
export async function generateAgentReply(input: AgentReplyInput): Promise<string> {
  if (!aiEnabled || !anthropic) {
    return (
      `Olá! Sou o assistente virtual ${input.agent.name} da ${input.organizationName}. ` +
      'No momento estou em modo de demonstração (IA não configurada). Um atendente irá te responder em breve. 🙂'
    );
  }

  const system = [
    `Você é "${input.agent.name}", um agente de atendimento virtual da rede ${input.organizationName}.`,
    'Atenda de forma humanizada, cordial e objetiva, em português do Brasil. Use no máximo 2 ou 3 frases por mensagem.',
    'Nunca invente informações: se não souber, diga que vai encaminhar para um atendente humano.',
    '',
    input.agent.systemPrompt,
    input.agent.knowledge ? `\n## Base de conhecimento\n${input.agent.knowledge}` : '',
  ].join('\n');

  const messages = input.history.map((m) => ({
    role: m.role === 'contact' ? ('user' as const) : ('assistant' as const),
    content: m.text,
  }));

  // garante que a conversa começa com 'user'
  while (messages.length > 0 && messages[0].role !== 'user') {
    messages.shift();
  }
  if (messages.length === 0) {
    messages.push({ role: 'user', content: 'Olá' });
  }

  try {
    const response = await createMessage({
      model: input.agent.model || AI_MODEL,
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      output_config: { effort: (input.agent.effort as 'low' | 'medium' | 'high') || 'medium' },
      system,
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return 'Desculpe, não consigo ajudar com isso por aqui. Vou encaminhar para um atendente humano. 🙏';
    }
    return firstText(response).trim();
  } catch (err) {
    logger.error({ err }, 'Falha ao gerar resposta do agente de IA.');
    return 'Tive um problema técnico agora. Já estou chamando um atendente humano para te ajudar. 🙏';
  }
}

/** Gera um resumo curto da conversa (para handoff humano). */
export async function summarizeConversation(
  history: { role: 'contact' | 'agent'; text: string }[],
): Promise<string> {
  if (!aiEnabled || !anthropic || history.length === 0) {
    return history
      .slice(-4)
      .map((h) => `${h.role === 'contact' ? 'Cliente' : 'Agente'}: ${h.text}`)
      .join(' | ');
  }
  const transcript = history
    .map((h) => `${h.role === 'contact' ? 'Cliente' : 'Agente'}: ${h.text}`)
    .join('\n');
  try {
    const response = await createMessage({
      model: AI_MODEL,
      max_tokens: 512,
      output_config: { effort: 'low' },
      system:
        'Resuma a conversa de atendimento em 2 frases objetivas (português do Brasil), ' +
        'destacando o que o cliente quer e o status atual.',
      messages: [{ role: 'user', content: transcript }],
    });
    return firstText(response).trim();
  } catch {
    return transcript.slice(0, 300);
  }
}
