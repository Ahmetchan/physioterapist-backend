const express = require('express');
const router = express.Router();
const { getAvailableTimeSlots, isValidAppointmentTime } = require('../services/appointmentService');

// Müsait saatleri getiren endpoint
router.get('/available-times/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const availableSlots = await getAvailableTimeSlots(date);
        res.json({ availableSlots });
    } catch (error) {
        console.error('Error getting available times:', error);
        res.status(500).json({ error: 'Müsait saatler getirilirken bir hata oluştu.' });
    }
});

// Randevu oluşturma endpoint'i
router.post('/appointments', async (req, res) => {
    try {
        const { date, time, name, email, phone } = req.body;

        // Randevu zamanının geçerli olup olmadığını kontrol et
        if (!isValidAppointmentTime(date, time)) {
            console.log('Invalid appointment time requested:', { date, time });
            return res.status(400).json({
                error: 'Geçersiz randevu zamanı. Randevu saati şu andan en az 1 saat sonra olmalıdır.'
            });
        }

        // Seçilen saatin müsait olup olmadığını kontrol et
        const availableSlots = await getAvailableTimeSlots(date);
        if (!availableSlots.includes(time)) {
            console.log('Requested time slot is not available:', { date, time, availableSlots });
            return res.status(400).json({
                error: 'Seçilen saat müsait değil. Lütfen başka bir saat seçin.'
            });
        }

        // TODO: Randevu oluşturma işlemleri...
        
        res.status(201).json({
            message: 'Randevu başarıyla oluşturuldu.',
            appointmentDetails: { date, time, name, email, phone }
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ error: 'Randevu oluşturulurken bir hata oluştu.' });
    }
});

module.exports = router; 