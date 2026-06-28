import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "companies",
  password: "123456",
  port: 5432,
});

db.connect();

// Helper function to dynamically get column names from the table
async function getColumns() {
  const result = await db.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = '2026_companies' AND column_name != 'id'
  `);
  return result.rows.map((row) => row.column_name);
}

// --- Home / Search Route ---
app.get("/", async (req, res) => {
  try {
    const searchQuery = req.query.q;
    let result;

    if (searchQuery) {
      const sql = `SELECT * FROM "2026_companies" WHERE "2026_companies"::text ILIKE $1 ORDER BY "Seial_no." ASC`;
      result = await db.query(sql, [`%${searchQuery}%`]);
    } else {
      result = await db.query('SELECT * FROM "2026_companies" ORDER BY "Seial_no." ASC');
    }

    res.render("index.ejs", {
      companies: result.rows,
      searchQuery: searchQuery || "",
    });
  } catch (err) {
    console.error("Error executing query", err.stack);
    res.status(500).send("Internal Server Error");
  }
});

// --- ADD: Show Form ---
app.get("/add", async (req, res) => {
  try {
    const columns = await getColumns();
    res.render("form.ejs", { action: "/add", company: {}, columns: columns, title: "Add New Company" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// --- ADD: Handle Database Insert ---
app.post("/add", async (req, res) => {
  try {
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);

    // Dynamically builds: INSERT INTO "2026_companies" ("col1", "col2") VALUES ($1, $2)
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO "2026_companies" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${placeholders})`;

    await db.query(sql, values);
    res.redirect("/"); // Go back to home page after saving
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error while adding");
  }
});

// --- EDIT: Show Form ---
app.get("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query('SELECT * FROM "2026_companies" WHERE id = $1', [id]);
    const columns = await getColumns();

    if (result.rows.length === 0) return res.status(404).send("Company not found");

    res.render("form.ejs", { action: `/edit/${id}`, company: result.rows[0], columns: columns, title: "Edit Company" });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// --- EDIT: Handle Database Update ---
app.post("/edit/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const keys = Object.keys(req.body);
    const values = Object.values(req.body);

    // Dynamically builds: UPDATE "2026_companies" SET "col1" = $1, "col2" = $2 WHERE id = $3
    const setClause = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
    const sql = `UPDATE "2026_companies" SET ${setClause} WHERE id = $${keys.length + 1}`;

    await db.query(sql, [...values, id]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error while updating");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
