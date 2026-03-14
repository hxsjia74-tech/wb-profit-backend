const express = require("express");
const { Pool } = require("pg");

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.get("/", (req, res) => {
  res.json({ status: "backend working" });
});

app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      status: "database connected",
      time: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      error: "database connection failed",
      details: error.message,
    });
  }
});
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        product_name TEXT,
        cost_price NUMERIC,
        sell_price NUMERIC,
        commission NUMERIC,
        logistics NUMERIC,
        profit NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("Sales table ready");
  } catch (error) {
    console.error("Database init error:", error);
  }
}

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        product_name TEXT,
        cost_price NUMERIC,
        sell_price NUMERIC,
        commission NUMERIC,
        logistics NUMERIC,
        profit NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("Sales table ready");
  } catch (error) {
    console.error("Database init error:", error);
  }
}

initDatabase();
app.use(express.json());

app.post("/sale", async (req, res) => {
  try {
    const { product_name, cost_price, sell_price, commission, logistics } = req.body;

    const profit = sell_price - cost_price - commission - logistics;

    const result = await pool.query(
      `INSERT INTO sales
       (product_name, cost_price, sell_price, commission, logistics, profit)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product_name, cost_price, sell_price, commission, logistics, profit]
    );

    res.json({
      status: "sale saved",
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      error: "failed to save sale",
      details: error.message
    });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
