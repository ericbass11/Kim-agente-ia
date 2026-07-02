# Arquitetura do KIM

## Visão geral

KIM é um CRM omnichannel (WhatsApp-first) multi-tenant para redes de franquias.
O fluxo central é: **mensagem recebida → orquestrador classifica e roteia →
agente especialista responde → atendente humano pode assumir → NPS ao encerrar.**

## Camadas

### 1. Ingestão (WhatsApp Cloud API)
- `GET /api/webhooks/whatsapp` — handshake de verificação da Meta.
- `POST /api/webhooks/whatsapp` — recebe eventos; valida `X-Hub-Signature-256`
  com o `APP_SECRET`, responde `200` imediatamente e processa de forma assíncrona.
- `parseInboundMessages` extrai mensagens de texto do payload.

### 2. Pipeline de conversa (`modules/conversations/pipeline.ts`)
Para cada mensagem recebida:
1. Resolve **canal → contato → conversa** (reaproveita conversa aberta ou cria nova).
2. Persiste a mensagem e emite `message:new` via Socket.IO.
3. Se for resposta de **NPS**, registra a nota e encerra.
4. Em conversa nova/sem fila, chama o **Orquestrador**.
5. Aplica **classificação** (intenção, categoria, sentimento, prioridade) e **tags** automáticas.
6. Se em modo IA, gera a resposta do **agente especialista** e envia pelo WhatsApp.

### 3. Inteligência (`modules/ai`)
- **Orquestrador** (`orchestrator.ts`): usa Claude com *saída estruturada* (JSON Schema)
  para escolher a fila e classificar a conversa. Fallback por palavras-chave se a IA
  estiver indisponível.
- **Agente especialista** (`agent.ts`): gera respostas humanizadas com a persona,
  prompt e base de conhecimento configurados na fila. `summarizeConversation` produz
  resumo para handoff humano.
- Modelo padrão: `claude-opus-4-8` com *adaptive thinking* e parâmetro `effort`.

### 4. Tempo real (`realtime/io.ts`)
Socket.IO em salas por organização (`org:<id>`). Eventos:
`message:new`, `conversation:routed`, `conversation:updated`, `nps:sent`, `nps:responded`.

### 5. Dados (Prisma + PostgreSQL)
`Organization → Franchise → Queue/WhatsAppChannel`,
`AIAgent` (por fila), `Contact`, `Conversation → Message`,
`Tag/ConversationTag`, `Classification`, `NpsSurvey`.

## Decisões de design

- **Handoff humano**: `Conversation.handlingMode` (`AI`/`HUMAN`). Quando humano assume,
  a IA para de responder automaticamente.
- **Idempotência**: `Message.waMessageId` único evita reprocessar webhooks repetidos.
- **Modo demo**: sem `ANTHROPIC_API_KEY` ou credenciais da Meta, o sistema continua
  funcional (respostas placeholder e "envio" simulado), útil para desenvolvimento.

## Próximos passos sugeridos
- Filas de jobs (BullMQ) para processar webhooks com retry.
- Mídia (imagens/áudio) além de texto.
- Autenticação/RBAC completa por papel de usuário.
- Templates de mensagem (HSM) para iniciar conversas.
- Relatórios e SLA por fila/unidade.
