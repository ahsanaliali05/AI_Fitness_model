import { useState, useEffect } from 'react';
import api from '../api';

export default function WorkoutPlan() {
  const [plan, setPlan] = useState(null);
  const [duration, setDuration] = useState(7);
  const [focus, setFocus] = useState('full_body');
  const [loading, setLoading] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/workout/generate', { duration, focus });
      setPlan(res.data);
      fetchSavedPlans();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to generate plan. Make sure you have a profile.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedPlans = async () => {
    try {
      const res = await api.get('/api/workout/saved-plans');
      setSavedPlans(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchSavedPlans(); }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Personalised Workout Plan</h1>
      <div className="card mb-6">
        <div className="mb-4">
          <label className="block font-medium mb-1">Focus Area</label>
          <select value={focus} onChange={e => setFocus(e.target.value)} className="input-field">
            <option value="full_body">Full Body</option>
            <option value="upper">Upper Body</option>
            <option value="lower">Lower Body</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="block font-medium mb-1">Duration (days)</label>
          <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value))} min="1" max="30" className="input-field" />
        </div>
        <button onClick={generatePlan} disabled={loading} className="btn-primary">
          {loading ? 'Generating...' : 'Generate Random Plan'}
        </button>
      </div>

      {plan && (
        <div className="card mb-6">
          <h2 className="text-xl font-semibold">{plan.goal?.replace('_',' ') || 'Fitness'} Plan</h2>
          <p className="text-gray-600 mb-4">{plan.tip}</p>
          {plan.plan?.map((day, idx) => (
            <div key={idx} className="border-t pt-3 mt-3 first:border-0 first:mt-0">
              <h3 className="font-bold">Day {day.day || idx+1}</h3>
              <ul className="list-disc ml-5">
                {day.exercises?.map((ex, i) => <li key={i}>{ex}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}

      {savedPlans.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-3">Previously Generated Plans</h2>
          <ul className="space-y-2">
            {savedPlans.map(p => (
              <li key={p.id} className="border-b pb-2">
                {p.goal?.replace('_',' ') || 'Plan'} - {p.duration} days ({new Date(p.created_at).toLocaleDateString()})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}