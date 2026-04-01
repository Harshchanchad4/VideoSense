const User = require('../models/User');
const Video = require('../models/Video');

const listUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, organization } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (organization) filter.organization = organization;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['viewer', 'editor', 'admin'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    // Prevent admin from downgrading themselves
    if (req.params.id === req.user.userId && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot change your own role.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: '-password' }
    );

    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: 'User role updated.', user });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'User not found.' });
    res.status(500).json({ error: 'Failed to update user role.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'User not found.' });
    res.status(500).json({ error: 'Failed to delete user.' });
  }
};

const getStats = async (req, res) => {
  try {
    const [totalUsers, totalVideos, videosByStatus] = await Promise.all([
      User.countDocuments(),
      Video.countDocuments(),
      Video.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const statusMap = {};
    videosByStatus.forEach((item) => {
      statusMap[item._id] = item.count;
    });

    res.json({
      stats: {
        totalUsers,
        totalVideos,
        videosByStatus: {
          pending: statusMap.pending || 0,
          processing: statusMap.processing || 0,
          safe: statusMap.safe || 0,
          flagged: statusMap.flagged || 0,
          error: statusMap.error || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};

module.exports = { listUsers, updateUserRole, deleteUser, getStats };
