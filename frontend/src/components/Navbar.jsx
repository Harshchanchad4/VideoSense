import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navLink = (path, label) => (
    <Link
      to={path}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive(path)
          ? 'bg-blue-700 text-white'
          : 'text-blue-100 hover:bg-blue-700 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="bg-blue-600 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="flex items-center space-x-2">
              <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              <span className="text-white font-bold text-lg">VideoSense</span>
            </Link>
            <div className="hidden md:flex space-x-1">
              {navLink('/dashboard', 'Dashboard')}
              {navLink('/videos', 'Library')}
              {user?.role === 'admin' && navLink('/admin', 'Admin')}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Socket connection indicator */}
            <div className="flex items-center space-x-1" title={connected ? 'Real-time connected' : 'Connecting...'}>
              <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
              <span className="text-blue-100 text-xs hidden sm:block">{connected ? 'Live' : 'Connecting'}</span>
            </div>

            <div className="flex items-center space-x-2">
              <div className="text-right hidden sm:block">
                <p className="text-white text-sm font-medium">{user?.name}</p>
                <p className="text-blue-200 text-xs capitalize">{user?.role} · {user?.organization}</p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-blue-700 hover:bg-blue-800 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
