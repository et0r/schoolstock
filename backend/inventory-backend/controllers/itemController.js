const db = require('../config/db');
const s3Client = require('../config/s3');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

exports.createItem = async (req, res) => {
    try {
        const { name, sku, category_id, department_id, quantity, condition, unit } = req.body;

        // These are NOT NULL foreign keys in the database — required on create
        if (!name || !category_id || !department_id || !condition || !unit) {
            return res.status(400).json({
                error: 'name, category_id, department_id, condition, and unit are required.'
            });
        }

        let imageUrl = null;

        // If an image was uploaded, send it to S3
        if (req.file) {
            const fileExtension = req.file.originalname.split('.').pop();
            const fileName = `inventory/${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExtension}`;

            const uploadParams = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
            };

            await s3Client.send(new PutObjectCommand(uploadParams));
            imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
        }

        // Insert into MySQL — now includes category_id and department_id,
        // both NOT NULL foreign keys in the real schema
        const [result] = await db.execute(
            'INSERT INTO items (name, sku, category_id, department_id, quantity, `condition`, unit, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, sku || null, category_id, department_id, quantity || 0, condition, unit, imageUrl]
        );

        res.status(201).json({ message: 'Item created successfully', itemId: result.insertId, imageUrl });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'SKU already exists.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'category_id or department_id does not exist.' });
        }
        res.status(500).json({ error: 'Failed to create item' });
    }
};

exports.getAllItems = async (req, res) => {
    try {
        // Fetch all items, ordering by the newest first
        const [items] = await db.execute('SELECT * FROM items ORDER BY created_at DESC');

        res.status(200).json({
            count: items.length,
            items: items
        });
    } catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({ error: 'Failed to fetch inventory items' });
    }
};

// Update an Item (name, sku, category, department, quantity, condition, unit)
exports.updateItem = async (req, res) => {
    try {
        const { id } = req.params; // Get the ID from the URL
        const { name, sku, category_id, department_id, quantity, condition, unit } = req.body;

        if (!name || !category_id || !department_id || !condition || !unit) {
            return res.status(400).json({
                error: 'name, category_id, department_id, condition, and unit are required.'
            });
        }

        const [result] = await db.execute(
            'UPDATE items SET name = ?, sku = ?, category_id = ?, department_id = ?, quantity = ?, `condition` = ?, unit = ? WHERE id = ?',
            [name, sku || null, category_id, department_id, quantity || 0, condition, unit, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.status(200).json({ message: 'Item updated successfully' });
    } catch (error) {
        console.error('Error updating item:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'SKU already exists on another item.' });
        }
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(400).json({ error: 'category_id or department_id does not exist.' });
        }
        res.status(500).json({ error: 'Failed to update item' });
    }
};

// Delete an Item
exports.deleteItem = async (req, res) => {
    try {
        const { id } = req.params;

        // Optional best practice: delete the image from S3 before deleting the
        // database record — left out here to keep this simple for now.

        const [result] = await db.execute('DELETE FROM items WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};