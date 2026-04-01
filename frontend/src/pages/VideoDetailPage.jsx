import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { videoApi } from '../services/api';
import Navbar from '../components/Navbar';
import VideoPlayer from '../components/VideoPlayer';
import StatusBadge from '../components/StatusBadge';

const formatFileSize = (bytes) => {
  if (!bytes) return 'N/A';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatDuration = (seconds) => {
  if (!seconds) return 'N/A';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const MetaRow = ({ label, value }) => (
  <div className="flex justify-between py-3 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500">{label}</span>
    <span className="text-sm font-medium text-gray-900">{value || 'N/A'}</span>
  </div>
);

const VideoDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await videoApi.get(id);
        setVideo(response.data.video);
      } catch (err) {
        setError(err.response?.data?.error || 'Video not found.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await videoApi.delete(id);
      navigate('/videos');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete video.');
      setDeleting(false);
    }
  };

  const canDelete = user?.role === 'admin' ||
    (user?.role === 'editor' && video?.uploadedBy?._id === user?._id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Video Not Found</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link to="/videos" className="btn-primary">Back to Library</Link>
        </div>
      </div>
    );
  }

  const canStream = video.status === 'safe' || video.status === 'flagged';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center space-x-2 text-sm text-gray-500">
          <Link to="/videos" className="hover:text-blue-600">Library</Link>
          <span>/</span>
          <span className="text-gray-900 truncate max-w-xs">{video.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Video player */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{video.title}</h1>
                <p className="text-gray-500 text-sm mt-1">{video.originalName}</p>
              </div>
              <StatusBadge status={video.status} reason={video.sensitivityReason} size="lg" />
            </div>

            {/* Flagged warning */}
            {video.status === 'flagged' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <p className="text-red-800 font-medium">
                      This video was flagged for sensitive content
                      {video.sensitivityReason && (
                        <span className="capitalize"> — <strong>{video.sensitivityReason}</strong> detected</span>
                      )}.
                    </p>
                    {video.sensitivityDetails && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(video.sensitivityDetails).map(([key, score]) => (
                          <span
                            key={key}
                            className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                              score >= 0.6
                                ? 'bg-red-100 text-red-700 border-red-300'
                                : score >= 0.3
                                ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                : 'bg-gray-100 text-gray-600 border-gray-300'
                            }`}
                          >
                            {key}: {(score * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {canStream ? (
              <VideoPlayer videoId={id} />
            ) : (
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-center text-white">
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-300">Video is {video.status}. Streaming not yet available.</p>
                </div>
              </div>
            )}
          </div>

          {/* Metadata panel */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Video Details</h3>
              <MetaRow label="Duration" value={formatDuration(video.duration)} />
              <MetaRow label="Resolution" value={video.resolution} />
              <MetaRow label="Codec" value={video.codec} />
              <MetaRow label="File Size" value={formatFileSize(video.size)} />
              <MetaRow label="Format" value={video.mimetype?.split('/')[1]?.toUpperCase()} />
              <MetaRow label="Category" value={video.category} />
            </div>

            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3">Upload Info</h3>
              <MetaRow label="Uploaded By" value={video.uploadedBy?.name} />
              <MetaRow label="Organization" value={video.organization} />
              <MetaRow label="Upload Date" value={new Date(video.createdAt).toLocaleString()} />
            </div>

            {/* Actions */}
            {canDelete && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="btn-danger w-full"
                  >
                    Delete Video
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">Are you sure? This cannot be undone.</p>
                    <button onClick={handleDelete} disabled={deleting} className="btn-danger w-full">
                      {deleting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary w-full">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoDetailPage;
