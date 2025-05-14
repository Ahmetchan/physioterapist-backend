require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

// CORS ayarları - En basit yapılandırma
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// OPTIONS istekleri için ayrıca bir handler
app.options('*', cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Routes
app.use('/api/admin', require('./routes/admin'));
app.use('/api/appointments', require('./routes/appointments'));

// Test endpoint to verify API is working
app.get('/test', (req, res) => {
  res.json({ message: 'Test başarılı!' });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'API çalışıyor', mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
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