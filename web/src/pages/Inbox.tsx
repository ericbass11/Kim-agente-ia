import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { getSocket } from '../socket';
import type { Conversation, Message } from '../types';

export function Inbox({ orgId }: { orgId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [text, setText] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);

  const loadConversations = () => api.conversations(orgId).then(setConversations);
  const loadActive = (id: string) => api.conversation(id).then(setActive);

  useEffect(() => {
    loadConversations();
  }, [orgId]);

  useEffect(() => {
    if (selectedId) loadActive(selectedId);
  }, [selectedId]);

  // tempo real
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onMessage = (payload: { conversationId: string }) => {
      loadConversations();
      if (payload.conversationId === selectedId) loadActive(selectedId);
    };
    const onUpdate = () => {
      loadConversations();
      if (selectedId) loadActive(selectedId);
    };
    socket.on('message:new', onMessage);
    socket.on('conversation:routed', onUpdate);
    socket.on('conversation:updated', onUpdate);
    socket.on('nps:responded', onUpdate);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('conversation:routed', onUpdate);
      socket.off('conversation:updated', onUpdate);
      socket.off('nps:responded', onUpdate);
    };
  }, [selectedId]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages?.length]);

  const send = async () => {
    if (!text.trim() || !active) return;
    await api.reply(active.id, text.trim());
    setText('');
    loadActive(active.id);
  };

  return (
    <div className="inbox">
      {/* Lista */}
      <div className="list">
        {conversations.length === 0 && (
          <div className="empty">Nenhuma conversa ainda.<br />Use o Simulador para criar uma. 🧪</div>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={`conv-item ${c.id === selectedId ? 'active' : ''}`}
            onClick={() => setSelectedId(c.id)}
          >
            <div className="name">{c.contact.name || c.contact.waId}</div>
            <div className="preview">{c.messages?.[0]?.text ?? '—'}</div>
            <div className="meta">
              {c.queue && (
                <span className="tag-chip" style={{ background: c.queue.color }}>
                  {c.queue.name}
                </span>
              )}
              <span className="badge">{c.handlingMode === 'AI' ? '🤖 IA' : '👤 Humano'}</span>
              {c.classification?.priority === 'HIGH' && <span className="badge">🔥 Alta</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Thread */}
      <div className="thread">
        {!active ? (
          <div className="empty">Selecione uma conversa</div>
        ) : (
          <>
            <div className="messages">
              {active.messages?.map((m: Message) => (
                <div key={m.id} className={`bubble ${m.senderType.toLowerCase()}`}>
                  <div className="who">
                    {m.senderType === 'CONTACT'
                      ? active.contact.name || 'Cliente'
                      : m.senderType === 'AI'
                        ? active.aiAgent?.name || 'IA'
                        : m.senderType === 'HUMAN'
                          ? 'Você'
                          : 'Sistema'}
                  </div>
                  {m.text}
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
            <div className="composer">
              <input
                placeholder={
                  active.handlingMode === 'AI'
                    ? 'A IA está respondendo. Assuma para escrever…'
                    : 'Escreva uma mensagem…'
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                disabled={active.handlingMode === 'AI'}
              />
              <button className="btn" onClick={send} disabled={active.handlingMode === 'AI'}>
                Enviar
              </button>
            </div>
          </>
        )}
      </div>

      {/* Painel lateral */}
      <div className="panel">
        {active && (
          <ConversationPanel
            conversation={active}
            onChange={() => {
              loadActive(active.id);
              loadConversations();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ConversationPanel({
  conversation,
  onChange,
}: {
  conversation: Conversation;
  onChange: () => void;
}) {
  const [tagName, setTagName] = useState('');
  const c = conversation;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px' }}>{c.contact.name || c.contact.waId}</h3>
        <small style={{ color: 'var(--muted)' }}>{c.contact.waId}</small>
      </div>

      <div className="card">
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Status</label>
          <span className="badge">{c.status}</span>{' '}
          <span className="badge">{c.handlingMode === 'AI' ? '🤖 IA' : '👤 Humano'}</span>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {c.handlingMode === 'AI' ? (
            <button className="btn sm" onClick={() => api.takeover(c.id).then(onChange)}>
              Assumir (humano)
            </button>
          ) : (
            <button className="btn sm ghost" onClick={() => api.release(c.id).then(onChange)}>
              Devolver à IA
            </button>
          )}
          <button className="btn sm ghost" onClick={() => api.resolve(c.id).then(onChange)}>
            Resolver + NPS
          </button>
          <button className="btn sm ghost" onClick={() => api.summarize(c.id).then(onChange)}>
            Resumir
          </button>
        </div>
      </div>

      {c.classification && (
        <div className="card">
          <strong>Classificação (IA)</strong>
          <table style={{ marginTop: 8 }}>
            <tbody>
              <tr><td>Intenção</td><td>{c.classification.intent || '—'}</td></tr>
              <tr><td>Categoria</td><td>{c.classification.category || '—'}</td></tr>
              <tr><td>Sentimento</td><td>{c.classification.sentiment || '—'}</td></tr>
              <tr><td>Prioridade</td><td>{c.classification.priority || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <strong>Tags</strong>
        <div className="meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
          {c.tags?.map((t) => (
            <span key={t.tag.id} className="tag-chip" style={{ background: t.tag.color }}>
              {t.tag.name}
              {t.auto ? ' ·IA' : ''}
            </span>
          ))}
          {!c.tags?.length && <small style={{ color: 'var(--muted)' }}>Nenhuma tag</small>}
        </div>
        <div className="row">
          <input
            placeholder="nova tag"
            value={tagName}
            onChange={(e) => setTagName(e.target.value)}
          />
          <button
            className="btn sm"
            onClick={() => {
              if (tagName.trim()) api.addTag(c.id, tagName.trim()).then(() => { setTagName(''); onChange(); });
            }}
          >
            +
          </button>
        </div>
      </div>

      {c.npsSurvey && (
        <div className="card">
          <strong>NPS</strong>
          <div style={{ marginTop: 6 }}>
            {c.npsSurvey.status === 'RESPONDED' ? (
              <span className="badge">Nota {c.npsSurvey.score} · {c.npsSurvey.category}</span>
            ) : (
              <span className="badge">Pesquisa enviada (aguardando)</span>
            )}
          </div>
        </div>
      )}

      {c.summary && (
        <div className="card">
          <strong>Resumo</strong>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>{c.summary}</p>
        </div>
      )}
    </div>
  );
}
