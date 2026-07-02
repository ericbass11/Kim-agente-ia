import { useEffect, useState } from 'react';
import { api } from './api';
import { connectSocket } from './socket';
import { Inbox } from './pages/Inbox';
import { Queues } from './pages/Queues';
import { Agents } from './pages/Agents';
import { Nps } from './pages/Nps';
import { Simulator } from './pages/Simulator';

type Tab = 'inbox' | 'queues' | 'agents' | 'nps' | 'simulator';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Caixa de entrada', icon: '💬' },
  { id: 'queues', label: 'Filas', icon: '🗂️' },
  { id: 'agents', label: 'Agentes de IA', icon: '🤖' },
  { id: 'nps', label: 'NPS', icon: '⭐' },
  { id: 'simulator', label: 'Simulador', icon: '🧪' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState('');
  const [health, setHealth] = useState<{ ai: boolean; whatsapp: boolean } | null>(null);

  useEffect(() => {
    api.bootstrap().then((b) => {
      if (b.organization) {
        setOrgId(b.organization.id);
        setOrgName(b.organization.name);
        connectSocket(b.organization.id);
      }
    });
    fetch('/health').then((r) => r.json()).then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">K</div>
          <div>
            <h1>KIM</h1>
            <small>CRM WhatsApp · IA</small>
          </div>
        </div>
        <nav className="nav">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <div className="foot">
          <div>
            <span className={`status-dot ${health?.ai ? 'on' : 'off'}`} />
            IA {health?.ai ? 'ativa' : 'modo demo'}
          </div>
          <div>
            <span className={`status-dot ${health?.whatsapp ? 'on' : 'off'}`} />
            WhatsApp {health?.whatsapp ? 'conectado' : 'modo demo'}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h2>{TABS.find((t) => t.id === tab)?.label}</h2>
          <span className="badge">{orgName || 'carregando...'}</span>
        </header>
        <div className="content" style={tab === 'inbox' ? { padding: 0 } : undefined}>
          {!orgId ? (
            <div className="empty">Carregando organização…</div>
          ) : tab === 'inbox' ? (
            <Inbox orgId={orgId} />
          ) : tab === 'queues' ? (
            <Queues orgId={orgId} />
          ) : tab === 'agents' ? (
            <Agents orgId={orgId} />
          ) : tab === 'nps' ? (
            <Nps orgId={orgId} />
          ) : (
            <Simulator />
          )}
        </div>
      </main>
    </div>
  );
}
