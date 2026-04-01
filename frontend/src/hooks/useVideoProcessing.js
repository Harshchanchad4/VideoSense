import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';

const useVideoProcessing = (videoId) => {
  const { socket } = useSocket();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('pending');
  const [message, setMessage] = useState('Waiting to start...');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedVideo, setCompletedVideo] = useState(null);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('pending');
    setMessage('Waiting to start...');
    setIsProcessing(false);
    setCompletedVideo(null);
  }, []);

  useEffect(() => {
    if (!socket || !videoId) return;

    // Join the room for this video
    socket.emit('join_video_room', videoId);

    const handleProcessingStarted = (data) => {
      if (data.videoId !== videoId) return;
      setIsProcessing(true);
      setStatus('processing');
      setMessage('Processing started...');
      setProgress(5);
    };

    const handleProgress = (data) => {
      if (data.videoId !== videoId) return;
      setProgress(data.progress);
      setMessage(data.message || 'Processing...');
      if (data.status) setStatus(data.status);
    };

    const handleComplete = (data) => {
      if (data.videoId !== videoId) return;
      setProgress(100);
      setStatus(data.status);
      setMessage(`Processing complete: ${data.status}`);
      setIsProcessing(false);
      setCompletedVideo(data.video || null);
    };

    const handleError = (data) => {
      if (data.videoId !== videoId) return;
      setStatus('error');
      setMessage(`Error: ${data.error}`);
      setIsProcessing(false);
    };

    socket.on('processing_started', handleProcessingStarted);
    socket.on('progress', handleProgress);
    socket.on('processing_complete', handleComplete);
    socket.on('processing_error', handleError);

    return () => {
      socket.off('processing_started', handleProcessingStarted);
      socket.off('progress', handleProgress);
      socket.off('processing_complete', handleComplete);
      socket.off('processing_error', handleError);
      socket.emit('leave_video_room', videoId);
    };
  }, [socket, videoId]);

  return { progress, status, message, isProcessing, completedVideo, reset };
};

export default useVideoProcessing;
