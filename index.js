const express = require("express");
const app = express();

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send("API is running 🚀");
});

// GET
app.get("/tasks", (req, res) => {
  res.json([{ id: 1, task: "Test task" }]);
});

// POST
app.post("/tasks", (req, res) => {
  res.json({ message: "Task created" });
});

// PUT
app.put("/tasks/:id", (req, res) => {
  res.json({ message: "Task updated" });
});

// DELETE
app.delete("/tasks/:id", (req, res) => {
  res.json({ message: "Task deleted" });
});

// تشغيل السيرفر
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});