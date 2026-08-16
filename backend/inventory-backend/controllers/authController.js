const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 1. User Registration
exports.register = async (req, res) => {
    try {
        const { name, email, username, password, role } = req.body;

        // Basic validation
        if (!name || !email || !username || !password) {
            return res.status(400).json({ error: 'Please fill in all required fields.' });
        }

        // Hash the password
        // 10 salt rounds is the current industry standard balance between security and performance
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Default to 'staff' if no role is provided or if an invalid role is sent
        const userRole = role === 'admin' ? 'admin' : 'staff';

        // Insert into the database
        const [result] = await db.execute(
            'INSERT INTO users (name, email, username, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [name, email, username, hashedPassword, userRole]
        );

        res.status(201).json({ 
            message: 'User registered successfully.',
            userId: result.insertId 
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle MySQL unique constraint violation (duplicate username)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username already exists.' });
        }
        
        res.status(500).json({ error: 'An error occurred during registration.' });
    }
};

// 2. User Login
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Fetch user from the database
        const [users] = await db.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        // If no user is found, return generic error (prevents username enumeration)
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const user = users[0];

        // Compare the submitted password with the stored hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Create the JWT Payload (Data you want encoded inside the token)
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role
        };

        // Sign the token using your secret key
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: '12h' // Token will expire in 12 hours
        });

        // Send token and user data back to the client
        res.status(200).json({
            message: 'Login successful',
            token,
            user: payload
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An error occurred during login.' });
    }
};