import { useState, useEffect, useRef } from 'react';
import { videoApi } from '../services/api';

const VideoPlayer = ({ videoId }) => {
  const [streamToken, setStreamToken] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        setLoading(true);
        const response = await videoApi.getStreamToken(videoId);
        setStreamToken(response.data.streamToken);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load video player.');
      } finally {
        setLoading(false);
      }
    };

    if (videoId) fetchToken();
  }, [videoId]);

  if (loading) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const streamUrl = `/api/videos/${videoId}/stream?token=${streamToken}`;

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        controls
        preload="metadata"
        className="w-full aspect-video"
        src={streamUrl}
      >
        <p className="text-white p-4">Your browser does not support the video tag.</p>
      </video>
    </div>
  );
};

export default VideoPlayer;
