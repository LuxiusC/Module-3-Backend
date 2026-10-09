require("dotenv").config();
let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("@neondatabase/serverless");
const { DATABASE_URL } = process.env;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

let app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.get('/', (req, res) => {
  res.json({ message: "Backend API is online and running!" });
});

app.get('/users', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT * from users');
    return res.json(result.rows);
  } catch (err) {
    console.error("Database Error on /users:", err.message);
    return res.status(500).json({ error: "Database error: " + err.message });
  } finally {
    if (client) client.release();
  }
});

app.post('/result', async (req, res) => {
  const { phone_number } = req.body;
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT bookings.*, users.phone_number,users.name FROM bookings INNER JOIN users ON bookings.user_id = users.id WHERE users.phone_number = $1', [phone_number]);
    if (result.rowCount === 0) {
      return res.status(404).json({ "message": "Booking not found under this number." });
    }
    return res.json(result.rows);
  } catch (error) {
    console.error("Database Error on /result:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
});

app.post('/newuser', async (req, res) => {
  const { name, phone_number, email } = req.body;
  let client;
  try {
    client = await pool.connect();
    const emailExist = await client.query("SELECT * from users WHERE email=$1", [email]);
    if (emailExist.rowCount > 0) {
      return res.status(400).json({ "message": "Email has been used. Try again." });
    }
    const result = await client.query('INSERT INTO users (name,phone_number,email) VALUES ($1,$2,$3) RETURNING *', [name, phone_number, email]);
    return res.json(result.rows);
  } catch (error) {
    console.error("Database Error on /newuser:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
});

app.post('/newbooking/:userId', async (req, res) => {
  const { userId } = req.params;
  const { title, description, date_now, time_now, class_type } = req.body;
  let client;
  try {
    client = await pool.connect();
    const existingBooking = await client.query("SELECT id from bookings WHERE date_now = $1 AND time_now = $2", [date_now, time_now]);
    if (existingBooking.rowCount > 0) {
      return res.status(409).json({ "message": "Booking time or date conflicted" });
    }
    const result = await client.query('INSERT INTO bookings (title,description,date_now,time_now,user_id,class_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [title, description, date_now, time_now, userId, class_type]);
    return res.json(result.rows);
  } catch (error) {
    console.error("Database Error on /newbooking:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
});

app.put('/update/:postId', async (req, res) => {
  const { title, description, date_now, time_now, class_type } = req.body;
  const { postId } = req.params;
  let client;
  try {
    client = await pool.connect();
    const bookingExist = await client.query("SELECT * from bookings WHERE id=$1", [postId]);
    if (bookingExist.rowCount === 0) {
      return res.status(404).json({ "message": "Booking not found" });
    }

    const timeBooking = await client.query("SELECT id from bookings WHERE date_now=$1 AND time_now=$2 AND id != $3", [date_now, time_now, postId]);
    if (timeBooking.rowCount > 0) {
      return res.status(409).json({ "message": "Time or Date Conflicted" });
    }

    await client.query("UPDATE bookings SET title=$1,description=$2,date_now = $3,time_now = $4,class_type = $5 WHERE id = $6", [title, description, date_now, time_now, class_type, postId]);
    return res.json({ "message": "Update Successfully" });
  } catch (error) {
    console.error("Database Error on /update:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
});

app.delete("/booking/:postId", async (req, res) => {
  const { postId } = req.params;
  let client;
  try {
    client = await pool.connect();
    await client.query("DELETE from bookings WHERE id=$1", [postId]);
    return res.json({ "message": "Delete Successfully" });
  } catch (error) {
    console.error("Database Error on /booking delete:", error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    if (client) client.release();
  }
});

module.exports = app;