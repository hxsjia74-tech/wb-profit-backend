const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const multer = require("multer");
const XLSX = require("xlsx");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
app.post("/connect-wb", async (req, res) => {
  try {
    const { user_id, wb_api_key } = req.body;

    if (!user_id || !wb_api_key) {
      return res.status(400).json({
        error: "user_id and wb_api_key are required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO users (max_user_id, wb_api_key)
      VALUES ($1, $2)
      ON CONFLICT (max_user_id)
      DO UPDATE SET wb_api_key = EXCLUDED.wb_api_key
      RETURNING *
      `,
      [user_id, wb_api_key]
    );

    res.json({
      status: "wb api key saved",
      data: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      error: "failed to save wb api key",
      details: error.message
    });
  }
});
app.post("/upload-costs", upload.single("file"), async (req, res) => {
  try {
    const user_id = req.body.user_id;

    if (!user_id) {
      return res.status(400).json({
        error: "user_id is required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Excel file is required"
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({
        error: "Excel file is empty"
      });
    }

    await pool.query(
      `DELETE FROM costs WHERE max_user_id = $1`,
      [user_id]
    );

    let savedCount = 0;
    
     for (const row of rows) {
  console.log("ROW:", row);

  const normalizedRow = {};

  for (const key of Object.keys(row)) {
    normalizedRow[String(key).trim()] = row[key];
  }

  const article =
    normalizedRow["Артикул"] ??
    normalizedRow["артикул"] ??
    normalizedRow["article"];

  const cost =
    normalizedRow["Себестоимость"] ??
    normalizedRow["себестоимость"] ??
    normalizedRow["cost"] ??
    normalizedRow["cost_price"];

  console.log("PARSED:", { article, cost });

      if (!article || cost === undefined || cost === null || cost === "") {
        continue;
      }

      await pool.query(
        `INSERT INTO costs (max_user_id, article, cost_price)
        VALUES ($1, $2, $3)`,
        [user_id, String(article), Number(cost)]
      );

      savedCount++;
    }

    res.json({
      status: "costs uploaded",
      rows_saved: savedCount
    });

  } catch (error) {
    res.status(500).json({
      error: "failed to upload costs",
      details: error.message
    });
  }
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
await pool.query(`
  CREATE TABLE IF NOT EXISTS costs (
    id SERIAL PRIMARY KEY,
    max_user_id TEXT,
    article TEXT,
    cost_price NUMERIC,
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
    await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    max_user_id TEXT UNIQUE,
    wb_api_key TEXT,
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
app.get("/profit-by-article/:article", async (req, res) => {
  try {
    const { article } = req.params;

    const result = await pool.query(
      `
      SELECT
        article,
        COUNT(*) AS total_sales,
        SUM(profit) AS total_profit,
        SUM(sell_price) AS total_revenue
      FROM sales
      WHERE article = $1
      GROUP BY article
      `,
      [article]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "article not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({
      error: "failed to fetch article profit",
      details: error.message
    });
  }
});
app.get("/create-costs-table", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS costs (
        id SERIAL PRIMARY KEY,
        max_user_id TEXT,
        article TEXT,
        cost_price NUMERIC,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    res.json({ message: "costs table created" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/wb-test/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const userResult = await pool.query(
      `
      SELECT wb_api_key
      FROM users
      WHERE max_user_id = $1
      LIMIT 1
      `,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "user not found"
      });
    }

    const wbApiKey = userResult.rows[0].wb_api_key;

    if (!wbApiKey) {
      return res.status(400).json({
        error: "wb api key not found"
      });
    }

    const dateFrom = "2024-01-29";
    const dateTo = new Date().toISOString().slice(0, 10);

    const url =
      `https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod` +
      `?dateFrom=${encodeURIComponent(dateFrom)}` +
      `&dateTo=${encodeURIComponent(dateTo)}` +
      `&limit=100` +
      `&rrdid=0`;

    const wbResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: wbApiKey
      }
    });

    if (wbResponse.status === 204) {
      return res.json({
        status: "ok",
        message: "wb responded but no data for selected period"
      });
    }

    const text = await wbResponse.text();

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!wbResponse.ok) {
      return res.status(wbResponse.status).json({
        error: "wb api request failed",
        details: data
      });
    }

    res.json({
      status: "ok",
      count: Array.isArray(data) ? data.length : null,
      sample: Array.isArray(data) ? data.slice(0, 3) : data
    });
  } catch (error) {
    res.status(500).json({
      error: "failed to request wb api",
      details: error.message
    });
  }
});
app.get("/profit/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const userResult = await pool.query(
      `
      SELECT wb_api_key
      FROM users
      WHERE max_user_id = $1
      LIMIT 1
      `,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: "user not found"
      });
    }

    const wbApiKey = userResult.rows[0].wb_api_key;

    if (!wbApiKey) {
      return res.status(400).json({
        error: "wb api key not found"
      });
    }

    const dateFrom = "2024-01-29";
    const dateTo = new Date().toISOString().slice(0, 10);
    
