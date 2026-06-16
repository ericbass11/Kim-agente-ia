export interface Organization {
  id: string;
  name: string;
}

export interface Queue {
  id: string;
  name: string;
  description?: string | null;
  keywords: string[];
  color: string;
  isDefault: boolean;
  aiAgents?: AIAgent[];
  _count?: { conversations: number };
}

export interface AIAgent {
  id: string;
  name: string;
  systemPrompt: string;
  knowledge?: string | null;
  model: string;
  effort: string;
  active: boolean;
  queueId?: string | null;
  queue?: Queue | null;
}

export interface Contact {
  id: string;
  waId: string;
  name?: string | null;
}

export interface Message {
  id: string;
  senderType: 'CONTACT' | 'AI' | 'HUMAN' | 'SYSTEM';
  text: string;
  createdAt: string;
}

export interface Classification {
  intent?: string | null;
  category?: string | null;
  sentiment?: string | null;
  priority?: string | null;
  confidence?: number | null;
}

export interface NpsSurvey {
  status: string;
  score?: number | null;
  category?: string | null;
}

export interface ConversationTag {
  tag: { id: string; name: string; color: string };
  auto: boolean;
}

export interface Conversation {
  id: string;
  status: 'OPEN' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  handlingMode: 'AI' | 'HUMAN';
  summary?: string | null;
  lastMessageAt: string;
  contact: Contact;
  queue?: Queue | null;
  aiAgent?: AIAgent | null;
  classification?: Classification | null;
  tags?: ConversationTag[];
  npsSurvey?: NpsSurvey | null;
  messages?: Message[];
}

export interface NpsMetrics {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  nps: number;
}
