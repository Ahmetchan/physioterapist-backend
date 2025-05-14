const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: true
  },
  patientEmail: {
    type: String,
    required: true
  },
  patientPhone: {
    type: String,
    required: true
  },
  appointmentDate: {
    type: String,
    required: true
  },
  appointmentTime: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending'
  },
  code: {
    type: String,
    required: true,
    unique: true
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Code alanı için index oluştur
AppointmentSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('Appointment', AppointmentSchema); 