require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('../models/Settings');

async function initializeSettings() {
  try {
    // MongoDB'ye bağlan
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB bağlantısı başarılı');

    // Settings koleksiyonunda döküman var mı kontrol et
    const existingSettings = await Settings.findOne();
    
    if (existingSettings) {
      console.log('Settings koleksiyonu zaten var:', existingSettings);
    } else {
      // Yeni bir Settings dökümanı oluştur
      const newSettings = new Settings({
        siteTitle: 'Fizyoterapist Randevu Sistemi',
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        fontFamily: 'Arial, sans-serif',
        aboutContent: 'Hakkımda içeriği buraya gelecek',
        backgroundImage: '',
        workingHours: {
          monday: { start: '09:00', end: '17:00' },
          tuesday: { start: '09:00', end: '17:00' },
          wednesday: { start: '09:00', end: '17:00' },
          thursday: { start: '09:00', end: '17:00' },
          friday: { start: '09:00', end: '17:00' },
          saturday: { start: '09:00', end: '13:00' },
          sunday: { start: '00:00', end: '00:00' }
        }
      });
      
      await newSettings.save();
      console.log('Yeni Settings oluşturuldu:', newSettings);
    }
  } catch (error) {
    console.error('Hata:', error);
  } finally {
    // Bağlantıyı kapat
    await mongoose.disconnect();
    console.log('MongoDB bağlantısı kapatıldı');
  }
}

// Fonksiyonu çalıştır
initializeSettings();