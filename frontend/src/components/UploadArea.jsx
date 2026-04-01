import { useState, useRef, useCallback } from 'react';
import useVideoUpload from '../hooks/useVideoUpload';
import useVideoProcessing from '../hooks/useVideoProcessing';
import ProgressBar from './ProgressBar';
import StatusBadge from './StatusBadge';

const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mpeg'];
const MAX_SIZE_MB = 500;

const UploadArea = ({ onUploadComplete }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [fileError, setFileError] = useState(null);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const fileInputRef = useRef(null);

  const { uploadProgress, isUploading, error: uploadError, upload, reset: resetUpload } = useVideoUpload();
  const { progress: processingProgress, status, message, isProcessing, completedVideo } = useVideoProcessing(currentVideoId);

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload MP4, WebM, MOV, AVI, or MPEG files.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFile = (file) => {
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      setSelectedFile(null);
    } else {
      setFileError(null);
      setSelectedFile(file);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [title]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !title.trim()) return;

    try {
      const video = await upload(selectedFile, title.trim(), category);
      setCurrentVideoId(video._id);
    } catch {
      // error is handled in the hook
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setTitle('');
    setCategory('general');
    setFileError(null);
    setCurrentVideoId(null);
    resetUpload();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isComplete = status === 'safe' || status === 'flagged' || status === 'error';

  // Trigger parent callback when processing completes
  if (isComplete && completedVideo && onUploadComplete) {
    // Use a ref-based approach to avoid calling on every render
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Video</h2>

      {!currentVideoId ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : selectedFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg"
              onChange={handleFileInput}
              className="hidden"
            />

            {selectedFile ? (
              <div>
                <svg className="mx-auto h-12 w-12 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                <p className="text-xs text-blue-500 mt-1">Click to change file</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-gray-600 font-medium">Drop your video here, or click to browse</p>
                <p className="text-sm text-gray-400 mt-1">MP4, WebM, MOV, AVI, MPEG up to {MAX_SIZE_MB}MB</p>
              </div>
            )}
          </div>

          {fileError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{fileError}</p>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title"
              className="input-field"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
              <option value="general">General</option>
              <option value="education">Education</option>
              <option value="entertainment">Entertainment</option>
              <option value="news">News</option>
              <option value="sports">Sports</option>
              <option value="other">Other</option>
            </select>
          </div>

          {uploadError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>
          )}

          <button
            type="submit"
            disabled={!selectedFile || !title.trim() || isUploading}
            className="btn-primary w-full"
          >
            {isUploading ? 'Uploading...' : 'Upload & Analyze'}
          </button>
        </form>
      ) : (
        /* Processing state */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <StatusBadge status={status} />
          </div>

          {isUploading && (
            <ProgressBar progress={uploadProgress} label="Uploading to server" color="blue" />
          )}

          {currentVideoId && (
            <ProgressBar
              progress={processingProgress}
              label="Analyzing content"
              color={status === 'flagged' ? 'red' : status === 'safe' ? 'green' : 'yellow'}
            />
          )}

          <p className="text-sm text-gray-500 text-center">{message}</p>

          {isComplete && (
            <div className={`rounded-lg p-4 text-center ${status === 'safe' ? 'bg-green-50 border border-green-200' : status === 'flagged' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
              {status === 'safe' && <p className="text-green-800 font-medium">Video passed sensitivity analysis and is ready to stream.</p>}
              {status === 'flagged' && <p className="text-red-800 font-medium">Video was flagged during sensitivity analysis. Review required.</p>}
              {status === 'error' && <p className="text-orange-800 font-medium">Processing encountered an error. Please try again.</p>}
            </div>
          )}

          {isComplete && (
            <div className="flex gap-2">
              <button onClick={handleReset} className="btn-secondary flex-1">Upload Another</button>
              {completedVideo && (
                <a href={`/videos/${completedVideo._id}`} className="btn-primary flex-1 text-center">View Video</a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UploadArea;
