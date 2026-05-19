import { Link } from 'react-router-dom';
import { FiHome, FiActivity, FiDroplet, FiMessageSquare, FiBarChart2, FiUser, FiMapPin, FiLogOut } from 'react-icons/fi';

const navItems = [
  { to: '/', label: 'Dashboard', icon: FiHome },
  { to: '/workout', label: 'Workout', icon: FiActivity },
  { to: '/diet', label: 'Diet', icon: FiDroplet },
  { to: '/chat', label: 'AI Coach', icon: FiMessageSquare },
  { to: '/progress', label: 'Progress', icon: FiBarChart2 },
  { to: '/profile-setup', label: 'Profile', icon: FiUser },
  { to: '/gyms', label: 'Gyms', icon: FiMapPin },
];

export default function Navbar() {
  const logout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-4">
        <Link to="/" className="flex items-center gap-2">
          <FiActivity className="text-green-600 text-2xl" />
          <span className="text-green-700 text-xl font-bold">AI Fitness</span>
        </Link>
        <div className="flex flex-wrap gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-700 hover:bg-green-50 hover:text-green-600 transition"
            >
              <Icon size={18} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition"
          >
            <FiLogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}