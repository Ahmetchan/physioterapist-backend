const Appointment = require('../models/Appointment');
const crypto = require('crypto');
const { sendAppointmentEmail } = require('../utils/emailService');

// Generate a unique code
async function generateUniqueCode() {
  let code;
  let exists = true;
  while (exists) {
    code = crypto.randomBytes(4).toString('hex').toUpperCase();
    exists = await Appointment.findOne({ code });
  }
  return code;
}

// Create new appointment
exports.createAppointment = async (req, res) => {
  try {
    const { patientName, patientEmail, patientPhone, appointmentDate, appointmentTime, notes } = req.body;

    // Generate unique code
    const code = await generateUniqueCode();

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

    // Send confirmation email
    await sendAppointmentEmail(appointment);

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
};

// Get appointment by code
exports.getAppointmentByCode = async (req, res) => {
  try {
    const appointment = await Appointment.findOne({ code: req.params.code });
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Randevu bulunamadı.'
      });
    }

    res.status(200).json({
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
};

// Get all appointments (admin)
exports.getAllAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ appointmentDate: 1 });
    res.status(200).json({
      success: true,
      data: appointments
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Randevular getirilirken bir hata oluştu.',
      error: error.message
    });
  }
};

// Update appointment (admin)
exports.updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Randevu bulunamadı.'
      });
    }

    // Send update email
    await sendAppointmentEmail(appointment, 'update');

    res.status(200).json({
      success: true,
      data: appointment,
      message: 'Randevu başarıyla güncellendi.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Randevu güncellenirken bir hata oluştu.',
      error: error.message
    });
  }
};

// Delete appointment (admin)
exports.deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Randevu bulunamadı.'
      });
    }

    // Send cancellation email
    await sendAppointmentEmail(appointment, 'cancellation');

    await appointment.remove();

    res.status(200).json({
      success: true,
      message: 'Randevu başarıyla iptal edildi.'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Randevu iptal edilirken bir hata oluştu.',
      error: error.message
    });
  }
}; 