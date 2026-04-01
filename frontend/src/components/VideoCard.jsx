import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';
import useVideoProcessing from '../hooks/useVideoProcessing';

const formatFileSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoCard = ({ video, onDelete, canDelete }) => {
  // Track live processing if still pending/processing
  const isLive = video.status === 'pending' || video.status === 'processing';
  const { progress, status: liveStatus, message } = useVideoProcessing(isLive ? video._id : null);

  const displayStatus = isLive && liveStatus !== 'pending' ? liveStatus : video.status;
  const displayProgress = isLive ? progress : video.processingProgress;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Thumbnail placeholder */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 aspect-video flex items-center justify-center relative">
        <svg className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        <div className="absolute top-2 right-2">
          <StatusBadge status={displayStatus} reason={video.sensitivityReason} />
        </div>
        {video.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate" title={video.title}>{video.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{video.originalName}</p>

        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
          <span>{formatFileSize(video.size)}</span>
          <span>{new Date(video.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Live processing progress */}
        {isLive && (
          <div className="mt-3">
            <ProgressBar progress={displayProgress} color="yellow" />
            <p className="text-xs text-gray-500 mt-1 truncate">{message}</p>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {(displayStatus === 'safe' || displayStatus === 'flagged') && (
            <Link to={`/videos/${video._id}`} className="btn-primary text-sm py-1.5 flex-1 text-center">
              {displayStatus === 'flagged' ? 'Review' : 'Watch'}
            </Link>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(video._id, video.title)}
              className="btn-danger text-sm py-1.5 px-3"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
