const UserNotifications = require('../models/notificationModel');
const User = require('../models/userModel');

// Get all notifications for the current user (with pagination)
exports.getNotifications = async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const userNotifications = await UserNotifications.findOne({ userId })
      .populate('notifications.sender', 'username avatar')
      .populate({
        path: 'notifications.post',
        select: '_id caption image imageUrl videoUrl mediaType thumbnailUrl youtubeData author',
        populate: [
          {
            path: 'author',
            select: 'username avatar'
          },
          {
            path: 'youtubeData',
            select: 'thumbnailUrl'
          }
        ]
      })
      .lean();

    if (!userNotifications) {
      return res.json({
        notifications: [],
        currentPage: page,
        totalPages: 0,
        totalNotifications: 0,
        unreadCount: 0
      });
    }

    // Sort notifications by creation date (newest first) and apply pagination
    const sortedNotifications = userNotifications.notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(skip, skip + limit);

    const totalNotifications = userNotifications.notifications.length;
    const unreadCount = userNotifications.unreadCount || 0;
    
    res.json({
      notifications: sortedNotifications,
      currentPage: page,
      totalPages: Math.ceil(totalNotifications / limit),
      totalNotifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error while fetching notifications.', error: error.message });
  }
};

// Mark all notifications as read
exports.markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await UserNotifications.updateOne(
      { userId },
      { 
        $set: { 
          'notifications.$[].read': true,
          unreadCount: 0
        }
      }
    );

    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// @desc    Mark a specific notification as read
// @route   POST /api/notifications/:notificationId/mark-read
// @access  Private
exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    // Find the document and update one notification
    const result = await UserNotifications.updateOne(
      { userId, 'notifications._id': notificationId, 'notifications.read': false },
      { 
        $set: { 'notifications.$.read': true },
        $inc: { unreadCount: -1 }
      }
    );
    
    // If we didn't update anything (maybe already read), do nothing
    // This prevents unnecessary checks for negative unreadCount

    res.status(200).json({ 
      message: 'Notification marked as read.'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid notification ID.' });
    }
    res.status(500).json({ message: 'Server error.', error: error.message });
  }};

// @desc    Delete a specific notification
// @route   DELETE /api/notifications/:notificationId
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const userNotificationsDoc = await UserNotifications.findOne({ userId });

    if (!userNotificationsDoc) {
      return res.status(404).json({ message: 'User notifications not found.' });
    }

    const notificationToRemove = userNotificationsDoc.notifications.find(n => n._id.toString() === notificationId);

    if (!notificationToRemove) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    
    const shouldDecrementUnread = !notificationToRemove.read;

    const updateQuery = {
      $pull: {
        notifications: { _id: notificationId }
      }
    };

    if (shouldDecrementUnread) {
      updateQuery.$inc = { unreadCount: -1 };
    }

    await UserNotifications.updateOne({ userId }, updateQuery);
    
    // Ensure unreadCount doesn't go below zero
    await UserNotifications.updateOne(
        { userId, unreadCount: { $lt: 0 } },
        { $set: { unreadCount: 0 } }
    );

    res.status(200).json({ 
      message: 'Notification deleted successfully.',
      deletedNotificationId: notificationId
    });

  } catch (error) {
    console.error('Error deleting notification:', error);
    if (error.kind === 'ObjectId') {
        return res.status(400).json({ message: 'Invalid notification ID.' });
    }
    res.status(500).json({ message: 'Server error while deleting notification.', error: error.message });
  }
};

// Function to add a notification (used in other controllers)
exports.addNotification = async (recipientId, notificationData) => {
  try {
    // Check if we are sending a notification to ourselves
    if (recipientId.toString() === notificationData.sender.toString()) {
      return;
    }

    const findQuery = { userId: recipientId };
    const notificationDetails = {
      type: notificationData.type,
      sender: notificationData.sender,
      post: notificationData.post,
    };

    // For likes and follows - prevent duplicates
    if (notificationData.type === 'like' || notificationData.type === 'follow') {
      const existing = await UserNotifications.findOne({
        userId: recipientId,
        notifications: {
          $elemMatch: {
            type: notificationData.type,
            sender: notificationData.sender,
            post: notificationData.post || null
          }
        }
      });

      if (existing) {
        return; // Notification already exists, do nothing
      }
    }

    const update = {
      $push: {
        notifications: {
          $each: [notificationData],
          $position: 0 // Add to the beginning of the array
        }
      },
      $inc: { unreadCount: 1 }
    };

    const options = {
      upsert: true, // Create document if not found
      new: true
    };
    
    await UserNotifications.findOneAndUpdate(findQuery, update, options);

  } catch (error) {
    console.error('Error adding notification:', error);
  }
};

// Function to remove a notification (e.g., when unliking)
exports.removeNotification = async (recipientId, notificationQuery) => {
  try {
    // Find the notification to be deleted to check if it was read
    const userNotificationsDoc = await UserNotifications.findOne({
      userId: recipientId,
      'notifications.type': notificationQuery.type,
      'notifications.sender': notificationQuery.sender,
      'notifications.post': notificationQuery.post || null,
    }).lean(); // lean() for speed

    if (!userNotificationsDoc) {
      return; // Document or notification not found
    }

    const notificationToRemove = userNotificationsDoc.notifications.find(n =>
      n.type === notificationQuery.type &&
      n.sender.toString() === notificationQuery.sender.toString() &&
      (n.post ? n.post.toString() : null) === (notificationQuery.post ? notificationQuery.post.toString() : null)
    );

    if (!notificationToRemove) {
      return;
    }

    // Determine if unreadCount needs to be decremented
    const shouldDecrementUnread = !notificationToRemove.read;
    
    const updateQuery = {
      $pull: {
        notifications: {
          type: notificationQuery.type,
          sender: notificationQuery.sender,
          post: notificationQuery.post,
        }
      }
    };
    
    if (shouldDecrementUnread) {
      updateQuery.$inc = { unreadCount: -1 };
    }

    await UserNotifications.updateOne({ userId: recipientId }, updateQuery);
    
    // Additional check to ensure unreadCount does not become negative
    await UserNotifications.updateOne(
        { userId: recipientId, unreadCount: { $lt: 0 } },
        { $set: { unreadCount: 0 } }
    );

  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};
