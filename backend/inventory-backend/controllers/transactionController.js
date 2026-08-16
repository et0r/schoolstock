const db = require('../config/db');

exports.getAllTransactions = async (req, res) => {
    try {
        const [transactions] = await db.query(
            'SELECT * FROM stock_transactions ORDER BY timestamp DESC LIMIT 100'
        );
        res.status(200).json({ transactions });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.recordTransaction = async (req, res) => {
    const { item_id, type, quantity_changed, notes } = req.body;
    
    if (!item_id || !type || quantity_changed === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Insert transaction
        await connection.query(
            'INSERT INTO stock_transactions (item_id, type, quantity_changed, notes, user_id) VALUES (?, ?, ?, ?, ?)',
            [item_id, type, quantity_changed, notes, req.user.userId]
        );

        // 2. Update item quantity
        // If type is 'in', add. If 'out', subtract.
        const modifier = type === 'in' ? '+' : '-';
        await connection.query(
            `UPDATE items SET quantity = quantity ${modifier} ? WHERE id = ?`,
            [quantity_changed, item_id]
        );

        await connection.commit();
        res.status(201).json({ message: 'Transaction recorded successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error recording transaction:', error);
        res.status(500).json({ error: 'Failed to record transaction' });
    } finally {
        if (connection) connection.release();
    }
};
