import { useState, useEffect } from 'react';
import api from '../api';
import { FiSend } from 'react-icons/fi';

export default function Chatbot() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    api.get('/api/chat/history')
      .then(res => {
        setChat(res.data);
        setInitialLoading(false);
      })
      .catch(err => {
        console.error('Failed to load history', err);
        setInitialLoading(false);
      });
  }, []);

  const sendMessage = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage('');
    setChat(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post('/api/chat/', { message: userMsg });
      setChat(prev => [...prev, { role: 'bot', content: res.data.reply }]);
    } catch (err) {
      setChat(prev => [...prev, { role: 'bot', content: 'Sorry, I am offline.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <div>Loading conversation...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">AI Fitness Coach</h1>
      <div className="card h-96 overflow-y-auto flex flex-col space-y-3">
        {chat.length === 0 && <div className="text-center text-gray-500">No messages yet.</div>}
        {chat.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] px-4 py-2 rounded-xl ${msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
              <strong>{msg.role === 'user' ? 'You' : 'Coach'}:</strong> {msg.content}
            </div>
          </div>
        ))}
        {loading && <div>Thinking...</div>}
      </div>
      <div className="mt-4 flex gap-2">
        <input value={message} onChange={e => setMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} className="input-field flex-1" />
        <button onClick={sendMessage} className="btn-primary flex items-center gap-2"><FiSend /> Send</button>
      </div>
    </div>
  );
}