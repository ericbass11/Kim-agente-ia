# KIM — CRM de WhatsApp com Agentes de IA para Redes de Franquias

KIM é um CRM omnichannel focado em **WhatsApp** para **redes de franquias no Brasil**.
Ele conecta-se à **API Oficial da Meta (WhatsApp Cloud API)** e usa um **Orquestrador de IA**
que identifica a necessidade do usuário e direciona a conversa para o **Agente especialista**
correto, distribuído em **múltiplas filas**.

> Atendimento humanizado com LLM (Claude), com tudo o que um CRM de ponta precisa:
> multi-filas, múltiplos agentes de IA, tags, classificação automática, NPS automático,
> caixa de entrada em tempo real e gestão por unidade/franquia.

---

## ✨ Principais recursos

- **WhatsApp API Oficial (Meta Cloud API)** — webhook de recebimento + envio de mensagens.
- **Orquestrador de IA** — classifica a intenção e roteia para a fila/agente especialista.
- **Múltiplos Agentes de IA** — cada agente tem persona, prompt, base de conhecimento e fila.
- **Multi-filas** — atendimento, vendas, financeiro, suporte técnico, etc. por unidade.
- **Atendimento humanizado** — respostas geradas com Claude (`claude-opus-4-8`), com handoff humano.
- **Tags & Classificação automática** — intenção, categoria e sentimento por conversa.
- **NPS automático** — disparo da pesquisa ao encerrar e cálculo de score (Promotor/Neutro/Detrator).
- **Tempo real** — caixa de entrada via WebSocket (Socket.IO).
- **Multi-tenant por rede de franquias** — Organização → Franquias → Filas/Canais.

## 🏗️ Arquitetura

```
WhatsApp (Meta Cloud API)
        │  webhook
        ▼
  ┌───────────────┐     ┌──────────────────────┐
  │  Webhook /    │────▶│  Orquestrador de IA   │ classifica intenção
  │  Ingestão     │     │  (Claude tool-use)    │ → escolhe fila/agente
  └───────────────┘     └──────────┬───────────┘
        │                          │
        ▼                          ▼
  ┌───────────────┐     ┌──────────────────────┐
  │ Conversas /   │◀───▶│  Agente Especialista  │ responde humanizado
  │ Filas / Tags  │     │  (Claude por fila)    │
  └──────┬────────┘     └──────────────────────┘
         │ Socket.IO (tempo real)
         ▼
   Frontend React (Inbox, Filas, Agentes IA, NPS)
```

Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 📦 Stack

| Camada    | Tecnologia                                              |
|-----------|---------------------------------------------------------|
| Backend   | Node.js, TypeScript, Express, Prisma, Socket.IO         |
| Banco     | PostgreSQL                                              |
| IA        | Claude (`@anthropic-ai/sdk`) — orquestrador + agentes   |
| WhatsApp  | Meta WhatsApp Cloud API (Graph API)                     |
| Frontend  | React, Vite, TypeScript                                 |

## 🚀 Começando

### 1. Pré-requisitos
- Node.js 20+
- PostgreSQL 14+ (ou use `docker compose up -d db`)
- Uma conta na **Meta for Developers** com WhatsApp Cloud API
- Uma **ANTHROPIC_API_KEY**

### 2. Configuração

```bash
cp .env.example .env       # preencha as variáveis
npm install                # instala server e web (workspaces)
npm run db:migrate         # cria o schema no Postgres
npm run db:seed            # dados de exemplo (rede de franquias demo)
```

### 3. Rodando

```bash
npm run dev                # sobe backend (4000) e frontend (5173) juntos
```

- API: http://localhost:4000
- Frontend: http://localhost:5173
- Healthcheck: http://localhost:4000/health

### 4. Conectando o WhatsApp (Meta)

1. No painel da Meta, configure o webhook apontando para
   `https://SEU_DOMINIO/api/webhooks/whatsapp` com o `WHATSAPP_VERIFY_TOKEN` do `.env`.
2. Assine os campos `messages`.
3. Preencha `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_APP_SECRET`.

Veja [`docs/WHATSAPP_SETUP.md`](docs/WHATSAPP_SETUP.md).

## 🧪 Sem WhatsApp real? Use o simulador

```bash
# simula uma mensagem de cliente chegando, passando pelo orquestrador
curl -X POST http://localhost:4000/api/dev/simulate-inbound \
  -H 'Content-Type: application/json' \
  -d '{"from":"5511999999999","text":"Quero saber como abrir uma franquia"}'
```

## 📁 Estrutura

```
server/   # API, orquestrador de IA, integração WhatsApp, Prisma
web/      # Frontend React (Vite)
docs/     # Documentação de arquitetura e setup
```

## 📝 Licença
Proprietária — projeto interno.
