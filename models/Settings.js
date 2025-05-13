const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
  siteTitle: {
    type: String,
    default: 'Fizyoterapist Randevu Sistemi'
  },
  primaryColor: {
    type: String,
    default: '#007bff'
  },
  secondaryColor: {
    type: String,
    default: '#6c757d'
  },
  fontFamily: {
    type: String,
    default: 'Arial, sans-serif'
  },
  aboutContent: {
    type: String,
    default: 'Hakkımda içeriği buraya gelecek'
  },
  backgroundImage: {
    type: String,
    default: ''
  },
  workingHours: {
    type: Object,
    default: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: { start: '09:00', end: '13:00' },
      sunday: { start: '00:00', end: '00:00' }
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Settings', SettingsSchema); 