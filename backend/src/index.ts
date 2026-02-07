/**
 * ENS x402 Discovery - Backend API
 * 
 * Main entry point for the discovery API server
 */

import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes will be added here
// app.use('/api', apiRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ENS x402 Discovery API running on port ${PORT}`);
});
