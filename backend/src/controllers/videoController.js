const path = require('path');
const Video = require('../models/Video');
const { processVideo } = require('../services/videoProcessor');
const { stream } = require('../services/streamingService');
const { deleteFile } = require('../utils/fileUtils');
const { signStreamToken, verifyStreamToken } = require('../utils/jwt');

const uploadVideo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const { title, category } = req.body;
    if (!title) {
      // Clean up the uploaded file
      await deleteFile(req.file.path);
      return res.status(400).json({ error: 'Video title is required.' });
    }

    const video = await Video.create({
      title: title.trim(),
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filePath: req.file.path,
      uploadedBy: req.user.userId,
      organization: req.user.organization,
      category: category || 'general',
      status: 'pending',
    });

    // Trigger processing asynchronously — do NOT await
    processVideo(video).catch((err) => {
      console.error('Async processVideo failed:', err);
    });

    res.status(202).json({
      message: 'Video uploaded. Processing started.',
      video: {
        _id: video._id,
        title: video.title,
        originalName: video.originalName,
        size: video.size,
        status: video.status,
        processingProgress: video.processingProgress,
        createdAt: video.createdAt,
      },
    });
  } catch (err) {
    // Clean up on error
    if (req.file) await deleteFile(req.file.path).catch(() => {});
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload video.' });
  }
};

const listVideos = async (req, res) => {
  try {
    const { status, category, page = 1, limit = 20, sortBy = 'createdAt', order = 'desc' } = req.query;

    // Multi-tenant: non-admins only see their org's videos
    const orgFilter =
      req.user.role === 'admin' ? {} : { organization: req.user.organization };

    // Viewers only see their own videos
    const ownershipFilter =
      req.user.role === 'viewer' ? { uploadedBy: req.user.userId } : {};

    const statusFilter = status ? { status } : {};
    const categoryFilter = category ? { category } : {};

    const filter = { ...orgFilter, ...ownershipFilter, ...statusFilter, ...categoryFilter };

    const sortOrder = order === 'asc' ? 1 : -1;
    const sortField = ['createdAt', 'size', 'title', 'status'].includes(sortBy) ? sortBy : 'createdAt';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [videos, total] = await Promise.all([
      Video.find(filter)
        .populate('uploadedBy', 'name email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Video.countDocuments(filter),
    ]);

    res.json({
      videos,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('List videos error:', err);
    res.status(500).json({ error: 'Failed to fetch videos.' });
  }
};

const getVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id).populate('uploadedBy', 'name email');

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Enforce org isolation
    if (req.user.role !== 'admin' && video.organization !== req.user.organization) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Viewers can only see their own videos
    if (req.user.role === 'viewer' && video.uploadedBy._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Generate a short-lived stream token
    const streamToken = signStreamToken(video._id.toString(), req.user.userId);

    // Don't expose filePath to clients
    const videoData = video.toObject();
    delete videoData.filePath;

    res.json({ video: videoData, streamToken });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Video not found.' });
    console.error('Get video error:', err);
    res.status(500).json({ error: 'Failed to fetch video.' });
  }
};

const streamVideo = async (req, res) => {
  try {
    // Accept stream token from query param (since <video src> can't send headers)
    const token = req.query.token || (req.headers.authorization?.split(' ')[1]);

    if (!token) {
      return res.status(401).json({ error: 'Stream token required.' });
    }

    let decoded;
    try {
      decoded = verifyStreamToken(token);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired stream token.' });
    }

    if (decoded.videoId !== req.params.id) {
      return res.status(403).json({ error: 'Token does not match requested video.' });
    }

    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });

    if (!['safe', 'flagged'].includes(video.status)) {
      return res.status(425).json({ error: 'Video is still processing. Please wait.' });
    }

    stream(req, res, video);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Video not found.' });
    console.error('Stream error:', err);
    res.status(500).json({ error: 'Streaming failed.' });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found.' });
    }

    // Org isolation
    if (req.user.role !== 'admin' && video.organization !== req.user.organization) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Editors can only delete their own videos
    if (req.user.role === 'editor' && video.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own videos.' });
    }

    // Delete file from disk
    await deleteFile(video.filePath).catch((err) =>
      console.error('File delete error (non-fatal):', err)
    );

    await Video.findByIdAndDelete(req.params.id);

    res.json({ message: 'Video deleted successfully.' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Video not found.' });
    console.error('Delete video error:', err);
    res.status(500).json({ error: 'Failed to delete video.' });
  }
};

const getStreamToken = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found.' });

    // Org isolation
    if (req.user.role !== 'admin' && video.organization !== req.user.organization) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Viewers only see their own
    if (req.user.role === 'viewer' && video.uploadedBy.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const streamToken = signStreamToken(video._id.toString(), req.user.userId);
    res.json({ streamToken });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Video not found.' });
    res.status(500).json({ error: 'Failed to generate stream token.' });
  }
};

module.exports = { uploadVideo, listVideos, getVideo, streamVideo, deleteVideo, getStreamToken };
