const moment = require('moment');
const Appointment = require('../models/Appointment');
const Settings = require('../models/Settings');
const { sendAppointmentConfirmation } = require('../utils/emailService');

class AppointmentService {
    // Randevu zamanının geçerli olup olmadığını kontrol et
    validateAppointmentTime(dateTime) {
        const now = moment();
        const appointmentTime = moment(dateTime);
        
        // Geçmiş zaman kontrolü
        if (appointmentTime.isBefore(now)) {
            throw new Error('Geçmiş bir zaman için randevu oluşturamazsınız.');
        }

        // En az 1 saat sonrası için randevu kontrolü
        if (appointmentTime.diff(now, 'hours') < 1) {
            throw new Error('Randevu en az 1 saat sonrası için olmalıdır.');
        }

        return true;
    }

    // Müsait saatleri getir
    async getAvailableTimeSlots(date) {
        try {
            // Ayarlardan çalışma saatlerini al
            const settings = await Settings.findOne();
            if (!settings || !settings.workingHours) {
                throw new Error('Çalışma saatleri ayarlanmamış');
            }

            const { workingHours } = settings;
            const selectedDate = moment(date).startOf('day');
            const now = moment();
            const availableSlots = [];

            // Seçilen gün için tüm zaman slotlarını oluştur
            for (let hour = workingHours.start; hour < workingHours.end; hour++) {
                for (let minute of [0, 30]) { // 30'ar dakikalık slotlar
                    const slotTime = moment(selectedDate)
                        .hour(hour)
                        .minute(minute)
                        .second(0);

                    // Geçmiş zaman veya 1 saatten yakın slotları filtrele
                    if (slotTime.isBefore(now) || slotTime.diff(now, 'hours') < 1) {
                        continue;
                    }

                    // Mevcut randevuları kontrol et
                    const existingAppointment = await Appointment.findOne({
                        date: {
                            $gte: slotTime.toDate(),
                            $lt: moment(slotTime).add(30, 'minutes').toDate()
                        }
                    });

                    if (!existingAppointment) {
                        availableSlots.push(slotTime.format('HH:mm'));
                    }
                }
            }

            return availableSlots;
        } catch (error) {
            console.error('Müsait saatler getirilirken hata:', error);
            throw error;
        }
    }

    // Yeni randevu oluştur
    async createAppointment(appointmentData) {
        try {
            const { date, time, ...otherData } = appointmentData;
            
            // Tarih ve saati birleştir
            const appointmentDateTime = moment(`${date} ${time}`, 'YYYY-MM-DD HH:mm').toDate();
            
            // Zaman kontrolü
            this.validateAppointmentTime(appointmentDateTime);

            // Çakışma kontrolü
            const existingAppointment = await Appointment.findOne({
                date: {
                    $gte: appointmentDateTime,
                    $lt: moment(appointmentDateTime).add(30, 'minutes').toDate()
                }
            });

            if (existingAppointment) {
                throw new Error('Bu zaman dilimi için başka bir randevu mevcut.');
            }

            // Randevuyu oluştur
            const appointment = new Appointment({
                ...otherData,
                date: appointmentDateTime,
                token: Math.random().toString(36).substring(2, 15)
            });

            await appointment.save();

            // E-posta gönder
            await sendAppointmentConfirmation(appointment);

            return appointment;
        } catch (error) {
            console.error('Randevu oluşturulurken hata:', error);
            throw error;
        }
    }

    // Token ile randevu sorgula
    async getAppointmentByToken(token) {
        try {
            const appointment = await Appointment.findOne({ token });
            if (!appointment) {
                throw new Error('Randevu bulunamadı');
            }
            return appointment;
        } catch (error) {
            console.error('Randevu sorgulanırken hata:', error);
            throw error;
        }
    }

    // Tüm randevuları getir (admin için)
    async getAllAppointments(filters = {}) {
        try {
            const query = {};
            
            if (filters.startDate) {
                query.date = { $gte: new Date(filters.startDate) };
            }
            if (filters.endDate) {
                query.date = { ...query.date, $lte: new Date(filters.endDate) };
            }
            if (filters.status) {
                query.status = filters.status;
            }

            return await Appointment.find(query).sort({ date: 1 });
        } catch (error) {
            console.error('Randevular getirilirken hata:', error);
            throw error;
        }
    }

    // Randevu güncelle
    async updateAppointment(id, updateData) {
        try {
            const appointment = await Appointment.findById(id);
            if (!appointment) {
                throw new Error('Randevu bulunamadı');
            }

            if (updateData.date && updateData.time) {
                const newDateTime = moment(`${updateData.date} ${updateData.time}`, 'YYYY-MM-DD HH:mm').toDate();
                this.validateAppointmentTime(newDateTime);
                updateData.date = newDateTime;
                delete updateData.time;
            }

            Object.assign(appointment, updateData);
            await appointment.save();

            // E-posta gönder
            await sendAppointmentConfirmation(appointment, 'update');

            return appointment;
        } catch (error) {
            console.error('Randevu güncellenirken hata:', error);
            throw error;
        }
    }

    // Randevu iptal et
    async cancelAppointment(id) {
        try {
            const appointment = await Appointment.findById(id);
            if (!appointment) {
                throw new Error('Randevu bulunamadı');
            }

            appointment.status = 'cancelled';
            await appointment.save();

            // İptal e-postası gönder
            await sendAppointmentConfirmation(appointment, 'cancel');

            return appointment;
        } catch (error) {
            console.error('Randevu iptal edilirken hata:', error);
            throw error;
        }
    }
}

module.exports = new AppointmentService(); 