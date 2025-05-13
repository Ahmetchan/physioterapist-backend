module.exports.authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Yetkilendirme başlığı eksik veya geçersiz' });
    }

    const token = authHeader.split(' ')[1];
    
    if (token !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ message: 'Geçersiz yetkilendirme' });
    }

    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Yetkilendirme hatası' });
  }
};
