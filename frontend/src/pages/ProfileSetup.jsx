import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function ProfileSetup() {
  const [form, setForm] = useState({
    age: '', gender: '', height_cm: '', weight_kg: '',
    fitness_goal: 'maintenance', activity_level: 'moderate', dietary_restrictions: []
  });
  const [loading, setLoading] = useState(true);
  const [isUpdate, setIsUpdate] = useState(false);
  const [bmi, setBmi] = useState(null);
  const navigate = useNavigate();

  // Helper to calculate BMI from height_cm and weight_kg
  const calculateBmi = (heightCm, weightKg) => {
    if (!heightCm || !weightKg) return null;
    const heightM = heightCm / 100;
    const bmiValue = weightKg / (heightM * heightM);
    return Math.round(bmiValue * 10) / 10;
  };

  // Update BMI whenever height or weight changes
  useEffect(() => {
    if (form.height_cm && form.weight_kg) {
      const bmiValue = calculateBmi(form.height_cm, form.weight_kg);
      setBmi(bmiValue);
    } else {
      setBmi(null);
    }
  }, [form.height_cm, form.weight_kg]);

  // Fetch existing profile (if any)
  useEffect(() => {
    api.get('/api/profile/')
      .then(res => {
        setForm(res.data);
        setIsUpdate(true);
        setLoading(false);
      })
      .catch(err => {
        if (err.response?.status === 404) {
          setIsUpdate(false);
          setLoading(false);
        } else {
          console.error(err);
          setLoading(false);
        }
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isUpdate) {
        await api.put('/api/profile/update', form);
      } else {
        await api.post('/api/profile/setup', form);
      }
      navigate('/');
    } catch (err) {
      alert('Failed to save profile');
    }
  };

  // Helper to get BMI category
  const getBmiCategory = (bmiValue) => {
    if (bmiValue < 18.5) return 'Underweight';
    if (bmiValue < 25) return 'Normal';
    if (bmiValue < 30) return 'Overweight';
    return 'Obese';
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{isUpdate ? 'Update Profile' : 'Complete Your Profile'}</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <input
          type="number"
          placeholder="Age"
          value={form.age}
          onChange={e => setForm({...form, age: e.target.value})}
          className="input-field"
          required
        />
        <select
          value={form.gender}
          onChange={e => setForm({...form, gender: e.target.value})}
          className="input-field"
          required
        >
          <option value="">Gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <input
          type="number"
          step="0.1"
          placeholder="Height (cm)"
          value={form.height_cm}
          onChange={e => setForm({...form, height_cm: e.target.value})}
          className="input-field"
          required
        />
        <input
          type="number"
          step="0.1"
          placeholder="Weight (kg)"
          value={form.weight_kg}
          onChange={e => setForm({...form, weight_kg: e.target.value})}
          className="input-field"
          required
        />

        {/* BMI Display */}
        {bmi !== null && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <p className="text-green-800">
              <strong>Your BMI: {bmi}</strong> ({getBmiCategory(bmi)})
            </p>
            <p className="text-xs text-green-600 mt-1">
              BMI is calculated automatically from height and weight.
            </p>
          </div>
        )}

        <select
          value={form.fitness_goal}
          onChange={e => setForm({...form, fitness_goal: e.target.value})}
          className="input-field"
        >
          <option value="weight_loss">Weight Loss</option>
          <option value="muscle_gain">Muscle Gain</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <select
          value={form.activity_level}
          onChange={e => setForm({...form, activity_level: e.target.value})}
          className="input-field"
        >
          <option value="sedentary">Sedentary</option>
          <option value="light">Light</option>
          <option value="moderate">Moderate</option>
          <option value="active">Active</option>
        </select>
        <button type="submit" className="btn-primary w-full">Save Profile</button>
      </form>
    </div>
  );
}