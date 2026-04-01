const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const path = require('path');

const Video = require('../models/Video');
const { getIO } = require('../config/socket');
const { analyze } = require('./sensitivityAnalyzer');
const { moveFile } = require('../utils/fileUtils');

// Set binary paths for cross-environment compatibility
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const emitProgress = (videoId, progress, message, extra = {}) => {
  try {
    const io = getIO();
    io.to(videoId.toString()).emit('progress', {
      videoId,
      progress,
      message,
      ...extra,
    });
  } catch (err) {
    console.error('Failed to emit progress:', err.message);
  }
};

const extractMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const format = metadata.format;

      resolve({
        duration: format.duration ? parseFloat(format.duration) : null,
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
        codec: videoStream ? videoStream.codec_name : null,
      });
    });
  });
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const processVideo = async (videoDoc) => {
  const videoId = videoDoc._id.toString();
  const processingDelay = parseInt(process.env.PROCESSING_DELAY_MS) || 500;

  try {
    // Step 1: Mark as processing
    await Video.findByIdAndUpdate(videoId, {
      status: 'processing',
      processingProgress: 5,
    });

    try {
      const io = getIO();
      io.to(videoId).emit('processing_started', {
        videoId,
        message: 'Processing started',
      });
    } catch (e) {
      console.error('Socket emit failed:', e.message);
    }

    emitProgress(videoId, 10, 'Extracting video metadata...');
    await delay(processingDelay);

    // Step 2: Extract FFmpeg metadata
    let metadata = { duration: null, resolution: null, codec: null };
    try {
      metadata = await extractMetadata(videoDoc.filePath);
      console.log(`Metadata extracted for ${videoDoc.title}:`, metadata);
    } catch (ffErr) {
      console.error('FFprobe error (non-fatal):', ffErr.message);
    }

    await Video.findByIdAndUpdate(videoId, {
      ...metadata,
      processingProgress: 30,
    });

    emitProgress(videoId, 30, 'Metadata extracted. Moving to storage...');
    await delay(processingDelay);

    // Step 3: Move file from temp to processed directory
    const processedDir = process.env.UPLOAD_PROCESSED_DIR || 'uploads/processed';
    const filename = path.basename(videoDoc.filePath);
    const newFilePath = path.join(processedDir, filename);

    await moveFile(videoDoc.filePath, newFilePath);
    videoDoc.filePath = newFilePath; // keep in sync so analyzer reads the correct path

    await Video.findByIdAndUpdate(videoId, {
      filePath: newFilePath,
      processingProgress: 55,
    });

    emitProgress(videoId, 55, 'File stored. Running sensitivity analysis...');
    await delay(processingDelay);

    // Step 4: Run sensitivity analysis
    const { result: sensitivityResult, reason: sensitivityReason, details: sensitivityDetails } = await analyze(videoDoc);

    await Video.findByIdAndUpdate(videoId, {
      processingProgress: 85,
    });

    emitProgress(videoId, 85, 'Analysis complete. Finalizing...');
    await delay(processingDelay / 2);

    // Step 5: Finalize
    const finalVideo = await Video.findByIdAndUpdate(
      videoId,
      {
        status: sensitivityResult,
        processingProgress: 100,
        sensitivityReason: sensitivityReason || null,
        sensitivityDetails: sensitivityDetails || null,
      },
      { new: true }
    );

    emitProgress(videoId, 100, 'Processing complete!', {
      status: sensitivityResult,
      sensitivityReason: sensitivityReason || null,
    });

    try {
      const io = getIO();
      io.to(videoId).emit('processing_complete', {
        videoId,
        status: sensitivityResult,
        sensitivityReason: sensitivityReason || null,
        sensitivityDetails: sensitivityDetails || null,
        video: {
          _id: finalVideo._id,
          title: finalVideo.title,
          status: finalVideo.status,
          sensitivityReason: finalVideo.sensitivityReason,
          sensitivityDetails: finalVideo.sensitivityDetails,
          duration: finalVideo.duration,
          resolution: finalVideo.resolution,
          codec: finalVideo.codec,
        },
      });
    } catch (e) {
      console.error('Socket emit failed:', e.message);
    }

    console.log(`Video processing complete: ${videoDoc.title} → ${sensitivityResult}${sensitivityReason ? ` (${sensitivityReason})` : ''}`);
  } catch (err) {
    console.error(`Video processing failed for ${videoId}:`, err);

    await Video.findByIdAndUpdate(videoId, {
      status: 'error',
      processingError: err.message,
    });

    try {
      const io = getIO();
      io.to(videoId).emit('processing_error', {
        videoId,
        error: err.message,
      });
    } catch (e) {
      console.error('Socket emit failed:', e.message);
    }
  }
};

module.exports = { processVideo };
