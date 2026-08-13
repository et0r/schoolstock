const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

// Middleware
const authenticate = require("./inventory-backend/middleware/auth");
const adminOnly = require("./inventory-backend/middleware/adminOnly");
const upload = require("./inventory-backend/middleware/upload");

// This also triggers the DB connection test in db.js on startup
require("./inventory-backend/config/db");

// Controllers
const {createItem, getAllItems, updateItem, deleteItem,} = require("./inventory-backend/controllers/itemController");
const {register, login,} = require("./inventory-backend/controllers/authController");

// Routes
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);

app.post("/api/items", authenticate, upload.single("image"), createItem);
app.get("/api/items", authenticate, getAllItems);
app.put("/api/items/:id", authenticate, updateItem);
app.delete("/api/items/:id", authenticate, adminOnly, deleteItem);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("=================================================");
    console.log(`🚀 Inventory server running on port ${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("   Routes:");
    console.log("     POST   /api/auth/register");
    console.log("     POST   /api/auth/login");
    console.log("     POST   /api/items          (auth required)");
    console.log("     GET    /api/items          (auth required)");
    console.log("     PUT    /api/items/:id      (auth required)");
    console.log("     DELETE /api/items/:id      (auth + admin required)");
    console.log("=================================================");
});