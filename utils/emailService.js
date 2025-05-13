const nodemailer = require('nodemailer');

const isProduction = process.env.NODE_ENV === 'production';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  secure: false,
  tls: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  }
});

const sendAppointmentEmail = async (appointment, type) => {
  let subject, text;

  // Tarih ve saat bilgilerini doğru formatta hazırla
  let formattedDate = appointment.appointmentDate;
  if (appointment.appointmentDate && appointment.appointmentDate.split) {
    formattedDate = appointment.appointmentDate.split('-').reverse().join('.');
  }

  switch (type) {
    case 'created':
      subject = 'Randevu Oluşturuldu';
      text = `
        Sayın ${appointment.patientName},
        
        Randevunuz başarıyla oluşturuldu.
        
        Randevu Detayları:
        Tarih: ${formattedDate}
        Saat: ${appointment.appointmentTime}
        
        Randevunuzu sorgulamak için kodunuz: ${appointment.code}
        
        İyi günler dileriz.
        Fizyoterapist Eren Uyar
      `;
      break;
    case 'updated':
      subject = 'Randevu Güncellendi';
      text = `
        Sayın ${appointment.patientName},
        
        Randevunuz güncellendi.
        
        Yeni Randevu Detayları:
        Tarih: ${formattedDate}
        Saat: ${appointment.appointmentTime}
        
        Randevunuzu sorgulamak için kodunuz: ${appointment.code}
        
        İyi günler dileriz.
        Fizyoterapist Eren Uyar
      `;
      break;
    case 'cancelled':
      subject = 'Randevu İptal Edildi';
      text = `
        Sayın ${appointment.patientName},
        
        Randevunuz iptal edildi.
        
        İptal Edilen Randevu Detayları:
        Tarih: ${formattedDate}
        Saat: ${appointment.appointmentTime}
        
        Yeni randevu oluşturmak için web sitemizi ziyaret edebilirsiniz.
        
        İyi günler dileriz.
        Fizyoterapist Eren Uyar
      `;
      break;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: appointment.patientEmail,
      subject,
      text
    });
    console.log('E-posta başarıyla gönderildi');
  } catch (error) {
    console.error('E-posta gönderimi başarısız:', error);
    throw error;
  }
};

module.exports = { sendAppointmentEmail }; 