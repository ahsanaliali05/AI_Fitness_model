import { useEffect, useState } from 'react';
import api from '../api';

export default function Progress() {
  const [logs, setLogs] = useState([]);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await api.get('/api/progress/');
      setLogs(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load logs');
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const addLog = async () => {
    if (!weight) {
      setError('Please enter weight');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('weight_kg', weight);
      formData.append('notes', notes);
      await api.post('/api/progress/log', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setWeight('');
      setNotes('');
      await fetchLogs(); // refresh the list
    } catch (err) {
      console.error(err);
      setError('Failed to add log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Progress Tracker</h1>
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-3">Log New Weight</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g., 70.5"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Notes (optional)</label>
            <input
              type="text"
              placeholder="Feeling great, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input-field"
            />
          </div>
          <button onClick={addLog} disabled={loading} className="btn-primary">
            {loading ? 'Adding...' : 'Log Weight'}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      <h2 className="text-xl font-semibold mb-3">History</h2>
      {logs.length === 0 ? (
        <p className="text-gray-500">No logs yet. Add your first weight above.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="card p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-800">{log.weight_kg} kg</p>
                {log.notes && <p className="text-sm text-gray-500">{log.notes}</p>}
              </div>
              <span className="text-sm text-gray-400">{new Date(log.logged_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}