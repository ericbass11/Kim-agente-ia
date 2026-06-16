import { useEffect, useState } from 'react';
import { api } from '../api';
import type { AIAgent, Queue } from '../types';

export function Agents({ orgId }: { orgId: string }) {
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [form, setForm] = useState({
    name: '', systemPrompt: '', knowledge: '', queueId: '', effort: 'medium',
  });

  const load = () => {
    api.agents(orgId).then(setAgents);
    api.queues(orgId).then(setQueues);
  };
  useEffect(() => { load(); }, [orgId]);

  const create = async () => {
    if (!form.name.trim() || !form.systemPrompt.trim()) return;
    await api.createAgent(orgId, {
      name: form.name.trim(),
      systemPrompt: form.systemPrompt.trim(),
      knowledge: form.knowledge.trim() || undefined,
      queueId: form.queueId || undefined,
      effort: form.effort,
    });
    setForm({ name: '', systemPrompt: '', knowledge: '', queueId: '', effort: 'medium' });
    load();
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 360px' }}>
      <div className="grid">
        {agents.map((a) => (
          <div key={a.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>🤖 {a.name}</strong>
              <span className="badge">{a.active ? 'ativo' : 'inativo'}</span>
            </div>
            <div className="row" style={{ marginTop: 4 }}>
              {a.queue && <span className="tag-chip" style={{ background: a.queue.color }}>{a.queue.name}</span>}
              <span className="badge">{a.model}</span>
              <span className="badge">esforço: {a.effort}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{a.systemPrompt}</p>
            {a.knowledge && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--muted)' }}>
                  Base de conhecimento
                </summary>
                <p style={{ fontSize: 12 }}>{a.knowledge}</p>
              </details>
            )}
            <button
              className="btn sm ghost"
              style={{ marginTop: 8 }}
              onClick={() => api.updateAgent(a.id, { active: !a.active }).then(load)}
            >
              {a.active ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ alignSelf: 'start' }}>
        <h3 style={{ marginTop: 0 }}>Novo agente de IA</h3>
        <div className="field">
          <label>Nome</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Especialista Financeiro" />
        </div>
        <div className="field">
          <label>Fila</label>
          <select value={form.queueId} onChange={(e) => setForm({ ...form, queueId: e.target.value })}>
            <option value="">— sem fila —</option>
            {queues.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Prompt / persona</label>
          <textarea rows={4} value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            placeholder="Você é um especialista em…" />
        </div>
        <div className="field">
          <label>Base de conhecimento (opcional)</label>
          <textarea rows={3} value={form.knowledge}
            onChange={(e) => setForm({ ...form, knowledge: e.target.value })}
            placeholder="FAQ, políticas, valores…" />
        </div>
        <div className="field">
          <label>Esforço da IA</label>
          <select value={form.effort} onChange={(e) => setForm({ ...form, effort: e.target.value })}>
            <option value="low">Baixo (rápido)</option>
            <option value="medium">Médio</option>
            <option value="high">Alto (mais elaborado)</option>
          </select>
        </div>
        <button className="btn" onClick={create}>Criar agente</button>
      </div>
    </div>
  );
}
