import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useAnimation } from 'framer-motion';
import { 
  FiActivity, FiDroplet, FiMessageSquare, FiBarChart2, 
  FiMapPin, FiTrendingUp, FiAward, FiZap, FiTarget, 
  FiCalendar, FiClock, FiHeart, FiCheckCircle
} from 'react-icons/fi';
import api from '../api';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

// All possible challenges (source of truth)
const ALL_CHALLENGES = [
  { id: 1, name: "7-Day Squat Challenge", description: "Starts in 2 days" },
  { id: 2, name: "10,000 Steps Daily", description: "Active now" },
  { id: 3, name: "Push‑up Progression", description: "Next week" },
];

export default function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [recentAccuracy, setRecentAccuracy] = useState(null);
  const [todayStats, setTodayStats] = useState({ total_reps: 0, avg_accuracy: 0 });
  const [yesterdayStats, setYesterdayStats] = useState({ total_reps: 0, avg_accuracy: 0 });
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [completedChallengeIds, setCompletedChallengeIds] = useState([]);
  const controls = useAnimation();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) controls.start("visible");
  }, [controls, inView]);

  useEffect(() => {
    api.get('/api/profile/')
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null));
    api.get('/api/progress/latest')
      .then(res => setRecentAccuracy(res.data.accuracy))
      .catch(() => {});
    api.get('/api/workout/today')
      .then(res => setTodayStats(res.data))
      .catch(() => {});
    api.get('/api/workout/yesterday')
      .then(res => setYesterdayStats(res.data))
      .catch(() => {});
    api.get('/api/workout/recent')
      .then(res => setRecentWorkouts(res.data))
      .catch(() => {});
    // Load completed challenges
    api.get('/api/challenges/completed')
      .then(res => {
        const ids = res.data.map(c => c.challenge_id);
        setCompletedChallengeIds(ids);
      })
      .catch(err => console.error(err));
  }, []);

  const markChallengeComplete = async (challenge) => {
    try {
      await api.post('/api/challenges/complete', { challenge_id: challenge.id });
      setCompletedChallengeIds(prev => [...prev, challenge.id]);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to mark challenge as complete');
    }
  };

  const upcomingChallenges = ALL_CHALLENGES.filter(ch => !completedChallengeIds.includes(ch.id));
  const completedChallenges = ALL_CHALLENGES.filter(ch => completedChallengeIds.includes(ch.id));

  const stats = [
    { label: 'Last Accuracy', value: recentAccuracy ? `${recentAccuracy}%` : '—', icon: FiTrendingUp, color: 'text-green-600' },
    { label: 'Fitness Goal', value: profile?.fitness_goal?.replace('_', ' ') || 'Not set', icon: FiTarget, color: 'text-green-600' },
    { label: 'Today’s Reps', value: todayStats.total_reps, icon: FiActivity, color: 'text-green-600' },
  ];

  const features = [
    { title: 'AI Workout Trainer', icon: FiActivity, desc: 'Real‑time pose correction with skeleton & Squat Master', link: '/workout', badge: 'New' },
    { title: 'Personalised Diet Plan', icon: FiDroplet, desc: '7‑day meal plan tailored to your goals', link: '/diet', badge: null },
    { title: 'AI Fitness Coach', icon: FiMessageSquare, desc: 'Chat with TinyLlama – your local AI expert', link: '/chat', badge: 'AI' },
    { title: 'Progress Tracker', icon: FiBarChart2, desc: 'Log weight, view accuracy history', link: '/progress', badge: null },
    { title: 'Gym & Trainers', icon: FiMapPin, desc: 'Find partner gyms and certified trainers', link: '/gyms', badge: null },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Hero Section (unchanged) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-green-50 to-white p-8 md:p-12 mb-12 shadow-sm border border-green-100">
        <div className="relative z-10">
          <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wider bg-green-100 text-green-700 rounded-full mb-4">
            AI POWERED FITNESS
          </span>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-gray-800">
            Transform Your <span className="text-green-600">Fitness Journey</span>
          </h1>
          <p className="text-gray-600 text-lg mt-4 max-w-2xl">
            Real‑time pose correction, personalised diet & workout plans, and a local AI coach – all in one sleek app.
          </p>
          <div className="flex flex-wrap gap-4 mt-8">
            <Link to="/workout" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition flex items-center gap-2 shadow-sm">
              <FiZap /> Start Workout
            </Link>
            {!profile && (
              <Link to="/profile-setup" className="border border-green-600 text-green-600 hover:bg-green-50 py-2 px-6 rounded-lg transition">
                Complete Profile
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Stats Cards */}
      <motion.div 
        ref={ref}
        initial="hidden"
        animate={controls}
        variants={staggerContainer}
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
      >
        {stats.map((stat, idx) => (
          <motion.div key={idx} variants={fadeUp} className="bg-white rounded-xl p-6 flex items-center justify-between border border-gray-100 shadow-sm hover:shadow-md transition">
            <div>
              <p className="text-gray-500 text-sm">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800">{stat.value}</p>
            </div>
            <stat.icon className={`text-3xl ${stat.color}`} />
          </motion.div>
        ))}
      </motion.div>

      {/* Today vs Yesterday Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
            <FiCalendar /> Today’s Workout
          </h2>
          <p className="text-gray-600 mt-2">Reps: <strong>{todayStats.total_reps}</strong></p>
          <p className="text-gray-600">Avg accuracy: <strong>{todayStats.avg_accuracy}%</strong></p>
          {todayStats.total_reps === 0 && <p className="text-gray-400 text-sm mt-2">No workout yet today.</p>}
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
            <FiClock /> Yesterday’s Accuracy
          </h2>
          <p className="text-gray-600 mt-2">Avg accuracy: <strong>{yesterdayStats.avg_accuracy}%</strong></p>
          {yesterdayStats.avg_accuracy > 0 && (
            <p className="text-sm mt-1 text-gray-500">
              {yesterdayStats.avg_accuracy > todayStats.avg_accuracy ? '📉 Slightly lower than yesterday – keep pushing!' : '📈 Great improvement compared to yesterday!'}
            </p>
          )}
        </div>
      </div>

      {/* Recent Completed Workouts */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <FiCheckCircle /> Completed Workouts
        </h2>
        {recentWorkouts.length === 0 ? (
          <p className="text-gray-500">No workouts recorded yet. Start a workout session and press Save to record.</p>
        ) : (
          <div className="space-y-3">
            {recentWorkouts.map(session => (
              <div key={session.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-800 capitalize">{session.exercise}</p>
                  <p className="text-sm text-gray-500">{session.rep_count} reps · {session.avg_accuracy}% accuracy</p>
                </div>
                <span className="text-xs text-gray-400">{session.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Challenges Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
            <FiAward className="text-yellow-500" /> Upcoming Challenges
          </h2>
          {upcomingChallenges.length === 0 ? (
            <p className="text-gray-500">All challenges completed! Check back later for new ones.</p>
          ) : (
            <div className="space-y-3">
              {upcomingChallenges.map(challenge => (
                <div key={challenge.id} className="border-l-4 border-green-500 pl-3 py-2 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">{challenge.name}</p>
                    <p className="text-sm text-gray-500">{challenge.description}</p>
                  </div>
                  <button
                    onClick={() => markChallengeComplete(challenge)}
                    className="bg-green-600 text-white text-xs px-3 py-1 rounded-md hover:bg-green-700 transition"
                  >
                    Done
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {completedChallenges.length > 0 && (
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
              <FiCheckCircle className="text-green-600" /> Completed Challenges
            </h2>
            <div className="space-y-3">
              {completedChallenges.map(challenge => (
                <div key={challenge.id} className="border-l-4 border-green-500 pl-3 py-2">
                  <p className="font-semibold text-gray-800">{challenge.name}</p>
                  <p className="text-xs text-gray-400">Completed (expires in 1 hour)</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Features Grid (unchanged) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Everything You Need</h2>
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {features.map((feat, idx) => (
              <motion.div key={idx} variants={fadeUp} whileHover={{ scale: 1.02 }} className="h-full">
                <Link to={feat.link} className="block bg-white rounded-xl p-6 border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:border-green-200 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <feat.icon className="text-green-600 text-3xl mb-4" />
                    {feat.badge && (
                      <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded-full">{feat.badge}</span>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">{feat.title}</h3>
                  <p className="text-gray-500 text-sm mb-4">{feat.desc}</p>
                  <span className="text-green-600 text-sm group-hover:translate-x-1 transition inline-block">Learn more →</span>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Top Exercises (dummy) */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
            <FiAward className="text-yellow-500" /> Top Exercises
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="font-medium text-gray-800">Squat</span>
              <span className="text-sm text-gray-500">92% avg accuracy</span>
            </div>
            <div className="flex justify-between items-center border-b border-gray-100 pb-2">
              <span className="font-medium text-gray-800">Lunge</span>
              <span className="text-sm text-gray-500">88% avg accuracy</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-800">Push‑up</span>
              <span className="text-sm text-gray-500">85% avg accuracy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Profile missing prompt */}
      {!profile && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-8 text-center">
          <p className="text-yellow-800">You haven't completed your profile. <Link to="/profile-setup" className="underline text-yellow-700">Set up now</Link> to get personalised diet plans and track progress.</p>
        </div>
      )}

      {/* Motivational Quote */}
      <div className="text-center mt-12">
        <FiHeart className="text-green-500 text-3xl mx-auto mb-2" />
        <p className="text-gray-500 italic">“The only bad workout is the one that didn’t happen.”</p>
        <p className="text-gray-400 text-sm mt-1">— Your AI Fitness Coach</p>
      </div>
    </div>
  );
}