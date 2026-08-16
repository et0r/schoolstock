const db = require('../config/db');

/**
 * GET /api/suppliers
 * Returns all suppliers ordered by name.
 */
exports.getAllSuppliers = async (req, res) => {
    try {
        const [suppliers] = await db.execute(
            'SELECT id, name, contact, email, phone, address, created_at FROM suppliers ORDER BY name ASC'
        );
        res.status(200).json({ count: suppliers.length, suppliers });
    } catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Failed to fetch suppliers.' });
    }
};

/**
 * GET /api/suppliers/:id
 * Returns a single supplier with a list of items they supply.
 */
exports.getSupplierById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.execute(
            'SELECT id, name, contact, email, phone, address, created_at FROM suppliers WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Supplier not found.' });
        }

        // Items linked to this supplier
        const [items] = await db.execute(`
            SELECT i.id, i.name, i.sku, i.quantity, i.\`condition\`, i.unit,
                   c.name AS category, d.name AS department
            FROM items i
            LEFT JOIN categories  c ON c.id = i.category_id
            LEFT JOIN departments d ON d.id = i.department_id
            WHERE i.supplier_id = ?
            ORDER BY i.name ASC
        `, [id]);

        res.status(200).json({ supplier: rows[0], items });
    } catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ error: 'Failed to fetch supplier.' });
    }
};

/**
 * POST /api/suppliers
 * Create a new supplier.
 * Body: { name, contact?, email?, phone?, address? }
 */
exports.createSupplier = async (req, res) => {
    try {
        const { name, contact, email, phone, address } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Supplier name is required.' });
        }

        const [result] = await db.execute(
            'INSERT INTO suppliers (name, contact, email, phone, address) VALUES (?, ?, ?, ?, ?)',
            [name.trim(), contact || null, email || null, phone || null, address || null]
        );

        res.status(201).json({
            message: 'Supplier created successfully.',
            supplierId: result.insertId,
        });
    } catch (error) {
        console.error('Error creating supplier:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'A supplier with that name already exists.' });
        }
        res.status(500).json({ error: 'Failed to create supplier.' });
    }
};

/**
 * PUT /api/suppliers/:id
 * Update an existing supplier.
 * Body: { name, contact?, email?, phone?, address? }
 */
exports.updateSupplier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact, email, phone, address } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Supplier name is required.' });
        }

        const [result] = await db.execute(
            'UPDATE suppliers SET name = ?, contact = ?, email = ?, phone = ?, address = ? WHERE id = ?',
            [name.trim(), contact || null, email || null, phone || null, address || null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Supplier not found.' });
        }

        res.status(200).json({ message: 'Supplier updated successfully.' });
    } catch (error) {
        console.error('Error updating supplier:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'A supplier with that name already exists.' });
        }
        res.status(500).json({ error: 'Failed to update supplier.' });
    }
};

/**
 * DELETE /api/suppliers/:id
 * Admin only — delete a supplier.
 * The FK on items is ON DELETE SET NULL so linked items are not deleted.
 */
exports.deleteSupplier = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await db.execute('DELETE FROM suppliers WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Supplier not found.' });
        }

        res.status(200).json({ message: 'Supplier deleted. Linked items now have no supplier.' });
    } catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Failed to delete supplier.' });
    }
};
