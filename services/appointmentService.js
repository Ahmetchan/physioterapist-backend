const moment = require('moment');
const Appointment = require('../models/Appointment');
const Settings = require('../models/Settings');
const { sendAppointmentConfirmation } = require('../utils/emailService');
const BlockedSlot = require('../models/BlockedSlot');

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
            console.log('Müsait saatler hesaplanıyor, tarih:', date);
            
            // Ayarlardan çalışma saatlerini al
            const settings = await Settings.findOne();
            if (!settings || !settings.workingHours) {
                console.error('Çalışma saatleri ayarları bulunamadı');
                throw new Error('Çalışma saatleri ayarlanmamış');
            }

            const dayOfWeek = moment(date).format('dddd').toLowerCase();
            console.log('Haftanın günü:', dayOfWeek);
            
            // O günün çalışma saatleri
            const daySettings = settings.workingHours[dayOfWeek];
            if (!daySettings || daySettings.start === '00:00' && daySettings.end === '00:00') {
                console.log('Bu gün için çalışma saati bulunmuyor');
                return [];
            }

            const [startHour, startMinute] = daySettings.start.split(':').map(Number);
            const [endHour, endMinute] = daySettings.end.split(':').map(Number);
            
            console.log('Çalışma saatleri:', daySettings.start, '-', daySettings.end);

            const selectedDate = moment(date, 'YYYY-MM-DD').startOf('day');
            const now = moment();
            const availableSlots = [];

            console.log('Seçilen tarih:', selectedDate.format('YYYY-MM-DD'));
            console.log('Şimdiki zaman:', now.format('YYYY-MM-DD HH:mm'));

            // Tüm açık saatleri ekle (09:00-17:00 arası 30 dakikalık slotlar)
            let currentSlot = moment(selectedDate).hour(startHour).minute(startMinute);
            const endTime = moment(selectedDate).hour(endHour).minute(endMinute);

            while (currentSlot < endTime) {
                availableSlots.push(currentSlot.format('HH:mm'));
                currentSlot = moment(currentSlot).add(30, 'minutes');
            }

            console.log('Potansiyel tüm müsait saatler:', availableSlots);

            // Dolu saatleri getir
            const occupiedQuery = {
                appointmentDate: date,
                status: { $ne: 'cancelled' }
            };
            
            console.log('Dolu saatler sorgusu:', JSON.stringify(occupiedQuery));
            
            const appointments = await Appointment.find(occupiedQuery);
            console.log(`${appointments.length} adet dolu randevu bulundu`);
            
            const blockedSlots = await BlockedSlot.find({ date });
            console.log(`${blockedSlots.length} adet bloke edilmiş saat bulundu`);

            // Dolu saatleri çıkar
            const occupiedTimes = [
                ...appointments.map(a => a.appointmentTime),
                ...blockedSlots.map(b => b.time)
            ];
            
            console.log('Dolu saatler:', occupiedTimes);

            // Geçmiş saatleri çıkar
            const availableTimesFiltered = availableSlots.filter(timeStr => {
                // Tarih ve saati birleştir
                const slotDateTime = moment(`${date} ${timeStr}`, 'YYYY-MM-DD HH:mm');
                
                // Dolu mu?
                const isOccupied = occupiedTimes.includes(timeStr);
                
                // Geçmiş zaman mı?
                const isPast = slotDateTime.isBefore(now);
                
                // Şu andan 1 saatten daha yakın mı?
                const isTooSoon = slotDateTime.diff(now, 'hours') < 1;
                
                return !isOccupied && !isPast && !isTooSoon;
            });

            console.log('Sonuç müsait saatler:', availableTimesFiltered);
            return availableTimesFiltered;
        } catch (error) {
            console.error('Müsait saatler hesaplanırken hata:', error);
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