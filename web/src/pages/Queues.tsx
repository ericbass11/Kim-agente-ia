import { useEffect, useState } from 'react';
import { api } from '../api';
import type { Queue } from '../types';

export function Queues({ orgId }: { orgId: string }) {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');

  const load = () => api.queues(orgId).then(setQueues);
  useEffect(() => { load(); }, [orgId]);

  const create = async () => {
    if (!name.trim()) return;
    await api.createQueue(orgId, {
      name: name.trim(),
      description: description.trim() || undefined,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
    });
    setName(''); setDescription(''); setKeywords('');
    load();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 320px' }}>
      <div className="grid">
        {queues.map((q) => (
          <div key={q.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <span className="tag-chip" style={{ background: q.color }}>{q.name}</span>
                {q.isDefault && <span className="badge">padrão</span>}
              </div>
              <span className="badge">{q._count?.conversations ?? 0} conversas</span>
            </div>
            {q.description && <p style={{ color: 'var(--muted)', fontSize: 13 }}>{q.description}</p>}
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {q.keywords.map((k) => <span key={k} className="badge">{k}</span>)}
            </div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <strong>Agentes:</strong>{' '}
              {q.aiAgents?.length
                ? q.aiAgents.map((a) => a.name).join(', ')
                : <span style={{ color: 'var(--muted)' }}>nenhum agente associado</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ alignSelf: 'start' }}>
        <h3 style={{ marginTop: 0 }}>Nova fila</h3>
        <div className="field">
          <label>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Financeiro" />
        </div>
        <div className="field">
          <label>Descrição (usada pelo orquestrador)</label>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Quando rotear para esta fila…" />
        </div>
        <div className="field">
          <label>Palavras-chave (separadas por vírgula)</label>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
            placeholder="boleto, pagamento, fatura" />
        </div>
        <button className="btn" onClick={create}>Criar fila</button>
      </div>
    </div>
  );
}
