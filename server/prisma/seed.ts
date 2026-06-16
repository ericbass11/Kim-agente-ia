import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hash(pw: string) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

async function main() {
  console.log('🌱 Semeando dados de demonstração...');

  const org = await prisma.organization.create({
    data: { name: 'Rede Sabor Express (Demo)' },
  });

  const franchise = await prisma.franchise.create({
    data: {
      organizationId: org.id,
      name: 'Unidade Paulista',
      city: 'São Paulo',
      state: 'SP',
      externalCode: 'SP-001',
    },
  });

  await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Administrador Demo',
      email: 'admin@kim.demo',
      passwordHash: hash('admin123'),
      role: 'OWNER',
    },
  });

  const channel = await prisma.whatsAppChannel.create({
    data: {
      organizationId: org.id,
      name: 'WhatsApp Principal',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'demo-phone-number-id',
      displayPhone: '+55 11 90000-0000',
    },
  });

  // Filas + agentes especialistas
  const queuesData = [
    {
      name: 'Vendas / Expansão',
      description: 'Interesse em abrir uma franquia, valores de investimento, modelos de negócio.',
      keywords: ['franquia', 'abrir', 'investir', 'investimento', 'franqueado', 'expansão'],
      color: '#6366f1',
      agent: {
        name: 'Ana — Especialista de Expansão',
        systemPrompt:
          'Você é especialista em expansão de franquias da Rede Sabor Express. Apresente o modelo de negócio, ' +
          'tire dúvidas sobre investimento e qualifique o lead (capital disponível, cidade de interesse). ' +
          'Seja entusiasta, porém honesta. Ao final, ofereça agendar uma conversa com o time comercial.',
        knowledge:
          'Investimento inicial a partir de R$ 90 mil. Faturamento médio mensal de R$ 60 mil por unidade. ' +
          'Royalties de 5%. Taxa de franquia de R$ 25 mil. Suporte completo de implantação.',
      },
    },
    {
      name: 'Suporte ao Franqueado',
      description: 'Dúvidas operacionais de quem já é franqueado: sistema, fornecedores, marketing.',
      keywords: ['suporte', 'sistema', 'fornecedor', 'pedido', 'erro', 'ajuda', 'operação'],
      color: '#0ea5e9',
      agent: {
        name: 'Bruno — Suporte ao Franqueado',
        systemPrompt:
          'Você é o suporte para franqueados já ativos. Ajude com dúvidas operacionais, sistema de pedidos ' +
          'e fornecedores. Seja objetivo e prático. Se for um problema crítico, encaminhe para um humano.',
        knowledge:
          'O sistema de pedidos fica em pedidos.saborexpress.com. Pedidos de insumos têm prazo de 48h. ' +
          'Materiais de marketing ficam no portal do franqueado.',
      },
    },
    {
      name: 'Atendimento ao Cliente',
      description: 'Cliente final: cardápio, pedidos, reclamações, horários, localização de unidades.',
      keywords: ['cardápio', 'pedido', 'entrega', 'reclamação', 'horário', 'endereço', 'promoção'],
      color: '#10b981',
      agent: {
        name: 'Carla — Atendimento',
        systemPrompt:
          'Você atende clientes finais da rede. Informe sobre cardápio, horários, promoções e ajude com pedidos. ' +
          'Seja calorosa e use uma linguagem simpática. Em caso de reclamação, demonstre empatia e registre o caso.',
        knowledge:
          'Funcionamento das 11h às 23h. Delivery próprio e via apps. Promoção do dia: combo família com 20% off.',
      },
    },
  ];

  for (const q of queuesData) {
    const queue = await prisma.queue.create({
      data: {
        organizationId: org.id,
        franchiseId: franchise.id,
        name: q.name,
        description: q.description,
        keywords: q.keywords,
        color: q.color,
        isDefault: q.name === 'Atendimento ao Cliente',
      },
    });
    await prisma.aIAgent.create({
      data: {
        organizationId: org.id,
        queueId: queue.id,
        name: q.agent.name,
        systemPrompt: q.agent.systemPrompt,
        knowledge: q.agent.knowledge,
      },
    });
  }

  // Tags iniciais
  for (const t of [
    { name: 'Lead Quente', color: '#ef4444' },
    { name: 'VIP', color: '#f59e0b' },
    { name: 'Reclamação', color: '#dc2626' },
  ]) {
    await prisma.tag.create({ data: { organizationId: org.id, ...t } });
  }

  console.log('✅ Seed concluído.');
  console.log(`   Organização: ${org.name} (${org.id})`);
  console.log(`   Canal phoneNumberId: ${channel.phoneNumberId}`);
  console.log('   Login demo: admin@kim.demo / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
