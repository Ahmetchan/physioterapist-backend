const mongoose = require('mongoose');

const BlockedSlotSchema = new mongoose.Schema({
  date: { type: String, required: true }, // "YYYY-MM-DD"
  time: { type: String, required: true }, // "HH:mm"
  reason: { type: String } // opsiyonel, admin açıklaması
});

module.exports = mongoose.model('BlockedSlot', BlockedSlotSchema); 