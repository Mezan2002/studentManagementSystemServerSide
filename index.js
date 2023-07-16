// * require start
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 3000;
// * require end

// * middlewares start

app.use(cors());
app.use(express.json());

// * middlewares end

// * connect mongoDB start
const uri = `mongodb+srv://${process.env.db_username}:${process.env.db_password}@cluster0.2ahck7i.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// * connect mongoDB end

// * verify JWT API start
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.split(" ")[1];
  if (!authHeader) {
    return res.status(401).send({ message: "Missing token" });
  }
  jwt.verify(token, process.env.jwt_token_secret, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Invalid Token" });
    }
    const id = decoded;
    req.decoded = id;
    next();
  });
};
// * verify JWT API end

// * collections start

const usersCollection = client.db("studentManagersDBUser").collection("users");

// * collections end

// * CRUD run function start
const run = async () => {
  try {
    // * register user API start

    app.post("/registerUser", async (req, res) => {
      const usersData = req.body;
      const result = await usersCollection.insertOne(usersData);
      res.send(result);
    });

    // * register user API end

    // * login user API Start
    app.get("/logInUser", async (req, res) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Missing token" });
      }
      const phoneNumber = req.query.phoneNumber;
      const password = req.query.password;
      const query = {
        "logInInfo.logInMobileNumber": phoneNumber,
        "logInInfo.logInPassword": password,
      };
      const result = await usersCollection.findOne(query);
      if (result === null) {
        res.send({
          message:
            "phone number or password incorrect please try again with correct phone number and password",
        });
      } else {
        const objectId = result._id;
        const id = objectId.toString().match(/([0-9a-fA-F]){24}/)[0];
        const token = jwt.sign({ id }, process.env.jwt_token_secret, {
          expiresIn: "10h",
        });
        res.send(token);
      }
    });
    // * login user API End

    // * get users data API start
    app.get("/getUser", verifyJWT, async (req, res) => {
      const query = new ObjectId(req.decoded);
      const user = await usersCollection.findOne(query);
      res.send(user);
    });
    // * get users data API end

    // * is phone number has registered before API start
    app.get("/isNumberExist", async (req, res) => {
      const phoneNumber = req.query.phoneNumber;
      const query = {
        "logInInfo.logInMobileNumber": phoneNumber,
      };
      const result = await usersCollection.findOne(query);
      if (result === null) {
        res.send(false);
      } else {
        res.send(true);
      }
    });
    // * is phone number has registered before API end
  } finally {
    console.log();
  }
};

run().catch((err) => console.log(err));
// * CRUD run function end

// * initial configurations for express start
app.get("/", (req, res) => {
  res.send("Student Management Server is Running Hurrah!");
});
app.listen(port, () => {
  console.log(`Student Management Server in Port ${port}`);
});

// * initial configurations for express end
