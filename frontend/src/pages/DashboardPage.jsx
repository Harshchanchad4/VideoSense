import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { videoApi } from '../services/api';
import UploadArea from '../components/UploadArea';
import Navbar from '../components/Navbar';
import StatusBadge from '../components/StatusBadge';

const StatCard = ({ label, value, color }) => (
  <div className="card text-center">
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    <p className="text-sm text-gray-500 mt-1">{label}</p>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [recentVideos, setRecentVideos] = useState([]);
  const [stats, setStats] = useState({ pending: 0, processing: 0, safe: 0, flagged: 0 });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await videoApi.list({ limit: 5, sortBy: 'createdAt', order: 'desc' });
      const videos = response.data.videos;
      setRecentVideos(videos);

      const statusCounts = { pending: 0, processing: 0, safe: 0, flagged: 0 };
      videos.forEach((v) => {
        if (statusCounts[v.status] !== undefined) statusCounts[v.status]++;
      });
      setStats(statusCounts);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUploadComplete = () => {
    fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-gray-500 mt-1">
            {user?.organization} · <span className="capitalize">{user?.role}</span>
          </p>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard label="Pending" value={stats.pending} color="text-gray-700" />
            <StatCard label="Processing" value={stats.processing} color="text-yellow-600" />
            <StatCard label="Safe" value={stats.safe} color="text-green-600" />
            <StatCard label="Flagged" value={stats.flagged} color="text-red-600" />
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload section — editors and admins only */}
          {(user?.role === 'editor' || user?.role === 'admin') && (
            <div>
              <UploadArea onUploadComplete={handleUploadComplete} />
            </div>
          )}

          {/* Recent videos */}
          <div className={user?.role === 'viewer' ? 'lg:col-span-2' : ''}>
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Recent Videos</h2>
                <Link to="/videos" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View all
                </Link>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : recentVideos.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                  </svg>
                  <p className="text-gray-500">No videos yet. Upload your first video!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVideos.map((video) => (
                    <div key={video._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{video.title}</p>
                        <p className="text-xs text-gray-400">{new Date(video.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <StatusBadge status={video.status} />
                        {(video.status === 'safe' || video.status === 'flagged') && (
                          <Link to={`/videos/${video._id}`} className="text-blue-600 hover:text-blue-700 text-sm">
                            View
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
