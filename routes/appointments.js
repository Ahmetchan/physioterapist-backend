const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const { sendAppointmentEmail } = require('../utils/emailService');
const BlockedSlot = require('../models/BlockedSlot');
const { getAvailableTimeSlots, isValidAppointmentTime } = require('../services/appointmentService');

// Yeni randevu oluştur
router.post('/', async (req, res) => {
  try {
    const { patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, notes } = req.body;

    // Generate unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    const appointment = new Appointment({
      patientName,
      patientEmail,
      patientPhone,
      appointmentDate,
      appointmentTime,
      notes,
      code
    });

    await appointment.save();
    await sendAppointmentEmail(appointment, 'created');

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Randevunuz başarıyla oluşturuldu. Lütfen e-postanızı kontrol edin.'
    });
  } catch (error) {
    console.error('Appointment creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Randevu oluşturulurken bir hata oluştu.',
      error: error.message
    });
  }
});

// Belirli bir tarihteki dolu saatleri döndür
router.get('/occupied', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'Tarih belirtilmeli' });
    }
    // Sadece iptal edilmemiş randevular
    const appointments = await Appointment.find({
      appointmentDate: date,
      status: { $ne: 'cancelled' }
    });
    const blocked = await BlockedSlot.find({ date });
    const occupiedTimes = [
      ...appointments.map(a => a.appointmentTime),
      ...blocked.map(b => b.time)
    ];
    res.json({ success: true, times: occupiedTimes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Müsait saatleri getir
router.get('/available-times/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const availableSlots = await getAvailableTimeSlots(date);
    res.json({ success: true, availableSlots });
  } catch (error) {
    console.error('Error getting available times:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Müsait saatler getirilirken bir hata oluştu.',
      error: error.message 
    });
  }
});

// Kod ile randevu sorgula
router.get('/:code', async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ code: req.params.code });
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Randevu bulunamadı' 
      });
    }
    res.json({ 
      success: true, 
      data: appointment 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Randevu sorgulanırken bir hata oluştu.',
      error: error.message 
    });
  }
});

module.exports = router; 