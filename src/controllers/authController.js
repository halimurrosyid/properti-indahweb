const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

exports.getLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('pages/login', {
    title: 'Masuk Ke Akun Agen',
    error: null
  });
};

exports.postLogin = async (req, res, next) => {
  try {
    const { identity, password } = req.body;

    if (!identity || !password) {
      return res.render('pages/login', {
        title: 'Masuk Ke Akun Agen',
        error: 'Lengkapi identitas email/WhatsApp dan kata sandi Anda.'
      });
    }

    // Search user by email or whatsapp phone number
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identity },
          { whatsapp: identity }
        ]
      }
    });

    if (!user) {
      return res.render('pages/login', {
        title: 'Masuk Ke Akun Agen',
        error: 'Email/WhatsApp atau Kata Sandi salah.'
      });
    }

    // Compare encrypted passwords
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.render('pages/login', {
        title: 'Masuk Ke Akun Agen',
        error: 'Email/WhatsApp atau Kata Sandi salah.'
      });
    }

    // Set User Session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      whatsapp: user.whatsapp,
      role: user.role
    };

    res.redirect('/');
  } catch (error) {
    next(error);
  }
};

exports.getRegister = (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('pages/register', {
    title: 'Daftar Akun Baru',
    error: null
  });
};

exports.postRegister = async (req, res, next) => {
  try {
    const { name, whatsapp, email, password } = req.body;

    if (!name || !whatsapp || !password) {
      return res.render('pages/register', {
        title: 'Daftar Akun Baru',
        error: 'Lengkapi seluruh data pendaftaran utama (Nama, WhatsApp, Kata Sandi).'
      });
    }

    // Build user existence check clauses
    const searchClauses = [{ whatsapp }];
    if (email && email.trim() !== '') {
      searchClauses.push({ email: email.trim() });
    }

    // Validate if WhatsApp number or Email already registered
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: searchClauses
      }
    });

    if (existingUser) {
      return res.render('pages/register', {
        title: 'Daftar Akun Baru',
        error: 'Nomor WhatsApp atau Email sudah terdaftar. Silakan login atau gunakan data lain.'
      });
    }

    if (password.length < 6) {
      return res.render('pages/register', {
        title: 'Daftar Akun Baru',
        error: 'Kata sandi minimal berisi 6 karakter.'
      });
    }

    // Create User account
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        whatsapp,
        email: (email && email.trim() !== '') ? email.trim() : null,
        password: hashedPassword,
        role: 'user'
      }
    });

    // Auto-login after successful registration
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      whatsapp: user.whatsapp,
      role: user.role
    };

    res.redirect('/');
  } catch (error) {
    next(error);
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.redirect('/');
  });
};
