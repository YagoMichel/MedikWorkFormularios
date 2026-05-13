import { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

type Msg = { role: 'user' | 'agent'; text: string };

export default function AgentChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/agent/chat/history').then(({ data }) => {
      setMessages(data.messages || []);
    }).catch(() => {}).finally(() => setLoadingHistory(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handler = (data: { sessionId: string; text: string }) => {
      setMessages((m) => [...m, { role: 'agent', text: data.text }]);
    };
    socket.on('agent:message', handler);
    return () => { socket.off('agent:message', handler); };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const { data } = await api.post('/agent/chat', { message: text });
      setMessages((m) => [...m, { role: 'agent', text: data.reply }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: 'agent', text: '⚠️ Error: ' + (err.response?.data?.error || err.message) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] card p-0 overflow-hidden">
      <div className="flex justify-end px-4 pt-3">
        <button onClick={async () => { await api.delete('/agent/chat/history'); setMessages([]); }} className="text-xs text-slate-400 hover:text-red-400 transition">
          Nueva conversación
        </button>
      </div>
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {loadingHistory && <p className="text-center text-sm text-slate-400 py-4">Cargando conversación…</p>}
        {!loadingHistory && messages.length === 0 && <p className="text-center text-sm text-slate-400 py-4">Escribe un mensaje para comenzar.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
              m.role === 'user'
                ? 'text-white rounded-br-sm'
                : 'bg-slate-100 text-slate-800 rounded-bl-sm'
            }`}
              style={m.role === 'user' ? { background: '#3375c8' } : {}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-500 px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
              <span className="animate-pulse">Escribiendo…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-4 flex gap-3 items-end">
        <textarea
          className="input flex-1 resize-none text-sm"
          rows={1}
          placeholder="Escribe un mensaje…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="btn btn-primary shrink-0"
          style={{ background: '#3375c8' }}>
          Enviar
        </button>
      </div>
    </div>
  );
}
