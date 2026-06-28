const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const auth = require('../middleware/auth');

// GET /api/users/profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        subType: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.status(200).json({ user });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// PUT /api/users/profile
router.put('/profile', auth, async (req, res) => {
  const { fullName, phoneNumber, organizationName } = req.body;

  if (!fullName && !phoneNumber && !organizationName) {
    return res.status(400).json({ error: 'Provide at least one field to update.' });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(fullName && { fullName }),
        ...(phoneNumber && { phoneNumber }),
        ...(organizationName && { organizationName }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        role: true,
        subType: true,
      },
    });

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: updatedUser,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;