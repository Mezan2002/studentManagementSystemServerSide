// * require start
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
// * require end

// * initial configurations for express start
app.get("/", (req, res) => {
  res.send("Student Management Server is Running Hurrah!");
});
app.listen(port, () => {
  console.log(`Student Management Server in Port ${port}`);
});

// * initial configurations for express end
