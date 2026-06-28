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

module.exports = router;