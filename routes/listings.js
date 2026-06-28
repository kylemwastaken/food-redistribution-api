const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const auth = require('../middleware/auth');

// GET /api/listings/dashboard
router.get('/dashboard', auth, async (req, res) => {

  // Only donors can access this
  if (req.user.role !== 'donor') {
    return res.status(403).json({ error: 'Access denied. Donors only.' });
  }

  try {
    const listings = await prisma.listing.findMany({
      where: { donorId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        quantity: true,
        classification: true,
        pickupDeadline: true,
        photoUrl: true,
        status: true,
        createdAt: true,
      },
    });

    // Group listings by status
    const dashboard = {
      available: listings.filter(l => l.status === 'available'),
      claimed: listings.filter(l => l.status === 'claimed'),
      expired: listings.filter(l => l.status === 'expired'),
    };

    res.status(200).json({
      totalListings: listings.length,
      dashboard,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;