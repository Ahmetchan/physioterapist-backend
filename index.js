require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS ayarları
app.use(cors({
  origin: ['https://physiotherapist-frontend.vercel.app', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection with detailed error logging
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB bağlantısı başarılı');
    console.log('Bağlantı URL\'i:', process.env.MONGODB_URI.replace(/:([^:@]{8})[^:@]*@/, ':****@')); // Şifreyi gizle
  })
  .catch(err => {
    console.error('MongoDB bağlantı hatası:');
    console.error('Hata kodu:', err.code);
    console.error('Hata mesajı:', err.message);
    if (err.reason) console.error('Sebep:', err.reason);
    console.error('Tam hata:', err);
  });

// Routes - admin route'ları önce gelmeli
app.use('/api/admin', require('./routes/admin'));
app.use('/api/appointments', require('./routes/appointments'));

// API 404 handler
app.use('/api/*', (req, res) => {
  console.log('404 isteği:', req.method, req.url);
  res.status(404).json({
    success: false,
    message: 'API endpoint bulunamadı'
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Fizyoterapist Randevu API çalışıyor',
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
  console.log('API URL:', `http://localhost:${PORT}/api`);
}); 