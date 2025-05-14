require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');

// CORS ayarları
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'] 
}));

// Test endpoint'i
app.get('/test', (req, res) => {
  res.json({ message: 'Test başarılı!' });
});

// Admin settings test
app.get('/api/admin/settings', (req, res) => {
  res.json({
    siteTitle: 'Test Site Başlığı',
    primaryColor: '#ff0000',
    secondaryColor: '#00ff00',
    fontFamily: 'Arial, sans-serif',
    aboutContent: '<p>Test içeriği</p>',
    backgroundImage: '',
    workingHours: {
      monday: { start: '09:00', end: '17:00' }
    }
  });
});

// Dinleme
const PORT = 5050;
app.listen(PORT, () => {
  console.log(`Test sunucusu ${PORT} portunda çalışıyor`);
});