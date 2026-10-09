require("dotenv").config();
let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("@neondatabase/serverless");
const { DATABASE_URL } = process.env;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { stripTypeScriptTypes } = require("module");

let app = express();

const allowedOrigins = [
  "https://module-3-frontend.vercel.app",
  "http://localhost:5173", // Optional: for local Vite testing
  "http://localhost:3000"  // Optional: for local React testing
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);

      // Allow origin if listed, or match any Vercel frontend preview deployment URL
      if (allowedOrigins.includes(origin) || origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }

      return callback(null, true); // Or set to callback(null, true) during testing to allow all
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Handle preflight requests for all routes
app.options("*", cors());

app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

//get user data for userContext (userContext)
app.get('/users', async (req, res) => {
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * from users')
    res.json(result.rows)
  } catch (err) {
    console.error(error, err.message)
  } finally {
    client.release()
  }
})

//Getting Booking Result (students.jsx)
app.post('/result', async (req, res) => {
  const { phone_number } = req.body
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT bookings.*, users.phone_number,users.name FROM bookings INNER JOIN users ON bookings.user_id = users.id WHERE users.phone_number = $1', [phone_number])
    if (result.rowCount === 0) {
      res.status(404).json({ "message": "Booking not found under this number." })
    }
    res.json(result.rows)
  } catch (error) {
    console.error(error.message)
  } finally {
    client.release()
  }
})

// Create new user (User.jsx)
app.post('/newuser', async (req, res) => {
  const client = await pool.connect()
  const { name, phone_number, email } = req.body
  try {
    const emailExist = await client.query("SELECT * from users WHERE email=$1", [email])
    if (emailExist.rowCount > 0) return res.json({ "message": "Email has been used.Try again." })
    const result = await client.query('INSERT INTO users (name,phone_number,email) VALUES ($1,$2,$3) RETURNING *', [name, phone_number, email])
    res.json(result.rows)
  } catch (error) {
    console.error(error, error.message)
  } finally {
    client.release()
  }
})

//Create bookings based on user (Booking.jsx)
app.post('/newbooking/:userId', async (req, res) => {
  const client = await pool.connect()
  const { userId } = req.params
  const { title, description, date_now, time_now, class_type } = req.body
  try {
    const existingBooking = await client.query("SELECT id from bookings WHERE date_now = $1 AND time_now = $2", [date_now, time_now])
    if (existingBooking.rowCount > 0) {
      return res.json({ "message": "Booking time or date conflicted" })
    }
    const result = await client.query('INSERT INTO bookings (title,description,date_now,time_now,user_id,class_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [title, description, date_now, time_now, userId, class_type])
    res.json(result.rows)
  } catch (error) {
    console.error("error", error.message)
  } finally {
    client.release()
  }
})

//update bookings (Students.jsx)
app.put('/update/:postId', async (req, res) => {
  const client = await pool.connect()
  const { title, description, date_now, time_now, class_type } = req.body
  const { postId } = req.params
  try {
    const bookingExist = await client.query("SELECT * from bookings WHERE id=$1", [postId])
    if (bookingExist.rowCount < 0) return res.status(404).json({ "message": "Booking not found" })
    const timeBooking = await client.query("SELECT id from bookings WHERE date_now=$1 AND time_now=$2", [date_now, time_now])
    if (timeBooking.rowCount > 0) return res.json({ "message": "Time or Date Conflicted" })
    const result = await client.query("UPDATE bookings SET title=$1,description=$2,date_now = $3,time_now = $4,class_type = $5 WHERE id = $6", [title, description, date_now, time_now, class_type, postId])
    res.json({ "Message": "Update Succesfully" })
  } catch (error) {
    console.error("error", error.message)
  } finally {
    client.release()
  }
})
//delete bookings (students.jsx)
app.delete("/booking/:postId", async (req, res) => {
  const client = await pool.connect()
  const { postId } = req.params
  try {
    const result = await client.query("DELETE from bookings  WHERE id=$1", [postId])
    res.json({ "message": "Delete Succesfully" })
  } catch (error) {
    console.error("error", error.message)
  } finally {
    client.release()
  }
})



module.exports = app
