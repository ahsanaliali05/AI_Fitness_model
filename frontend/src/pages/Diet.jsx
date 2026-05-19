import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { FiSend } from 'react-icons/fi';

export default function Diet() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [duration, setDuration] = useState(7);
  const [goal, setGoal] = useState('maintenance');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const navigate = useNavigate();

  const generatePlan = async () => {
    setLoading(true);
    try {
      await api.get('/api/profile/');
      const res = await api.post('/api/diet/generate', { duration, goal });
      setPlan(res.data);
      // Reset chat when a new plan is generated
      setChatMessages([]);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) {
        alert('Please complete your profile first (Profile Setup page).');
        navigate('/profile-setup');
      } else {
        alert('Error generating plan');
      }
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');
    setChatLoading(true);
    try {
      // Build context from the current plan
      let context = "";
      if (plan) {
        context = `The user has a ${plan.goal} diet plan with daily calories ${plan.calories}. ` +
                  `Macros: protein ${plan.macros.protein_g}g, carbs ${plan.macros.carbs_g}g, fat ${plan.macros.fat_g}g. ` +
                  `The plan includes: ${Object.entries(plan.plan).map(([day, meals]) => `${day}: breakfast ${meals.breakfast}, lunch ${meals.lunch}, dinner ${meals.dinner}`).join('; ')}. ` +
                  `Answer questions about this plan.`;
      }
      const res = await api.post('/api/chat/', { message: userMsg, context });
      setChatMessages(prev => [...prev, { role: 'bot', content: res.data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'bot', content: 'Sorry, I am offline.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Personalised Diet Plan</h1>
      
      <div className="card mb-6 space-y-4">
        {/* Goal Selection */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Your Goal</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="goal" value="weight_loss" checked={goal === 'weight_loss'} onChange={() => setGoal('weight_loss')} />
              <span>🔥 Weight Loss</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="goal" value="maintenance" checked={goal === 'maintenance'} onChange={() => setGoal('maintenance')} />
              <span>⚖️ Maintenance</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="goal" value="muscle_gain" checked={goal === 'muscle_gain'} onChange={() => setGoal('muscle_gain')} />
              <span>💪 Muscle Gain</span>
            </label>
          </div>
        </div>

        {/* Duration Selection */}
        <div>
          <label className="block text-gray-700 font-medium mb-2">Plan Duration</label>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setDuration(1)}
              className={`px-4 py-2 rounded-lg transition ${duration === 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              1 Day
            </button>
            <button
              onClick={() => setDuration(3)}
              className={`px-4 py-2 rounded-lg transition ${duration === 3 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              3 Days
            </button>
            <button
              onClick={() => setDuration(7)}
              className={`px-4 py-2 rounded-lg transition ${duration === 7 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              7 Days
            </button>
          </div>
        </div>

        <button onClick={generatePlan} disabled={loading} className="btn-primary w-full md:w-auto">
          {loading ? 'Generating...' : `Generate ${duration}-Day Plan`}
        </button>
      </div>

      {plan && (
        <>
          <div className="card mb-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-green-700">{plan.goal} Plan</h2>
              <p className="text-gray-600">{plan.message}</p>
              <p className="text-gray-600 mt-1">Macros: P {plan.macros.protein_g}g · C {plan.macros.carbs_g}g · F {plan.macros.fat_g}g</p>
            </div>
            <div className="space-y-4">
              {Object.entries(plan.plan).map(([day, meals]) => (
                <div key={day} className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
                  <h3 className="font-medium text-green-700 capitalize">{day.replace('day', 'Day ')}</h3>
                  <p className="text-sm"><span className="font-medium">Breakfast:</span> {meals.breakfast}</p>
                  <p className="text-sm"><span className="font-medium">Lunch:</span> {meals.lunch}</p>
                  <p className="text-sm"><span className="font-medium">Dinner:</span> {meals.dinner}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chatbot section for diet plan questions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">💬 Ask about this plan</h3>
            <div className="h-64 overflow-y-auto border border-gray-100 rounded-lg p-3 mb-3 bg-gray-50">
              {chatMessages.length === 0 && (
                <p className="text-gray-400 text-sm">Ask questions like "Can I swap breakfast for eggs?" or "What snacks can I add?"</p>
              )}
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  <span className={`inline-block px-3 py-1 rounded-lg ${msg.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
                    <strong>{msg.role === 'user' ? 'You' : 'Coach'}:</strong> {msg.content}
                  </span>
                </div>
              ))}
              {chatLoading && <div className="text-gray-500 italic">Thinking...</div>}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask about meal substitutions, portions, etc."
                className="input-field flex-1"
              />
              <button onClick={sendChatMessage} className="btn-primary flex items-center gap-2">
                <FiSend /> Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}