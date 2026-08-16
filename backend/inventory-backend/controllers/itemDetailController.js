const db = require('../config/db');

/**
 * GET /api/items/:id
 * Auth required — returns a single item's full details including
 * its category name, department name, and supplier name (if any),
 * plus the last 20 stock transactions for that item.
 */
exports.getItemById = async (req, res) => {
    try {
        const { id } = req.params;

        // Full item with joined category and department names
        const [rows] = await db.execute(`
            SELECT
                i.id,
                i.name,
                i.sku,
                i.quantity,
                i.\`condition\`,
                i.unit,
                i.image_url,
                i.created_at,
                i.category_id,
                i.department_id,
                c.name  AS category,
                d.name  AS department
            FROM items i
            LEFT JOIN categories  c ON c.id = i.category_id
            LEFT JOIN departments d ON d.id = i.department_id
            WHERE i.id = ?
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Item not found.' });
        }

        const item = rows[0];

        // Transaction history for this item — last 20 entries
        const [transactions] = await db.execute(`
            SELECT
                st.id,
                st.type,
                st.quantity_changed,
                st.timestamp,
                st.notes,
                u.username AS performed_by
            FROM stock_transactions st
            LEFT JOIN users u ON u.id = st.user_id
            WHERE st.item_id = ?
            ORDER BY st.timestamp DESC
            LIMIT 20
        `, [id]);

        res.status(200).json({ item, transactions });
    } catch (error) {
        console.error('Error fetching item detail:', error);
        res.status(500).json({ error: 'Failed to fetch item detail.' });
    }
};

/**
 * GET /api/categories
 * Public (auth required) — returns all categories for dropdowns.
 */
exports.getCategories = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, name FROM categories ORDER BY name ASC');
        res.status(200).json({ categories: rows });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
};

/**
 * GET /api/departments
 * Public (auth required) — returns all departments for dropdowns.
 */
exports.getDepartments = async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, name FROM departments ORDER BY name ASC');
        res.status(200).json({ departments: rows });
    } catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: 'Failed to fetch departments.' });
    }
};
