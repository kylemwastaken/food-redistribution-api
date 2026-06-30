require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use('/uploads', express.static('uploads'));

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);



app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const userRoutes = require('./routes/users');
app.use('/api/users', userRoutes);

const listingRoutes = require('./routes/listings');
app.use('/api/listings', listingRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

