require("dotenv").config();
let express = require("express");
let path = require("path");
const cors = require("cors");
const { Pool } = require("pg");
const { DATABASE_URL, SECRET_KEY } = process.env;
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { stripTypeScriptTypes } = require("module");

let app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.get('/bookings', async (req, res) => {
  const client = await pool.connect()
  try {
    const result = await client.query("SELECT * from bookings")
    res.json(result.rows)
  } catch (err) {
    console.error(error, err.message)
  } finally {
    client.release()
  }
})

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

app.get('/bookings/:userId', async (req, res) => {
  const { userId } = req.params
  const client = await pool.connect()
  try {
    const result = await client.query('SELECT * from bookings WHERE user_id =$1', [userId])
    res.json(result.rows)
  } catch (error) {
    console.error(error, error.message)
  } finally {
    client.release()
  }
})

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


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname + "/index.html"));
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});
