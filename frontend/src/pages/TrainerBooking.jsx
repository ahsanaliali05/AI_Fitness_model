import { useState, useEffect } from 'react';
import api from '../api';

export default function TrainerBooking() {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/trainers/available')
      .then(res => {
        setTrainers(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-10">Loading trainers...</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">🏋️ Recommended Trainers (10-15 random, hourly)</h1>
      <p className="text-gray-600 mb-6">Trainers rotate every hour. Contact them via the gym.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trainers.map(trainer => (
          <div key={trainer.id} className="card hover:shadow-lg transition">
            <h3 className="text-xl font-bold text-gray-800">{trainer.name}</h3>
            <p className="text-green-600 font-medium">{trainer.speciality}</p>
            <p className="text-sm text-gray-500">⭐ {trainer.experience} experience</p>
            <p className="text-sm text-gray-600 mt-2">{trainer.bio}</p>
            <div className="mt-3 pt-2 border-t border-gray-100">
              <p className="text-lg font-semibold text-gray-800">${trainer.hourly_rate}/hour</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}