import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL', 'postgresql://kim:kim@localhost:5432/kim?schema=public'),

  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',

  ai: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'claude-opus-4-8',
    enabled: Boolean(process.env.ANTHROPIC_API_KEY),
  },

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? 'kim-verify-token',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
    enabled: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
  },
};

export type Env = typeof env;
