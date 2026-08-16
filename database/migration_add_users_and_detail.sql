-- ============================================================
-- SchoolStock — DB Migration (MySQL 8.4 compatible)
-- Rewrites the MariaDB-only "ADD COLUMN IF NOT EXISTS" syntax
-- using stored procedures that check INFORMATION_SCHEMA first.
-- Safe to run multiple times — each block checks before altering.
-- ============================================================

USE `schoolstock`;

-- ── Helper procedure: add a column only if it doesn't exist ───────────────────
DROP PROCEDURE IF EXISTS _add_col;
DELIMITER //
CREATE PROCEDURE _add_col(
    IN p_table  VARCHAR(100),
    IN p_col    VARCHAR(100),
    IN p_def    TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND COLUMN_NAME  = p_col
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_col, '` ', p_def);
        PREPARE s FROM @ddl;
        EXECUTE s;
        DEALLOCATE PREPARE s;
        SELECT CONCAT('  ✓ Added column: ', p_table, '.', p_col) AS migration_log;
    ELSE
        SELECT CONCAT('  – Already exists (skipped): ', p_table, '.', p_col) AS migration_log;
    END IF;
END //
DELIMITER ;

-- ── Helper procedure: add a unique index only if it doesn't exist ─────────────
DROP PROCEDURE IF EXISTS _add_idx;
DELIMITER //
CREATE PROCEDURE _add_idx(
    IN p_table  VARCHAR(100),
    IN p_idx    VARCHAR(100),
    IN p_col    VARCHAR(100)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = p_table
          AND INDEX_NAME   = p_idx
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD UNIQUE INDEX `', p_idx, '` (`', p_col, '`)');
        PREPARE s FROM @ddl;
        EXECUTE s;
        DEALLOCATE PREPARE s;
        SELECT CONCAT('  ✓ Added index: ', p_idx) AS migration_log;
    ELSE
        SELECT CONCAT('  – Already exists (skipped): ', p_idx) AS migration_log;
    END IF;
END //
DELIMITER ;

-- ═══════════════════════════════════════════════════════════════
-- 1. users.username — needed for login and User Management page
-- ═══════════════════════════════════════════════════════════════
CALL _add_col('users', 'username', 'VARCHAR(100) NOT NULL DEFAULT "" AFTER `id`');
CALL _add_idx('users', 'idx_users_username', 'username');

-- Backfill username from the two seed users (safe: UPDATE only if blank)
UPDATE `users` SET `username` = 'wisdomalornyo' WHERE `id` = 1 AND `username` = '';
UPDATE `users` SET `username` = 'koficlinton'   WHERE `id` = 2 AND `username` = '';

-- ═══════════════════════════════════════════════════════════════
-- 2. users.created_at — shown as "Joined" date in User Mgmt
-- ═══════════════════════════════════════════════════════════════
CALL _add_col('users', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `role`');

-- ═══════════════════════════════════════════════════════════════
-- 3. items.sku — already used by backend; may be missing in live schema
-- ═══════════════════════════════════════════════════════════════
CALL _add_col('items', 'sku', 'VARCHAR(50) UNIQUE AFTER `name`');

-- ═══════════════════════════════════════════════════════════════
-- 4. items.created_at — shown on Item Detail page
-- ═══════════════════════════════════════════════════════════════
CALL _add_col('items', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `image_url`');

-- ═══════════════════════════════════════════════════════════════
-- Cleanup helper procedures (no longer needed after migration)
-- ═══════════════════════════════════════════════════════════════
DROP PROCEDURE IF EXISTS _add_col;
DROP PROCEDURE IF EXISTS _add_idx;

-- ═══════════════════════════════════════════════════════════════
-- 5. Create `suppliers` table (if it doesn't already exist)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS `suppliers` (
    `id`         INT(11)      NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(150) NOT NULL,
    `contact`    VARCHAR(150) DEFAULT NULL  COMMENT 'Contact person name',
    `email`      VARCHAR(150) DEFAULT NULL,
    `phone`      VARCHAR(50)  DEFAULT NULL,
    `address`    VARCHAR(255) DEFAULT NULL,
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `idx_suppliers_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed two example suppliers so the page isn't empty on first load
INSERT IGNORE INTO `suppliers` (`id`, `name`, `contact`, `email`) VALUES
(1, 'ABC Office Supplies', 'Maria Santos', 'maria@abcoffice.test'),
(2, 'EduGear Philippines', 'Ramon Cruz',   'ramon@edugear.test');

-- ═══════════════════════════════════════════════════════════════
-- 6. Add `supplier_id` FK column to `items`
--    (frontend uses this to count "Products Supplied" per supplier)
-- ═══════════════════════════════════════════════════════════════
-- Re-create helper procedure (was dropped above)
DROP PROCEDURE IF EXISTS _add_col;
DELIMITER //
CREATE PROCEDURE _add_col(IN p_table VARCHAR(100), IN p_col VARCHAR(100), IN p_def TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_col
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_col, '` ', p_def);
        PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
        SELECT CONCAT('  + Added: ', p_table, '.', p_col) AS migration_log;
    ELSE
        SELECT CONCAT('  - Skipped (exists): ', p_table, '.', p_col) AS migration_log;
    END IF;
END //
DELIMITER ;

CALL _add_col('items', 'supplier_id', 'INT(11) DEFAULT NULL AFTER `department_id`');

-- Add FK constraint only if it doesn't already exist
SET @fk_exists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items'
      AND CONSTRAINT_NAME = 'fk_items_supplier' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @fk_sql = IF(
    @fk_exists = 0,
    'ALTER TABLE `items` ADD CONSTRAINT `fk_items_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL',
    'SELECT "FK fk_items_supplier already exists (skipped)" AS migration_log'
);
PREPARE fk_stmt FROM @fk_sql;
EXECUTE fk_stmt;
DEALLOCATE PREPARE fk_stmt;

DROP PROCEDURE IF EXISTS _add_col;

-- ═══════════════════════════════════════════════════════════════
-- Verify final state:
-- ═══════════════════════════════════════════════════════════════
-- DESCRIBE suppliers;
-- DESCRIBE items;
-- DESCRIBE users;
-- SELECT * FROM suppliers;
