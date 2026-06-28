const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { fullName, email, password, phoneNumber, role, subType } = req.body;

  // Validate all fields are present
  if (!fullName || !email || !password || !phoneNumber || !role || !subType) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // Validate role
  if (!['donor', 'recipient'].includes(role)) {
    return res.status(400).json({ error: 'Role must be either donor or recipient.' });
  }

  // Validate subType based on role
  const donorSubTypes = ['restaurant', 'event_organizer'];
  const recipientSubTypes = ['charity', 'farm'];

  if (role === 'donor' && !donorSubTypes.includes(subType)) {
    return res.status(400).json({ error: 'Donor subType must be restaurant or event_organizer.' });
  }

  if (role === 'recipient' && !recipientSubTypes.includes(subType)) {
    return res.status(400).json({ error: 'Recipient subType must be charity or farm.' });
  }

  try {
    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        phoneNumber,
        role,
        subType,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role, subType: user.subType },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        subType: user.subType,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate fields
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, role: user.role, subType: user.subType },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        subType: user.subType,
      },
      redirectTo: user.role === 'donor' ? '/donor/dashboard' : '/listings',
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;