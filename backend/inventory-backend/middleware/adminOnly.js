module.exports = (req, res, next) => {
    // The 'authenticate' middleware runs before this and attaches the user data to req.user.
    // We just need to check if the role is 'admin'.
    
    if (req.user && req.user.role === 'admin') {
        next(); // User is an admin, let them proceed to the controller
    } else {
        res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
};