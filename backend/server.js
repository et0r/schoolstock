const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

// ── Middleware ────────────────────────────────────────────────────────────────
const authenticate = require("./inventory-backend/middleware/auth");
const adminOnly    = require("./inventory-backend/middleware/adminOnly");
const upload       = require("./inventory-backend/middleware/upload");

// Triggers DB connection test on startup
require("./inventory-backend/config/db");

// ── Controllers ───────────────────────────────────────────────────────────────
const { createItem, getAllItems, updateItem, deleteItem } =
    require("./inventory-backend/controllers/itemController");

const { getItemById, getCategories, getDepartments } =
    require("./inventory-backend/controllers/itemDetailController");

const { register, login } =
    require("./inventory-backend/controllers/authController");

const { getAllUsers, updateUserRole, deleteUser } =
    require("./inventory-backend/controllers/userController");

const { getAllSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } =
    require("./inventory-backend/controllers/supplierController");

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post("/api/auth/register", register);
app.post("/api/auth/login",    login);

// ── Item routes ───────────────────────────────────────────────────────────────
app.post(  "/api/items",     authenticate, upload.single("image"), createItem);
app.get(   "/api/items",     authenticate, getAllItems);
app.get(   "/api/items/:id", authenticate, getItemById);   // NEW — item detail
app.put(   "/api/items/:id", authenticate, updateItem);
app.delete("/api/items/:id", authenticate, adminOnly, deleteItem);

// ── Lookup routes (categories / departments) ──────────────────────────────────
app.get("/api/categories",  authenticate, getCategories);   // NEW
app.get("/api/departments", authenticate, getDepartments);  // NEW

// ── Supplier routes ──────────────────────────────────────────────────────────
app.get(   "/api/suppliers",     authenticate, getAllSuppliers);
app.get(   "/api/suppliers/:id", authenticate, getSupplierById);
app.post(  "/api/suppliers",     authenticate, createSupplier);
app.put(   "/api/suppliers/:id", authenticate, updateSupplier);
app.delete("/api/suppliers/:id", authenticate, adminOnly, deleteSupplier);

// ── User management routes (admin only) ───────────────────────────────────────
app.get(   "/api/users",          authenticate, adminOnly, getAllUsers);
app.patch( "/api/users/:id/role", authenticate, adminOnly, updateUserRole);
app.delete("/api/users/:id",      authenticate, adminOnly, deleteUser);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) =>
    res.json({ status: "ok", timestamp: new Date().toISOString() })
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("=================================================");
    console.log(`🚀 SchoolStock API running on port ${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
    console.log("   Routes:");
    console.log("     POST   /api/auth/register");
    console.log("     POST   /api/auth/login");
    console.log("     GET    /api/items              (auth)");
    console.log("     GET    /api/items/:id          (auth)");
    console.log("     POST   /api/items              (auth)");
    console.log("     PUT    /api/items/:id          (auth)");
    console.log("     DELETE /api/items/:id          (auth + admin)");
    console.log("     GET    /api/categories         (auth)");
    console.log("     GET    /api/departments        (auth)");
    console.log("     GET    /api/suppliers          (auth)");
    console.log("     GET    /api/suppliers/:id      (auth)");
    console.log("     POST   /api/suppliers          (auth)");
    console.log("     PUT    /api/suppliers/:id      (auth)");
    console.log("     DELETE /api/suppliers/:id      (auth + admin)");
    console.log("     GET    /api/users              (auth + admin)");
    console.log("     PATCH  /api/users/:id/role     (auth + admin)");
    console.log("     DELETE /api/users/:id          (auth + admin)");
    console.log("     GET    /api/health");
    console.log("=================================================");
});