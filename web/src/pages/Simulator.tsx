import { useState } from 'react';
import { api } from '../api';

const EXAMPLES = [
  'Olá, quero saber como abrir uma franquia de vocês e quanto preciso investir.',
  'Sou franqueado e o sistema de pedidos está dando erro, podem ajudar?',
  'Qual o horário de funcionamento e tem alguma promoção hoje?',
  'Estou muito insatisfeito, meu pedido veio errado de novo!',
];

export function Simulator() {
  const [from, setFrom] = useState('5511999999999');
  const [text, setText] = useState(EXAMPLES[0]);
  const [sent, setSent] = useState<string[]>([]);

  const send = async () => {
    if (!text.trim()) return;
    await api.simulate(from.trim(), text.trim(), 'Cliente Demo');
    setSent((s) => [`✓ "${text.trim()}" enviado de ${from}`, ...s]);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>🧪 Simular mensagem recebida</h3>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>
          Simula uma mensagem chegando pelo WhatsApp, passando pelo orquestrador de IA e gerando
          resposta automática. Veja o resultado na Caixa de entrada.
        </p>
        <div className="field">
          <label>Número do cliente (waId)</label>
          <input value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Mensagem</label>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="field">
          <label>Exemplos rápidos</label>
          <div className="grid" style={{ gap: 6 }}>
            {EXAMPLES.map((ex) => (
              <button key={ex} className="btn sm ghost" style={{ textAlign: 'left' }}
                onClick={() => setText(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
        <button className="btn" onClick={send}>Enviar mensagem simulada</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Log</h3>
        {sent.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Nenhuma mensagem enviada ainda.</p>
        ) : (
          <ul style={{ paddingLeft: 18, fontSize: 13 }}>
            {sent.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
