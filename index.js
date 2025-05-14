require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// Tüm originlere izin ver - En basit yapılandırma
app.use(cors({
  origin: '*', // Tüm domainlere izin ver
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true
}));

// Her isteğe manuel CORS headerları ekle
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // CORS debug log
  console.log(`${new Date().toISOString()} - Request origin: ${req.headers.origin || 'No origin'}`);
  console.log(`${new Date().toISOString()} - Setting CORS headers`);
  
  // OPTIONS isteği için erken yanıt ver
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Duplike API prefix (/api/api/) route handler
app.use((req, res, next) => {
  // /api/api/ şeklinde duplike path'leri düzelt
  if (req.path.startsWith('/api/api/')) {
    const newPath = req.path.replace('/api/api/', '/api/');
    console.log(`URL düzeltildi: ${req.path} -> ${newPath}`);
    req.url = newPath;
  }
  next();
});

// Tüm istekleri logla
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB bağlantısı başarılı');
  })
  .catch(err => {
    console.error('MongoDB bağlantı hatası:', err);
  });

// MongoDB bağlantı durumunu kontrol et
mongoose.connection.on('connected', () => console.log('MongoDB bağlantısı başarılı'));
mongoose.connection.on('error', err => console.error('MongoDB bağlantı hatası:', err));
mongoose.connection.on('disconnected', () => console.log('MongoDB bağlantısı kesildi'));

// Routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/appointments', require('./routes/appointments'));

// Test endpoint to verify API is working
app.get('/test', (req, res) => {
  res.json({ message: 'Test başarılı!' });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'API çalışıyor', 
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    config: {
      nodeEnv: process.env.NODE_ENV || 'development',
      mongoUri: process.env.MONGODB_URI ? 'SET' : 'NOT_SET',
      port: process.env.PORT || 5000
    }
  });
});

// Catch-all route
app.use('*', (req, res) => {
  console.log('404 isteği:', req.method, req.originalUrl);
  res.status(404).json({ message: 'Endpoint bulunamadı' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server ${PORT} portunda çalışıyor`);
});