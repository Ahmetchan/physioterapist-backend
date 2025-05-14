const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Settings = require('../models/Settings');
const { sendAppointmentEmail } = require('../utils/emailService');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { authenticateAdmin } = require('../middleware/auth');
const BlockedSlot = require('../models/BlockedSlot');
const mongoose = require('mongoose');

// Admin girişi
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Geçersiz şifre' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// *** BLOCKED SLOTS ROUTES ***
// Belirli bir gün ve saati engelle
router.post('/blocked-slots', authenticateAdmin, async (req, res) => {
  try {
    const { date, time, reason } = req.body;
    
    if (!date || !time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tarih ve saat zorunludur' 
      });
    }

    const exists = await BlockedSlot.findOne({ date, time });
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        message: 'Bu saat zaten engellenmiş.' 
      });
    }

    const slot = new BlockedSlot({ date, time, reason });
    await slot.save();
    
    res.json({ 
      success: true, 
      slot 
    });
  } catch (error) {
    console.error('Slot ekleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Saat engellenirken bir hata oluştu' 
    });
  }
});

// Belirli bir günün engellenmiş saatlerini getir
router.get('/blocked-slots', authenticateAdmin, async (req, res) => {
  try {
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tarih parametresi gerekli' 
      });
    }

    const slots = await BlockedSlot.find({ date });
    res.json({ 
      success: true, 
      slots 
    });
  } catch (error) {
    console.error('Slot listeleme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Engellenmiş saatler alınırken bir hata oluştu' 
    });
  }
});

// Engellenmiş bir saati sil
router.delete('/blocked-slots/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const slot = await BlockedSlot.findByIdAndDelete(id);
    if (!slot) {
      return res.status(404).json({ 
        success: false, 
        message: 'Engellenmiş saat bulunamadı' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Engellenmiş saat başarıyla silindi' 
    });
  } catch (error) {
    console.error('Slot silme hatası:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Engellenmiş saat silinirken bir hata oluştu' 
    });
  }
});

// Tüm engellenmiş saatleri getir
router.get('/blocked-slots/all', authenticateAdmin, async (req, res) => {
  try {
    const slots = await BlockedSlot.find()
      .sort({ date: 1, time: 1 });
    
    res.json({ success: true, slots });
  } catch (error) {
    console.error('Error fetching all blocked slots:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Engellenmiş saatler getirilirken bir hata oluştu' 
    });
  }
});

// Tüm randevuları getir
router.get('/appointments', authenticateAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ appointmentDate: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Randevu güncelle
router.put('/appointments/:id', authenticateAdmin, async (req, res) => {
  try {
    console.log('GÜNCELLEME İSTEĞİ BODY:', req.body);
    
    // Tarih ve saat bilgilerini birleştir
    const { appointmentDate, appointmentTime, ...rest } = req.body;
    const dateString = `${appointmentDate}T${appointmentTime}`;
    const dateObj = new Date(dateString);
    
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ message: 'Geçersiz tarih veya saat formatı' });
    }

    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        ...rest,
        appointmentDate: dateObj,
        appointmentTime
      },
      { new: true }
    );
    
    console.log('GÜNCELLENEN APPOINTMENT:', appointment);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }
    await sendAppointmentEmail(appointment, 'updated');
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Randevuyu veritabanından tamamen sil
router.delete('/appointments/:id/permanent', authenticateAdmin, async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndDelete(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }
    res.json({ message: 'Randevu kalıcı olarak silindi' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Randevu iptal et
router.delete('/appointments/:id', authenticateAdmin, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ message: 'Randevu bulunamadı' });
    }
    appointment.status = 'cancelled';
    await appointment.save();
    await sendAppointmentEmail(appointment, 'cancelled');
    res.json({ message: 'Randevu başarıyla iptal edildi' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Ayarları getir (herkese açık)
router.get('/settings', async (req, res) => {
  try {
    console.log('Settings endpoint çağrıldı');
    // MongoDB bağlantı durumunu kontrol et
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB bağlantısı aktif değil. ReadyState:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: 'Veritabanı bağlantısı kurulamadı',
        mongoStatus: mongoose.connection.readyState
      });
    }

    console.log('MongoDB bağlantısı aktif, Settings aranıyor...');
    let settings = await Settings.findOne();
    
    console.log('Settings bulundu mu?', settings ? 'Evet' : 'Hayır');
    
    if (!settings) {
      console.log('Settings bulunamadı, yeni oluşturuluyor');
      settings = new Settings({
        siteTitle: 'Fizyoterapist Randevu Sistemi',
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        fontFamily: 'Arial, sans-serif',
        aboutContent: '<p>Hakkımda sayfası içeriği burada görüntülenecek.</p>',
        backgroundImage: ''
      });
      await settings.save();
      console.log('Yeni Settings kaydedildi');
    }
    
    console.log('Settings gönderiliyor:', settings);
    return res.json(settings);
  } catch (error) {
    console.error('Settings hatası:', error);
    return res.status(500).json({ 
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack 
    });
  }
});

