import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

/**
 * Cliente Claude (Anthropic). Centraliza a criação do client e expõe um helper
 * para saber se a IA está habilitada (chave configurada).
 */
export const anthropic = env.ai.enabled ? new Anthropic({ apiKey: env.ai.apiKey }) : null;

export const aiEnabled = env.ai.enabled;
export const AI_MODEL = env.ai.model;

/**
 * Wrapper de `messages.create`. Os tipos do SDK podem estar atrás da API
 * (ex.: `thinking: { type: 'adaptive' }` e `output_config`), por isso aceitamos
 * `params` flexível e retornamos sempre uma `Message` (chamadas não-streaming).
 */
export async function createMessage(params: Record<string, unknown>): Promise<Anthropic.Message> {
  if (!anthropic) throw new Error('IA não habilitada');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return anthropic.messages.create(params as any) as Promise<Anthropic.Message>;
}

/** Extrai o primeiro bloco de texto de uma resposta de mensagens. */
export function firstText(message: Anthropic.Message): string {
  for (const block of message.content) {
    if (block.type === 'text') return block.text;
  }
  return '';
}
