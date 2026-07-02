# Conectando o WhatsApp (Meta Cloud API)

## 1. Crie um app na Meta
1. Acesse https://developers.facebook.com/ → **Meus Apps** → **Criar app** → tipo *Business*.
2. Adicione o produto **WhatsApp**.

## 2. Obtenha as credenciais
- **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
- **Token de acesso** (recomendado: System User permanente) → `WHATSAPP_ACCESS_TOKEN`
- **App Secret** (Configurações → Básico) → `WHATSAPP_APP_SECRET`

## 3. Configure o webhook
1. Em **WhatsApp → Configuração**, defina a URL de callback:
   `https://SEU_DOMINIO/api/webhooks/whatsapp`
2. Use como *Verify Token* o valor de `WHATSAPP_VERIFY_TOKEN` (ex.: `kim-verify-token`).
3. Clique em **Verificar e salvar** (a Meta chamará `GET` para validar).
4. Em **Campos do webhook**, assine **`messages`**.

> Em desenvolvimento, exponha a porta local com um túnel (ex.: `ngrok http 4000`)
> e use a URL HTTPS gerada.

## 4. Cadastre o canal no KIM
O canal precisa existir no banco com o mesmo `phoneNumberId`. O `seed` cria um canal
usando `WHATSAPP_PHONE_NUMBER_ID` do `.env` (ou um id de demonstração). Para produção,
crie o `WhatsAppChannel` da sua organização com o `phoneNumberId` real.

## 5. Teste
Envie uma mensagem para o número conectado. Você verá:
- a mensagem aparecer na caixa de entrada (tempo real);
- a conversa ser roteada para uma fila;
- o agente de IA responder automaticamente.

## Validação de assinatura
O KIM valida o header `X-Hub-Signature-256` usando o `APP_SECRET`. Sem `APP_SECRET`
configurado, a validação é ignorada (apenas para desenvolvimento).
