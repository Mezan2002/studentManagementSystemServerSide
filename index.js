// * require start
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  Transaction,
} = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const app = express();
const port = process.env.PORT || 3000;
// * require end

// * SSL Commerce Initialization Start
const store_id = process.env.store_id;
const store_passwd = process.env.store_passwd;
const is_live = false; //true for live, false for sandbox
// * SSL Commerce Initialization End

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
const paymentsOccasionCollection = client
  .db("studentManagersDBUser")
  .collection("paymentsOccasion");
const paymentsInfoCollection = client
  .db("studentManagersDBUser")
  .collection("paymentsInfo");
const complainCollection = client
  .db("studentManagersDBUser")
  .collection("complains");
const attendenceCollection = client
  .db("studentManagersDBUser")
  .collection("attendences");
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
        const userType = result.userType;
        const id = objectId.toString().match(/([0-9a-fA-F]){24}/)[0];
        const token = jwt.sign({ id }, process.env.jwt_token_secret, {
          expiresIn: "10h",
        });
        res.send({ token, userType });
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

    // * post the payments occasion API start
    app.post("/postPaymetsOccasions", async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await paymentsOccasionCollection.insertOne(data);
      res.send(result);
    });
    // * post the payments occasion API end

    // * get the payments occasion API start
    app.get("/getPaymentOccasions", async (req, res) => {
      const query = {};
      const result = await paymentsOccasionCollection.find(query).toArray();
      res.send(result);
    });
    // * get the payments occasion API end

    // * paymet by SSL Commerce API start
    app.post("/getPayment", async (req, res) => {
      const paymentInfo = req.body;
      const userInfo = paymentInfo.userInfo;
      const userId = paymentInfo.userId;
      const paymentId = paymentInfo.paymentId;
      const paymentQuery = { _id: new ObjectId(paymentId) };
      const paymentFor = await paymentsOccasionCollection.findOne(paymentQuery);
      const transId = uuidv4();
      let rollNumber = 100000;
      let registrationNumber = 1617615000;
      let successURL;
      if (paymentFor.paymentTitle === "Exam Fee") {
        rollNumber += 1;
        registrationNumber += 1;
        successURL = `${process.env.SERVER_URL}/payment/success?transactionId=${transId}&studentRollNumber=${rollNumber}&studentRegistrationNumber=${registrationNumber}`;
      } else {
        successURL = `${process.env.SERVER_URL}/payment/success?transactionId=${transId}`;
      }

      const data = {
        total_amount: paymentFor?.paymentAmount,
        currency: "BDT",
        tran_id: transId,
        success_url: successURL,
        fail_url: `${process.env.SERVER_URL}/payment/fail?transactionId=${transId}`,
        cancel_url: `${process.env.SERVER_URL}/payment/cancel?transactionId=${transId}`,
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: paymentFor?.paymentTitle,
        product_category: paymentFor?.paymentTitle,
        product_profile: paymentFor?.paymentTitle,
        cus_name: userInfo?.userName,
        cus_email: userInfo?.userEmail,
        cus_add1: "Rangpur",
        cus_add2: "Pirgachha",
        cus_city: "Rangpur",
        cus_state: "Rangpur",
        cus_postcode: userInfo?.usersPostCode,
        cus_country: "Bangladesh",
        cus_phone: userInfo?.userPhoneNumber,
        cus_fax: userInfo?.userPhoneNumber,
        ship_name: userInfo?.userName,
        ship_add1: "Rangpur",
        ship_add2: "Pirgachha",
        ship_city: "Rangpur",
        ship_state: "Rangpur",
        ship_postcode: userInfo?.usersPostCode,
        ship_country: "Bangladesh",
      };

      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz
        .init(data)
        .then((apiResponse) => {
          if (apiResponse?.status === "SUCCESS") {
            let GatewayPageURL = apiResponse.GatewayPageURL;
            const paymentData = {
              paymentAmount: paymentFor.paymentAmount,
              paymentTitle: paymentFor.paymentTitle,
              paymentFor: paymentFor.paymentFor,
              paymentFeeId: paymentFor._id.toString(),
              transId,
              userId,
              paid: false,
            };
            if (paymentFor.paymentTitle === "Exam Fee") {
              paymentData.studentRollNumber = rollNumber;
              paymentData.studentRegistrationNumber = registrationNumber;
            }

            console.log(paymentData);

            paymentsInfoCollection.insertOne(paymentData);
            res.send({ url: GatewayPageURL });
          } else {
            console.error("Unexpected API response:", apiResponse);
            res.status(500).send("Error: Unexpected API response");
          }
        })
        .catch((err) => {
          console.error("Error initializing payment:", err);
          res.status(500).send("Error: Unable to initialize payment");
        });
    });
    // * paymet by SSL Commerce API end

    // * payment success post API start
    app.post("/payment/success", async (req, res) => {
      const { transactionId, studentRollNumber, studentRegistrationNumber } =
        req.query;

      if (!transactionId) {
        return res.redirect(
          `${process.env.CLIENT_URL}studentsDashboard/payment/fail`
        );
      }

      const updateData = {
        $set: {
          paid: true,
          paidAt: new Date(),
        },
      };

      // Update the payment information in the database
      const result = await paymentsInfoCollection.updateOne(
        { transId: transactionId },
        updateData
      );

      if (result.modifiedCount > 0) {
        let redirectUrl = `${process.env.CLIENT_URL}studentsDashboard/payment/success?transactionId=${transactionId}`;

        if (studentRollNumber && studentRegistrationNumber) {
          // If studentRollNumber and studentRegistrationNumber exist, append them to the redirect URL
          redirectUrl += `&studentRollNumber=${studentRollNumber}&studentRegistrationNumber=${studentRegistrationNumber}`;
        }

        // Redirect to the success URL
        return res.redirect(redirectUrl);
      } else {
        // Handle the case where the update was unsuccessful
        return res.redirect(
          `${process.env.CLIENT_URL}studentsDashboard/payment/fail`
        );
      }
    });
    // * payment success post API end

    // * payment failed post API start
    app.post("/payment/fail", async (req, res) => {
      const { transactionId } = req.query;
      const result = await paymentsInfoCollection.deleteOne({
        transId: transactionId,
      });
      if (result.deletedCount) {
        res.redirect(`${process.env.CLIENT_URL}studentsDashboard/payment/fail`);
      }
    });
    // * payment failed post API end
    // * payment canceled post API start
    app.post("/payment/cancel", async (req, res) => {
      const { transactionId } = req.query;
      const result = await paymentsInfoCollection.deleteOne({
        transId: transactionId,
      });
      if (result.deletedCount) {
        res.redirect(
          `${process.env.CLIENT_URL}studentsDashboard/payment/cancel`
        );
      }
    });
    // * payment canceled post API end

    // * get users payment API start
    app.get("/getUsersPayment/:transId", async (req, res) => {
      const { transId } = req.params;
      const query = { transId: transId };
      const paymentOfUser = await paymentsInfoCollection.findOne(query);
      res.send(paymentOfUser);
    });
    // * get users payment API end

    // * post a complain API start
    app.post("/complain", async (req, res) => {
      const complainData = req.body;
      const result = await complainCollection.insertOne(complainData);
      res.send(result);
    });
    // * post a complain API end

    // * get students to take attendence API start
    app.get("/getStudents", async (req, res) => {
      const { selectedClass, section } = req.query;
      const query = {
        "studentsInfo.class": selectedClass,
        "studentsInfo.section": section,
      };
      const result = await usersCollection
        .find(query)
        .project({ studentsInfo: 1, _id: 1 })
        .toArray();
      res.send(result);
    });
    // * get students to take attendence API end

    // * post attendence data API start
    app.post("/postAttendence", async (req, res) => {
      const attendenceData = req.body;
      const result = await attendenceCollection.insertOne(attendenceData);
      res.send(result);
    });
    // * post attendence data API end
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
