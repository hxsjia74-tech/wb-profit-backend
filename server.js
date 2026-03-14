const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();

app.use(cors());
app.use(express.json());

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

    await pool.query(`
  ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS article TEXT
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
    const { article, product_name, cost_price, sell_price, commission, logistics } = req.body;

    const profit = sell_price - cost_price - commission - logistics;

const result = await pool.query(
  `INSERT INTO sales
   (article, product_name, cost_price, sell_price, commission, logistics, profit)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   RETURNING *`,
  [article, product_name, cost_price, sell_price, commission, logistics, profit]
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
app.get("/sales", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM sales ORDER BY created_at DESC"
    );

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({
      error: "failed to fetch sales",
      details: error.message
    });
  }
});
app.get("/profit", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total_sales,
        COALESCE(SUM(sell_price), 0) AS total_revenue,
        COALESCE(SUM(commission), 0) AS total_commission,
        COALESCE(SUM(logistics), 0) AS total_logistics,
        COALESCE(SUM(profit), 0) AS total_profit
      FROM sales
    `);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({
      error: "failed to calculate profit",
      details: error.message
    });
  }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get("/profit-by-article", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        article,
        COUNT(*) AS total_sales,
        SUM(profit) AS total_profit,
        SUM(sell_price) AS total_revenue
      FROM sales
      GROUP BY article
      ORDER BY total_profit DESC
    `);

    res.json(result.rows);

  } catch (error) {

    res.status(500).json({
      error: "failed to fetch article profit",
      details: error.message
    });

  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
