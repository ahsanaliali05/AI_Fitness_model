import { useState, useEffect } from 'react';
import api from '../api';
import CameraView from '../components/CameraView';   // ✅ Keep this

export default function Workout() {
  const [exercise, setExercise] = useState('squat');
  const [videoUrl, setVideoUrl] = useState(null);
  const [workoutPlan, setWorkoutPlan] = useState(null);
  const token = localStorage.getItem('token');

  // Fetch video recommendation when exercise changes
  useEffect(() => {
    if (exercise) {
      api.get(`/api/workout/videos?exercise=${exercise}`)
        .then(res => setVideoUrl(res.data.url))
        .catch(() => setVideoUrl(null));
    }
  }, [exercise]);

  const fetchWorkoutPlan = async () => {
    try {
      const res = await api.post('/api/workout/generate', { duration: 3, focus: 'full_body' });
      setWorkoutPlan(res.data);
    } catch (err) {
      alert('Complete your profile first to generate a plan');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">AI Workout Trainer</h1>
      
      {/* Exercise selector */}
      <div className="card mb-6">
        <label className="block font-medium mb-2">Select Exercise</label>
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

      {/* Pose estimation camera (original feature) */}
      <CameraView exercise={exercise} token={token} />

      {/* New: Video form guide */}
      {videoUrl && (
        <div className="card mt-6">
          <h3 className="font-semibold mb-2">📹 Form Guide: {exercise}</h3>
          <div className="relative pb-[56.25%] h-0">
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={videoUrl.replace('watch?v=', 'embed/')}
              title="Exercise video"
              frameBorder="0"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* New: Generate a workout plan */}
      <div className="card mt-6">
        <h2 className="text-xl font-semibold mb-3">💪 Generate a Workout Plan</h2>
        <button onClick={fetchWorkoutPlan} className="btn-primary mb-4">
          Get 3-Day Plan
        </button>
        {workoutPlan && (
          <div>
            <p className="font-medium">Goal: {workoutPlan.goal.replace('_',' ')}</p>
            <p className="text-sm text-gray-600 mb-2">{workoutPlan.tip}</p>
            {workoutPlan.plan.slice(0,3).map(day => (
              <div key={day.day} className="border-t pt-2 mt-2">
                <p className="font-bold">Day {day.day}</p>
                <ul className="list-disc ml-5 text-sm">
                  {day.exercises.map((ex,i) => <li key={i}>{ex}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
