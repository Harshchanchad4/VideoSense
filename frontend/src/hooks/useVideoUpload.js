import { useState, useCallback } from 'react';
import { videoApi } from '../services/api';

const useVideoUpload = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);

  const upload = useCallback(async (file, title, category = 'general') => {
    if (!file) throw new Error('No file provided');

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadedVideo(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('category', category);

    try {
      const response = await videoApi.upload(formData, (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(pct);
      });

      setUploadedVideo(response.data.video);
      return response.data.video;
    } catch (err) {
      const message = err.response?.data?.error || 'Upload failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUploadProgress(0);
    setIsUploading(false);
    setError(null);
    setUploadedVideo(null);
  }, []);

  return { uploadProgress, isUploading, error, uploadedVideo, upload, reset };
};

export default useVideoUpload;
