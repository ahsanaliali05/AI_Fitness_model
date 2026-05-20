import { useEffect, useState } from 'react';
import api from '../api';

export default function Progress() {
  const [logs, setLogs] = useState([]);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [latestPhoto, setLatestPhoto] = useState(null);
  const [latestPhotoId, setLatestPhotoId] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [beforePhoto, setBeforePhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/api/progress/');
      setLogs(res.data);
      const photoLog = res.data.find(log => log.photo_url);
      if (photoLog) {
        setLatestPhoto(photoLog.photo_url);
        setLatestPhotoId(photoLog.id);
      } else {
        setLatestPhoto(null);
        setLatestPhotoId(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load logs');
    }
  };

  const refreshBeforeAfter = async () => {
    try {
      const [beforeRes, afterRes, compRes] = await Promise.all([
        api.get('/api/progress/before-after/before').catch(() => ({ data: { photo_url: null } })),
        api.get('/api/progress/before-after/after').catch(() => ({ data: { photo_url: null } })),
        api.get('/api/progress/compare').catch(() => ({ data: {} }))
      ]);
      setBeforePhoto(beforeRes.data.photo_url);
      setAfterPhoto(afterRes.data.photo_url);
      setComparison(compRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
    refreshBeforeAfter();
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
      await fetchLogs();
    } catch (err) {
      console.error(err);
      setError('Failed to add log');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await api.post('/api/progress/photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Progress photo uploaded!');
      await fetchLogs();
      await refreshBeforeAfter();
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.response?.data?.detail || 'Unknown error'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleBeforeAfterUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    if (type === 'before') setUploadingBefore(true);
    else setUploadingAfter(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('photo_type', type);
    formData.append('notes', `${type} photo`);
    try {
      await api.post('/api/progress/before-after', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} photo uploaded!`);
      await refreshBeforeAfter();
    } catch (err) {
      console.error(err);
      alert('Upload failed: ' + (err.response?.data?.detail || 'Unknown error'));
    } finally {
      if (type === 'before') setUploadingBefore(false);
      else setUploadingAfter(false);
    }
  };

  const deletePhoto = async (photoId) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.delete(`/api/progress/photo/${photoId}`);
      alert('Photo deleted');
      await fetchLogs();
      await refreshBeforeAfter();
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.detail || 'Error'));
    }
  };

  const deleteBeforeAfter = async (type) => {
    if (!confirm(`Delete ${type} photo?`)) return;
    try {
      await api.delete(`/api/progress/before-after/${type}`);
      alert(`${type} photo deleted`);
      await refreshBeforeAfter();
    } catch (err) {
      alert('Delete failed: ' + (err.response?.data?.detail || 'Error'));
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Progress Tracker</h1>
      
      {/* Weight Log */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-3">Log New Weight</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="input-field" />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-600 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="input-field" />
          </div>
          <button onClick={addLog} disabled={loading} className="btn-primary">{loading ? 'Adding...' : 'Log Weight'}</button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Single Progress Photo */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-3">📸 Progress Photo</h2>
        <input type="file" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
        {uploadingPhoto && <p className="text-sm text-gray-500">Uploading...</p>}
        {latestPhoto && (
          <div className="mt-2 relative inline-block">
            <img src={`/${latestPhoto}`} alt="Progress" className="h-32 w-32 object-cover rounded border" />
            <button onClick={() => deletePhoto(latestPhotoId)} className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1 text-xs w-6 h-6 flex items-center justify-center">✕</button>
          </div>
        )}
      </div>

      {/* Before & After Photos */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-3">📸 Before & After Photos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block font-medium mb-2">Before Photo</label>
            <input type="file" accept="image/*" onChange={(e) => handleBeforeAfterUpload(e, 'before')} disabled={uploadingBefore} />
            {uploadingBefore && <p className="text-sm text-gray-500">Uploading...</p>}
            {beforePhoto && (
              <div className="mt-2 relative inline-block">
                <img src={`/${beforePhoto}`} alt="Before" className="h-32 w-32 object-cover rounded border" />
                <button onClick={() => deleteBeforeAfter('before')} className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1 text-xs w-6 h-6 flex items-center justify-center">✕</button>
              </div>
            )}
          </div>
          <div>
            <label className="block font-medium mb-2">After Photo</label>
            <input type="file" accept="image/*" onChange={(e) => handleBeforeAfterUpload(e, 'after')} disabled={uploadingAfter} />
            {uploadingAfter && <p className="text-sm text-gray-500">Uploading...</p>}
            {afterPhoto && (
              <div className="mt-2 relative inline-block">
                <img src={`/${afterPhoto}`} alt="After" className="h-32 w-32 object-cover rounded border" />
                <button onClick={() => deleteBeforeAfter('after')} className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1 text-xs w-6 h-6 flex items-center justify-center">✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Section with Delete Buttons */}
        {comparison && comparison.has_before && comparison.has_after && (
          <div className="mt-6 p-4 bg-green-50 rounded-lg">
            <div className="flex justify-between items-start">
              <h3 className="font-semibold text-green-800">Progress Summary</h3>
              <div className="flex gap-2">
                <button onClick={() => deleteBeforeAfter('before')} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Delete Before</button>
                <button onClick={() => deleteBeforeAfter('after')} className="text-xs bg-red-600 text-white px-2 py-1 rounded">Delete After</button>
              </div>
            </div>
            <p className="text-sm text-gray-700 mt-2">{comparison.comparison?.message || "No detailed analysis available. But here are your photos:"}</p>
            <p className="text-sm text-gray-700 font-medium">{comparison.comparison?.estimated_change || ""}</p>
            {comparison.comparison?.metrics && (
              <div className="mt-2 text-xs text-gray-600">
                <p>Waist-to-hip: {comparison.comparison.metrics.waist_to_hip_before} → {comparison.comparison.metrics.waist_to_hip_after}</p>
                <p>Shoulder-to-waist: {comparison.comparison.metrics.shoulder_to_waist_before} → {comparison.comparison.metrics.shoulder_to_waist_after}</p>
              </div>
            )}
            <div className="flex gap-4 mt-3">
              <div>
                <p className="text-xs font-medium">Before</p>
                <img src={`/${comparison.before_url}`} alt="Before" className="h-32 w-32 object-cover rounded border" />
              </div>
              <div>
                <p className="text-xs font-medium">After</p>
                <img src={`/${comparison.after_url}`} alt="After" className="h-32 w-32 object-cover rounded border" />
              </div>
            </div>
          </div>
        )}
        {comparison && (!comparison.has_before || !comparison.has_after) && (
          <p className="text-gray-500 mt-4">Upload both before and after photos to see comparison.</p>
        )}
      </div>

      {/* Weight History with delete buttons */}
      <h2 className="text-xl font-semibold mb-3">Weight History</h2>
      {logs.length === 0 ? (
        <p className="text-gray-500">No logs yet.</p>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div key={log.id} className="card p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{log.weight_kg} kg</p>
                {log.notes && <p className="text-sm text-gray-500">{log.notes}</p>}
                {log.photo_url && (
                  <div className="mt-1 flex items-center gap-2">
                    <img src={`/${log.photo_url}`} alt="Progress" className="h-12 w-12 object-cover rounded" />
                    <button onClick={() => deletePhoto(log.id)} className="text-red-600 text-xs hover:underline">Remove</button>
                  </div>
                )}
              </div>
              <span className="text-sm text-gray-400">{new Date(log.logged_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
