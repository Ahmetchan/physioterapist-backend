const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const { sendAppointmentEmail } = require('../utils/emailService');
const BlockedSlot = require('../models/BlockedSlot');

// Yeni randevu oluştur
router.post('/', async (req, res) => {
  try {
    console.log('Randevu oluşturma isteği:', req.body);

    // Request body validation
    const requiredFields = ['patientName', 'patientEmail', 'patientPhone', 'appointmentDate', 'appointmentTime'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      console.error('Eksik alanlar:', missingFields);
      return res.status(400).json({
        success: false,
        message: `Eksik alanlar: ${missingFields.join(', ')}`
      });
    }

    // 6 haneli basit bir kod üret
    let code;
    let exists = true;
    while (exists) {
      code = Math.floor(100000 + Math.random() * 900000).toString();
      exists = await Appointment.findOne({ code });
    }

    // Tarih ve saat birleştirme
    const { appointmentDate, appointmentTime, ...rest } = req.body;
    console.log('İşlenen randevu bilgileri:', { appointmentDate, appointmentTime, ...rest });

    // Aynı gün ve aynı saatte başka bir randevu var mı kontrol et
    const existing = await Appointment.findOne({
      appointmentDate,
      appointmentTime,
      status: { $ne: 'cancelled' }
    });
    if (existing) {
      console.log('Çakışan randevu bulundu:', existing);
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

    console.log('Kaydedilecek randevu:', appointment);
    await appointment.save();
    console.log('Randevu başarıyla kaydedildi');

    let emailError = null;
    try {
      await sendAppointmentEmail(appointment, 'created');
      console.log('Randevu e-postası gönderildi');
    } catch (err) {
      console.error('E-posta gönderimi hatası:', err);
      emailError = err.message || 'E-posta gönderilemedi';
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: emailError ? 'Randevu oluşturuldu ancak e-posta gönderilemedi.' : 'Randevunuz başarıyla oluşturuldu!',
      emailError
    });
  } catch (error) {
    console.error('Randevu oluşturma hatası:', error);
    console.error('Hata detayları:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(400).json({ 
      success: false, 
      message: error.message,
      error: {
        name: error.name,
        details: error.message
      }
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