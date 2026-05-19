import { useState } from 'react';
import CameraView from '../components/CameraView';

export default function Workout() {
  const [exercise, setExercise] = useState('squat');
  const token = localStorage.getItem('token');

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-4">AI Workout Trainer</h1>
      <div className="mb-4">
        <label className="block text-gray-700 font-medium mb-1">Select exercise</label>
        <select
          value={exercise}
          onChange={e => setExercise(e.target.value)}
          className="input-field w-48"
        >
          <option value="squat">Squat</option>
          <option value="lunge">Lunge</option>
          <option value="pushup">Push‑up</option>
          <option value="curl">Bicep Curl</option>
        </select>
      </div>
      <CameraView exercise={exercise} token={token} />
    </div>
  );
}