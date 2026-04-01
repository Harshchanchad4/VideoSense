const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    filename: {
      type: String,
      required: true,
      unique: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    // FFmpeg metadata
    duration: {
      type: Number,
      default: null, // seconds
    },
    resolution: {
      type: String,
      default: null, // e.g. "1920x1080"
    },
    codec: {
      type: String,
      default: null,
    },
    // Processing state
    status: {
      type: String,
      enum: ['pending', 'processing', 'safe', 'flagged', 'error'],
      default: 'pending',
    },
    processingProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    processingError: {
      type: String,
      default: null,
    },
    // Sensitivity analysis result details
    sensitivityReason: {
      type: String,
      default: null, // e.g. 'nudity', 'violence', 'offensive content', 'gore'
    },
    sensitivityDetails: {
      type: Object,
      default: null, // e.g. { nudity: 0.92, violence: 0.03, offensive: 0.01, gore: 0.0 }
    },
    // Multi-tenant fields
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    organization: {
      type: String,
      required: true,
    },
    // Optional user-defined category
    category: {
      type: String,
      default: 'general',
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient filtering
videoSchema.index({ uploadedBy: 1, status: 1 });
videoSchema.index({ organization: 1, status: 1 });
videoSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Video', videoSchema);
