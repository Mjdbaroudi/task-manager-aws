const express = require("express");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:
    process.env.DB_SSL === "true"
      ? { rejectUnauthorized: false }
      : false,
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      task VARCHAR(255) NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.get("/", (req, res) => {
  res.json({
    message: "Task Manager API is running",
    database: "PostgreSQL",
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      database: "connected",
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
    });
  }
});

app.get("/tasks", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, task, completed, created_at FROM tasks ORDER BY id"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("GET /tasks failed:", error);
    res.status(500).json({ message: "Could not retrieve tasks" });
  }
});

app.post("/tasks", async (req, res) => {
  const task = String(req.body.task || "").trim();

  if (!task) {
    return res.status(400).json({ message: "task is required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (task)
       VALUES ($1)
       RETURNING id, task, completed, created_at`,
      [task]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /tasks failed:", error);
    res.status(500).json({ message: "Could not create task" });
  }
});

app.put("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);
  const task =
    req.body.task === undefined ? undefined : String(req.body.task).trim();
  const completed =
    req.body.completed === undefined ? undefined : Boolean(req.body.completed);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid task id" });
  }

  if (task === "" || (task === undefined && completed === undefined)) {
    return res.status(400).json({
      message: "Provide task and/or completed",
    });
  }

  try {
    const current = await pool.query(
      "SELECT task, completed FROM tasks WHERE id = $1",
      [id]
    );

    if (current.rowCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    const nextTask = task ?? current.rows[0].task;
    const nextCompleted = completed ?? current.rows[0].completed;

    const result = await pool.query(
      `UPDATE tasks
       SET task = $1, completed = $2
       WHERE id = $3
       RETURNING id, task, completed, created_at`,
      [nextTask, nextCompleted, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("PUT /tasks/:id failed:", error);
    res.status(500).json({ message: "Could not update task" });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid task id" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("DELETE /tasks/:id failed:", error);
    res.status(500).json({ message: "Could not delete task" });
  }
});

async function startServer() {
  try {
    await initializeDatabase();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Application startup failed:", error);
    process.exit(1);
  }
}

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

startServer();