import { useEffect, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
import type { NpsMetrics } from '../types';

export function Nps({ orgId }: { orgId: string }) {
  const [m, setM] = useState<NpsMetrics | null>(null);

  const load = () => api.nps(orgId).then(setM);
  useEffect(() => {
    load();
    const socket = getSocket();
    socket?.on('nps:responded', load);
    return () => { socket?.off('nps:responded', load); };
  }, [orgId]);

  if (!m) return <div className="empty">Carregando…</div>;

  const pct = (n: number) => (m.total ? Math.round((n / m.total) * 100) : 0);

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="card kpi nps-score">
        <div className="label">Net Promoter Score</div>
        <div className="value">{m.nps}</div>
        <div className="label">{m.total} respostas</div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="card kpi">
          <div className="value" style={{ color: '#25d366' }}>{m.promoters}</div>
          <div className="label">Promotores ({pct(m.promoters)}%)</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: '#f59e0b' }}>{m.passives}</div>
          <div className="label">Neutros ({pct(m.passives)}%)</div>
        </div>
        <div className="card kpi">
          <div className="value" style={{ color: '#ef4444' }}>{m.detractors}</div>
          <div className="label">Detratores ({pct(m.detractors)}%)</div>
        </div>
      </div>

      <div className="card">
        <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
          O NPS é disparado automaticamente ao resolver uma conversa. Quando o cliente responde
          com uma nota de 0 a 10, ela é classificada como Promotor (9–10), Neutro (7–8) ou
          Detrator (0–6). NPS = % Promotores − % Detratores.
        </p>
      </div>
    </div>
  );
}
