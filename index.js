//#region Require statements

const express = require("express");
const mysql = require("mysql2");
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require("dotenv");

//#endregion Require statements

//Loads the .env file into the script.
dotenv.config();

//#region Middleware
app.use(express.json());
app.use(express.encoded({ extended: true }));
//#endregion Middleware

//#region DB connections
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

var con = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  insecureAuth: true,
});

con.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});
//#endregion DB connections

//Starting the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });