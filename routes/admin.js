const express = require('express');
const router = express.Router();
const prisma = require('../config/db');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/admin');

// GET /api/admin/users
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        organizationName: true,
        role: true,
        subType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      totalUsers: users.length,
      users,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/admin/listings
router.get('/listings', auth, adminOnly, async (req, res) => {
  try {
    const listings = await prisma.listing.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        donor: {
          select: { fullName: true, email: true },
        },
        recipient: {
          select: { fullName: true, email: true },
        },
      },
    });

    res.status(200).json({
      totalListings: listings.length,
      listings,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE /api/admin/listings/:id
router.delete('/listings/:id', auth, adminOnly, async (req, res) => {
  const listingId = parseInt(req.params.id);

  try {
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    await prisma.listing.delete({ where: { id: listingId } });

    res.status(200).json({ message: 'Listing deleted by admin successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;