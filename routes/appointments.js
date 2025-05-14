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
    console.log('Yeni randevu isteği alındı:', req.body);
    const { patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, notes } = req.body;

    // Gerekli alanları kontrol et
    if (!patientName || !patientEmail || !patientPhone || !appointmentDate || !appointmentTime) {
      console.error('Eksik alan hatası:', { patientName, patientEmail, patientPhone, appointmentDate, appointmentTime });
      return res.status(400).json({
        success: false,
        message: 'Tüm zorunlu alanları doldurun.'
      });
    }

    // Generate unique code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Tarih formatını kontrol et (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
      console.error('Tarih format hatası:', appointmentDate);
      return res.status(400).json({
        success: false,
        message: 'Geçersiz tarih formatı. YYYY-MM-DD formatında olmalı.'
      });
    }

    // Yeni appointment oluştur
    console.log('Randevu oluşturuluyor:', { patientName, patientEmail, appointmentDate, appointmentTime });
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
    console.log('Randevu başarıyla oluşturuldu:', appointment._id);
    
    try {
      await sendAppointmentEmail(appointment, 'created');
      console.log('Randevu e-postası gönderildi');
    } catch (emailError) {
      console.error('E-posta gönderme hatası:', emailError);
      // E-posta hatası randevu oluşturmayı etkilemeyecek
    }

    res.status(201).json({
      success: true,
      data: appointment,
      message: 'Randevunuz başarıyla oluşturuldu. Lütfen e-postanızı kontrol edin.'
    });
  } catch (error) {
    console.error('Randevu oluşturma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Randevu oluşturulurken bir hata oluştu.',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// Belirli bir tarihteki dolu saatleri döndür
router.get('/occupied', async (req, res) => {
  try {
    const { date } = req.query;
    console.log('Dolu saatler isteği alındı, tarih:', date);
    
    if (!date) {
      console.error('Tarih parametresi eksik');
      return res.status(400).json({ success: false, message: 'Tarih belirtilmeli' });
    }
    
    console.log('MongoDB sorgusu yapılıyor, date:', date);
    
    // Sadece iptal edilmemiş randevular
    const appointments = await Appointment.find({
      appointmentDate: date,  // String olarak tarih karşılaştırması
      status: { $ne: 'cancelled' }
    });
    
    console.log(`${appointments.length} adet randevu bulundu.`);
    
    // Bloke edilmiş saatleri getir
    const blocked = await BlockedSlot.find({ date });
    console.log(`${blocked.length} adet bloke edilmiş saat bulundu.`);
    
    const occupiedTimes = [
      ...appointments.map(a => a.appointmentTime),
      ...blocked.map(b => b.time)
    ];
    
    console.log('Dolu saatler:', occupiedTimes);
    
    res.json({ success: true, times: occupiedTimes });
  } catch (error) {
    console.error('Dolu saatleri getirme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
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
    console.log('Kod ile randevu sorgulanıyor:', req.params.code);
    
    if (!req.params.code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Kod parametresi gerekli' 
      });
    }
    
    const appointment = await Appointment.findOne({ code: req.params.code });
    console.log('Randevu bulundu mu?', appointment ? 'Evet' : 'Hayır');
    
    if (!appointment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Randevu bulunamadı' 
      });
    }
    
    console.log('Randevu bulundu:', appointment._id);
    res.json({ 
      success: true, 
      data: appointment 
    });
  } catch (error) {
    console.error('Randevu sorgulama hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Randevu sorgulanırken bir hata oluştu.',
      error: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

module.exports = router; 