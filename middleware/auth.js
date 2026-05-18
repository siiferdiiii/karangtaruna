/**
 * Middleware: Cek apakah user sudah login sebagai admin
 */
function isAuthenticated(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    req.flash('error', 'Silakan login terlebih dahulu untuk mengakses halaman admin.');
    res.redirect('/admin/login');
}

/**
 * Middleware: Jika sudah login, redirect dari login page ke dashboard
 */
function isGuest(req, res, next) {
    if (req.session && req.session.isAdmin) {
        return res.redirect('/admin/dashboard');
    }
    next();
}

module.exports = { isAuthenticated, isGuest };