// Ayarları güncelle
router.put('/settings', authenticateAdmin, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    Object.assign(settings, req.body);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Geçmiş randevuları ara
router.get('/appointments/search', authenticateAdmin, async (req, res) => {
  try {
    const { patientName, startDate, endDate, status } = req.query;
    const query = {};

    if (patientName) {
      query.patientName = { $regex: patientName, $options: 'i' };
    }

    if (startDate && endDate) {
      query.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (status) {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .sort({ appointmentDate: -1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Randevu istatistiklerini getir
router.get('/appointments/stats', authenticateAdmin, async (req, res) => {
  try {
    const { year, month } = req.query;
    const matchStage = {};

    if (year) {
      matchStage.$expr = {
        $eq: [{ $year: '$appointmentDate' }, parseInt(year)]
      };
    }

    if (month) {
      matchStage.$expr = {
        $and: [
          { $eq: [{ $year: '$appointmentDate' }, parseInt(year)] },
          { $eq: [{ $month: '$appointmentDate' }, parseInt(month)] }
        ]
      };
    }

    const stats = await Appointment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$appointmentDate' },
            month: { $month: '$appointmentDate' },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month'
          },
          stats: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          total: { $sum: '$count' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Excel dışa aktarma
router.get('/appointments/export/excel', authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    
    if (startDate && endDate) {
      query.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const appointments = await Appointment.find(query).sort({ appointmentDate: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Randevular');

    worksheet.columns = [
      { header: 'Hasta Adı', key: 'patientName', width: 20 },
      { header: 'E-posta', key: 'email', width: 30 },
      { header: 'Telefon', key: 'phone', width: 15 },
      { header: 'Tarih', key: 'date', width: 15 },
      { header: 'Saat', key: 'time', width: 10 },
      { header: 'Durum', key: 'status', width: 15 },
      { header: 'Not', key: 'notes', width: 40 }
    ];

    appointments.forEach(appointment => {
      worksheet.addRow({
        patientName: appointment.patientName,
        email: appointment.email,
        phone: appointment.phone,
        date: appointment.appointmentDate.toLocaleDateString('tr-TR'),
        time: appointment.appointmentTime,
        status: getStatusText(appointment.status),
        notes: appointment.notes || ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=randevular.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Excel dışa aktarma sırasında bir hata oluştu' });
  }
});

// PDF dışa aktarma
router.get('/appointments/export/pdf', authenticateAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    
    if (startDate && endDate) {
      query.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const appointments = await Appointment.find(query).sort({ appointmentDate: 1 });

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=randevular.pdf');

    doc.pipe(res);

    doc.fontSize(20).text('Randevu Listesi', { align: 'center' });
    doc.moveDown();

    appointments.forEach((appointment, index) => {
      doc.fontSize(12).text(`${index + 1}. Randevu`);
      doc.fontSize(10).text(`Hasta: ${appointment.patientName}`);
      doc.text(`E-posta: ${appointment.email}`);
      doc.text(`Telefon: ${appointment.phone}`);
      doc.text(`Tarih: ${appointment.appointmentDate.toLocaleDateString('tr-TR')}`);
      doc.text(`Saat: ${appointment.appointmentTime}`);
      doc.text(`Durum: ${getStatusText(appointment.status)}`);
      if (appointment.notes) {
        doc.text(`Not: ${appointment.notes}`);
      }
      doc.moveDown();
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'PDF dışa aktarma sırasında bir hata oluştu' });
  }
});

function getStatusText(status) {
  switch (status) {
    case 'pending':
      return 'Bekliyor';
    case 'confirmed':
      return 'Onaylandı';
    case 'cancelled':
      return 'İptal Edildi';
    default:
      return status;
  }
}

module.exports = router; 