const url =
  https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod +
  ?dateFrom=${encodeURIComponent(dateFrom)} +
  &dateTo=${encodeURIComponent(dateTo)} +
  &limit=100000 +
  &rrdid=0;

const wbResponse = await fetch(url, {
  method: "GET",
  headers: {
    Authorization: wbApiKey
  }
});

if (wbResponse.status === 204) {
  return res.json({
    status: "ok",
    total_articles: 0,
    total_rows_from_wb: 0,
    data: []
  });
}

const text = await wbResponse.text();

let data;
try {
  data = text ? JSON.parse(text) : null;
} catch {
  data = text;
}

if (!wbResponse.ok) {
  return res.status(wbResponse.status).json({
    error: "wb api request failed",
    details: data
  });
}

const allRows = Array.isArray(data) ? data : [];

    const costResult = await pool.query(
      `
      SELECT article, cost_price
      FROM costs
      WHERE max_user_id = $1
      `,
      [user_id]
    );

    const costMap = {};
    for (const row of costResult.rows) {
      costMap[String(row.article)] = Number(row.cost_price);
    }

    const grouped = {};

    for (const row of allRows) {
      const article = String(row.nm_id || row.sa_name || row.supplier_article || "").trim();

      if (!article) {
        continue;
      }

      if (!grouped[article]) {
        grouped[article] = {
          article,
          quantity: 0,
          revenue: 0,
          commission: 0,
          logistics: 0,
          storage: 0,
          cost_price_per_unit: costMap[article] ?? 0,
          cost_total: 0,
          profit: 0
        };
      }

      const quantity = Number(row.quantity || 0);
      const revenue = Number(row.retail_amount || row.retail_price || 0);
      const commission = Number(row.ppvz_sales_commission || 0);
      const logistics = Number(row.delivery_rub || 0);
      const storage = Number(row.storage_fee || 0);

      grouped[article].quantity += quantity;
      grouped[article].revenue += revenue;
      grouped[article].commission += commission;
      grouped[article].logistics += logistics;
      grouped[article].storage += storage;
    }

    const result = Object.values(grouped).map((item) => {
      const costTotal = item.quantity * item.cost_price_per_unit;
      const profit =
        item.revenue -
        item.commission -
        item.logistics -
        item.storage -
        costTotal;

      return {
        article: item.article,
        quantity: item.quantity,
        revenue: Number(item.revenue.toFixed(2)),
        commission: Number(item.commission.toFixed(2)),
        logistics: Number(item.logistics.toFixed(2)),
        storage: Number(item.storage.toFixed(2)),
        cost_price_per_unit: Number(item.cost_price_per_unit.toFixed(2)),
        cost_total: Number(costTotal.toFixed(2)),
        profit: Number(profit.toFixed(2))
      };
    });

    result.sort((a, b) => b.profit - a.profit);

    res.json({
      status: "ok",
      total_articles: result.length,
      total_rows_from_wb: allRows.length,
      data: result
    });
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
