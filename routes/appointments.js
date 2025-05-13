const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { sendAppointmentEmail } = require('../utils/emailService');
const BlockedSlot = require('../models/BlockedSlot');

// Yeni randevu oluştur
router.post('/', async (req, res) => {
  try {
    // 6 haneli basit bir kod üret
    let code;
    let exists = true;
    while (exists) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      exists = await Appointment.findOne({ code });
    }
    // Tarih ve saat birleştirme
    const { appointmentDate, appointmentTime, ...rest } = req.body;
    // appointmentDate artık doğrudan "YYYY-MM-DD" string

    // Aynı gün ve aynı saatte başka bir randevu var mı kontrol et
    const existing = await Appointment.findOne({
      appointmentDate,
      appointmentTime,
      status: { $ne: 'cancelled' }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Bu tarih ve saatte zaten bir randevu var. Lütfen başka bir saat seçin.'
      });
    }

    const appointment = new Appointment({
      ...rest,
      appointmentDate,
      appointmentTime,
      code
    });

    await appointment.save();
    let emailError = null;
    try {
      await sendAppointmentEmail(appointment, 'created');
    } catch (err) {
      emailError = err.message || 'E-posta gönderilemedi';
    }
    res.status(201).json({
      success: true,
      data: appointment,
      message: emailError ? 'Randevu oluşturuldu ancak e-posta gönderilemedi.' : 'Randevunuz başarıyla oluşturuldu!',
      emailError
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
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


// Kod ile randevu sorgula
router.get('/:code', async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ code: req.params.code });
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


module.exports = router; 