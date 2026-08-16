const db = require('../config/db');

/**
 * GET /api/users
 * Admin only — list all users (id, username, role, created_at).
 * Never returns password_hash.
 */
exports.getAllUsers = async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, name, email, username, role, created_at FROM users ORDER BY id ASC'
        );
        res.status(200).json({ count: users.length, users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
};

/**
 * PATCH /api/users/:id/role
 * Admin only — change a user's role.
 * Body: { role: 'admin' | 'staff' | 'clerk' }
 * An admin cannot change their own role (prevents lockout).
 */
exports.updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        const allowed = ['admin', 'staff', 'clerk'];
        if (!allowed.includes(role)) {
            return res.status(400).json({ error: `role must be one of: ${allowed.join(', ')}` });
        }

        // Prevent an admin from demoting themselves
        if (Number(id) === req.user.userId) {
            return res.status(400).json({ error: 'You cannot change your own role.' });
        }

        const [result] = await db.execute(
            'UPDATE users SET role = ? WHERE id = ?',
            [role, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ message: `User role updated to "${role}".` });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update user role.' });
    }
};

/**
 * DELETE /api/users/:id
 * Admin only — delete a user account.
 * Cannot delete yourself.
 */
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (Number(id) === req.user.userId) {
            return res.status(400).json({ error: 'You cannot delete your own account.' });
        }

        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
};
