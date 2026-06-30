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

const multer = require('multer');
const path = require('path');

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const isValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (isValid) {
      cb(null, true);
    } else {
      cb(new Error('Only jpeg, jpg, png, and webp images are allowed.'));
    }
  },
});

// POST /api/listings
router.post('/', auth, upload.single('photo'), async (req, res) => {

  // Only donors can post listings
  if (req.user.role !== 'donor') {
    return res.status(403).json({ error: 'Access denied. Donors only.' });
  }

  const { title, description, quantity, pickupDeadline, classification } = req.body;

  // Validate required fields
  if (!title || !description || !quantity || !pickupDeadline || !classification) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate classification
  if (!['edible', 'inedible'].includes(classification)) {
    return res.status(400).json({ error: 'Classification must be either edible or inedible.' });
  }

  // Validate pickup deadline is a future date
  const deadline = new Date(pickupDeadline);
  if (isNaN(deadline.getTime()) || deadline <= new Date()) {
    return res.status(400).json({ error: 'Pickup deadline must be a valid future date.' });
  }

  try {
    const listing = await prisma.listing.create({
      data: {
        title,
        description,
        quantity,
        pickupDeadline: deadline,
        classification,
        photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
        donorId: req.user.userId,
      },
    });

    res.status(201).json({
      message: 'Food listing created successfully.',
      listing,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/listings
router.get('/', auth, async (req, res) => {

  // Only recipients can browse listings
  if (req.user.role !== 'recipient') {
    return res.status(403).json({ error: 'Access denied. Recipients only.' });
  }

  // Determine which classification to show based on subType
  const classification = req.user.subType === 'charity' ? 'edible' : 'inedible';

  const { keyword, pickupDate } = req.query;

  // Build the where clause dynamically
  const where = {
    classification,
    status: 'available',
  };

  // Add keyword search (title or description)
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { description: { contains: keyword } },
    ];
  }

  // Add pickup date filter (matches listings with deadline on that day)
  if (pickupDate) {
    const startOfDay = new Date(pickupDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(pickupDate);
    endOfDay.setHours(23, 59, 59, 999);

    if (isNaN(startOfDay.getTime())) {
      return res.status(400).json({ error: 'Invalid pickupDate format. Use YYYY-MM-DD.' });
    }

    where.pickupDeadline = {
      gte: startOfDay,
      lte: endOfDay,
    };
  }

  try {
    const listings = await prisma.listing.findMany({
      where,
      orderBy: { pickupDeadline: 'asc' },
      select: {
        id: true,
        title: true,
        photoUrl: true,
        quantity: true,
        pickupDeadline: true,
        classification: true,
        createdAt: true,
        donor: {
          select: {
            fullName: true,
          },
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

// PUT /api/listings/:id
router.put('/:id', auth, async (req, res) => {

  // Only donors can edit listings
  if (req.user.role !== 'donor') {
    return res.status(403).json({ error: 'Access denied. Donors only.' });
  }

  const listingId = parseInt(req.params.id);
  const { title, description, quantity, classification, pickupDeadline } = req.body;

  // Validate at least one field is provided
  if (!title && !description && !quantity && !classification && !pickupDeadline) {
    return res.status(400).json({ error: 'Provide at least one field to update.' });
  }

  try {
    // Check listing exists and belongs to this donor
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.donorId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only edit your own listings.' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({ error: 'Only available listings can be edited.' });
    }

    // Validate classification if provided
    if (classification && !['edible', 'inedible'].includes(classification)) {
      return res.status(400).json({ error: 'Classification must be either edible or inedible.' });
    }

    // Validate pickup deadline if provided
    if (pickupDeadline) {
      const deadline = new Date(pickupDeadline);
      if (isNaN(deadline.getTime()) || deadline <= new Date()) {
        return res.status(400).json({ error: 'Pickup deadline must be a valid future date.' });
      }
    }

    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(quantity && { quantity }),
        ...(classification && { classification }),
        ...(pickupDeadline && { pickupDeadline: new Date(pickupDeadline) }),
      },
    });

    res.status(200).json({
      message: 'Listing updated successfully.',
      listing: updatedListing,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// DELETE /api/listings/:id
router.delete('/:id', auth, async (req, res) => {

  // Only donors can delete listings
  if (req.user.role !== 'donor') {
    return res.status(403).json({ error: 'Access denied. Donors only.' });
  }

  const listingId = parseInt(req.params.id);

  try {
    // Check listing exists and belongs to this donor
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.donorId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only delete your own listings.' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({ error: 'Only available listings can be deleted.' });
    }

    await prisma.listing.delete({ where: { id: listingId } });

    res.status(200).json({ message: 'Listing deleted successfully.' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/listings/:id/claim
router.post('/:id/claim', auth, async (req, res) => {

  // Only recipients can claim listings
  if (req.user.role !== 'recipient') {
    return res.status(403).json({ error: 'Access denied. Recipients only.' });
  }

  const listingId = parseInt(req.params.id);

  try {
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      include: {
        donor: {
          select: {
            fullName: true,
            phoneNumber: true,
            email: true,
          },
        },
      },
    });

    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({ error: 'This listing is no longer available.' });
    }

    // Make sure classification matches recipient subType
    const expectedClassification = req.user.subType === 'charity' ? 'edible' : 'inedible';
    if (listing.classification !== expectedClassification) {
      return res.status(403).json({ error: `${req.user.subType}s can only claim ${expectedClassification} listings.` });
    }

    const updatedListing = await prisma.listing.update({
      where: { id: listingId },
      data: {
        status: 'claimed',
        recipientId: req.user.userId,
      },
    });

    res.status(200).json({
      message: 'Listing claimed successfully.',
      listing: updatedListing,
      donorContact: {
        name: listing.donor.fullName,
        phoneNumber: listing.donor.phoneNumber,
        email: listing.donor.email,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;