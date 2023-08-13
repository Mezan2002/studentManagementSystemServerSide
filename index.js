// * require start
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const app = express();
const port = process.env.PORT || 5001;
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
const rollAndRegNumberCounterCollection = client
  .db("studentManagersDBUser")
  .collection("counter");
const paymentsOccasionCollection = client
  .db("studentManagersDBUser")
  .collection("paymentsOccasion");
const paymentsInfoCollection = client
  .db("studentManagersDBUser")
  .collection("paymentsInfo");
const stuffsPaymentInfoCollection = client
  .db("studentManagersDBUser")
  .collection("stuffsPaymentInfo");
const complainCollection = client
  .db("studentManagersDBUser")
  .collection("complains");
const studentsAttendenceCollection = client
  .db("studentManagersDBUser")
  .collection("studentsAttendences");
const teachersAttendenceCollection = client
  .db("studentManagersDBUser")
  .collection("teachersAttendances");
const noticeCollection = client
  .db("studentManagersDBUser")
  .collection("notices");
const resultsCollection = client
  .db("studentManagersDBUser")
  .collection("results");
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

    // * function to get roll and registration number API start
    async function initializeCounters() {
      const counterDoc = await rollAndRegNumberCounterCollection.findOne({
        _id: "studentCounters",
      });

      if (!counterDoc) {
        // If the counters document doesn't exist, create it with initial values
        await rollAndRegNumberCounterCollection.insertOne({
          _id: "studentCounters",
          rollNumber: 100000,
          registrationNumber: 1617615000,
        });
      }
    }
    async function getNextRollAndRegistrationNumbers() {
      // Ensure the counters are initialized before updating them
      await initializeCounters();

      // Increment the counters and get the updated values
      const counterDoc =
        await rollAndRegNumberCounterCollection.findOneAndUpdate(
          { _id: "studentCounters" },
          { $inc: { rollNumber: 1, registrationNumber: 1 } },
          { returnOriginal: false }
        );
      return {
        rollNumber: counterDoc.value.rollNumber,
        registrationNumber: counterDoc.value.registrationNumber,
      };
    }

    // * function to get roll and registration number API end

    // * paymet by SSL Commerce API start
    app.post("/getPayment", async (req, res) => {
      const paymentInfo = req.body;
      const userInfo = paymentInfo.userInfo;
      const userId = paymentInfo.userId;
      const user = paymentInfo.user;
      const paymentId = paymentInfo.paymentId;
      const paymentQuery = { _id: new ObjectId(paymentId) };
      const paymentFor = await paymentsOccasionCollection.findOne(paymentQuery);
      const transId = uuidv4();
      let successURL;
      const { rollNumber, registrationNumber } =
        await getNextRollAndRegistrationNumbers();
      if (paymentFor.paymentTitle === "Exam Fee") {
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
              user,
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

      const result = await paymentsInfoCollection.updateOne(
        { transId: transactionId },
        updateData
      );

      if (result.modifiedCount > 0) {
        let redirectUrl = `${process.env.CLIENT_URL}studentsDashboard/payment/success?transactionId=${transactionId}`;

        if (studentRollNumber && studentRegistrationNumber) {
          redirectUrl += `&studentRollNumber=${studentRollNumber}&studentRegistrationNumber=${studentRegistrationNumber}`;
        }

        return res.redirect(redirectUrl);
      } else {
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

    // * get user is paid or not API start
    app.get("/user-is-paid/:id", async (req, res) => {
      const userId = req.params.id;
      const query = { userId: userId };
      const result = await paymentsInfoCollection
        .find(query)
        .project({ paymentFor: 1, paid: 1 })
        .toArray();
      res.send(result);
    });
    // * get user is paid or not API end

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
      const result = await studentsAttendenceCollection.insertOne(
        attendenceData
      );
      res.send(result);
    });
    // * post attendence data API end

    // * get student data by roll and registration number for making result API start
    app.get("/get-students-for-making-result", async (req, res) => {
      const { studentRollNumber, studentRegistrationNumber } = req.query;
      const getStudent = {
        studentRollNumber: parseInt(studentRollNumber),
        studentRegistrationNumber: parseInt(studentRegistrationNumber),
      };
      const student = await paymentsInfoCollection.findOne(getStudent);

      res.send(student);
    });
    // * get student data by roll and registration number for making result API end

    // * get single student by user ID for making result API start
    app.get("/get-student-by-userId/:userId", async (req, res) => {
      const userId = req.params.userId;
      const findStudent = { _id: new ObjectId(userId) };
      const result = await usersCollection.findOne(findStudent);
      res.send(result);
    });
    // * get single student by user ID for making result API end

    // * make notice API start
    app.post("/make-notice", async (req, res) => {
      const noticeData = req.body;
      const result = await noticeCollection.insertOne(noticeData);
      res.send(result);
    });
    // * make notice API end

    //  * add result API start
    app.post("/make-result", async (req, res) => {
      const resultsData = req.body;
      const result = await resultsCollection.insertOne(resultsData);
      res.send(result);
    });
    //  * add result API end

    // * get results API start
    app.get("/get-results", async (req, res) => {
      const { resultOfClass, section } = req.query;
      const query = { studentOfClass: resultOfClass, section: section };
      const result = await resultsCollection.find(query).toArray();
      res.send(result);
    });
    // * get results API end

    // * get all notice API start
    app.get("/get-notice", async (req, res) => {
      const query = { noticeFor: "All Students" };
      const result = await noticeCollection.find(query).toArray();
      res.send(result);
    });
    // * get all notice API end

    // * get a students result API start
    app.get("/get-single-result/:studentId", async (req, res) => {
      const studentId = req.params.studentId;
      const query = { studentId };
      const result = await resultsCollection.findOne(query);
      res.send(result);
    });
    // * get a students result API end

    // * get attendence data API start
    app.get("/get-attendence", async (req, res) => {
      const { dateOfAttendence } = req.query;
      const query = { dateOfAttendence };
      const result = await studentsAttendenceCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.send({ message: "Attendence not found for this date" });
      }
    });
    // * get attendence data API end

    // ! admins API start

    // * get all students API start
    app.get("/get-all-students", async (req, res) => {
      const query = { userType: "student" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    // * get all students API end

    // * get all teachers API start
    app.get("/get-all-teachers", async (req, res) => {
      const query = { userType: "teacher" };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    // * get all teachers API end

    // * get attendence of all students API start
    app.get("/get-students-attendance-by-class-and-date", async (req, res) => {
      const { dateOfAttendence, classOfAttendence, sectionOfAttendence } =
        req.query;
      const query = {
        "attendenceData.dateOfAttendence": dateOfAttendence,
        "attendenceData.classOfAttendence": classOfAttendence,
        "attendenceData.sectionOfAttendence": sectionOfAttendence,
      };
      const result = await studentsAttendenceCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.send({ message: "Attendence not found for this date" });
      }
    });
    // * get attendence of all students API end

    // * get attendence of all teachers API start
    app.get("/get-teachers-attendance-by-date", async (req, res) => {
      const { dateOfAttendence } = req.query;
      const query = {
        "attendenceData.dateOfAttendence": dateOfAttendence,
      };
      const result = await teachersAttendenceCollection.findOne(query);
      if (result) {
        res.send(result);
      } else {
        res.send({ message: "Attendence not found for this date" });
      }
    });
    // * get attendence of all teachers API end

    // * get individual students attendence API start
    app.get("/get-individual-student-attendance", async (req, res) => {
      const { id } = req.query;

      try {
        const allAttendance = await studentsAttendenceCollection
          .find({})
          .toArray();

        const matchingStudents = allAttendance
          .map((attendance) => {
            return (
              attendance.attendenceData.find((student) => student._id === id) ||
              null
            );
          })
          .filter((student) => student !== null); // Remove null values

        res.send(matchingStudents);
      } catch (error) {
        console.error("Error fetching individual student attendance:", error);
        res
          .status(500)
          .send({ error: "An error occurred while fetching data." });
      }
    });
    // * get individual students attendence API end

    // * get individual teachers attendence API start
    app.get("/get-individual-teacher-attendance", async (req, res) => {
      const { id } = req.query;

      try {
        const allAttendance = await teachersAttendenceCollection
          .find({})
          .toArray();

        const matchingteachers = allAttendance
          .map((attendance) => {
            return (
              attendance.attendenceData.find((student) => student._id === id) ||
              null
            );
          })
          .filter((student) => student !== null); // Remove null values

        res.send(matchingteachers);
      } catch (error) {
        console.error("Error fetching individual student attendance:", error);
        res
          .status(500)
          .send({ error: "An error occurred while fetching data." });
      }
    });
    // * get individual teachers attendence API end

    // * get all notice API start
    app.get("/all-notices", async (req, res) => {
      const query = {};
      const result = await noticeCollection.find(query).toArray();
      res.send(result);
    });
    // * get all notice API end

    // * get teachers notice API start
    app.get("/teachers-notice", async (req, res) => {
      const query = { noticeFor: "All Teachers" };
      const result = await noticeCollection.find(query).toArray();
      res.send(result);
    });
    // * get teachers notice API end

    // * get all results API start
    app.get("/get-all-results", async (req, res) => {
      const query = {};
      const result = await resultsCollection.find(query).toArray();
      res.send(result);
    });
    // * get all results API end

    // * get result classwise API start
    app.get("/get-result-classwise", async (req, res) => {
      const { studentOfClass, section } = req.query;
      const query = { studentOfClass, section };
      const result = await resultsCollection.find(query).toArray();
      res.send(result);
    });
    // * get result classwise API end

    // * get individual student results API start
    app.get("/get-individual-student-result", async (req, res) => {
      const { studentsRollNumber, studentsRegistrationNumber } = req.query;
      const query = { studentsRollNumber, studentsRegistrationNumber };
      if (query) {
        const result = await resultsCollection.findOne(query);
        res.send(result);
      } else {
        res.send({ message: "No results found" });
      }
    });
    // * get individual student results API end

    // * get all students payment API start
    app.get("/get-all-students-payment", async (req, res) => {
      try {
        const query = {};
        const result = await paymentsInfoCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    // * get all students payment API end

    // * get individual students payment API start
    app.get("/get-individual-student-payments", async (req, res) => {
      const { id } = req.query;
      const query = {};
      const result = await paymentsInfoCollection.find(query).toArray();
      res.send(result);
    });
    // * get individual students payment API end

    // * get stuffs payment API start
    app.get("/get-stuffs-payment", async (req, res) => {
      const query = {};
      const result = await stuffsPaymentInfoCollection.find(query).toArray();
      res.send(result);
    });
    // * get stuffs payment API end

    // * get individual users data API start
    app.get("/get-individual-students-data-by-id/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    // * get individual users data API end

    // ! admins API end

    // ! temp

    app.post("/stuffs-payment", async (req, res) => {
      const data = req.body;
      const result = await stuffsPaymentInfoCollection.insertOne(data);
      res.send(result);
    });

    app.post("/teachersAdd", async (req, res) => {
      const data = req.body;
      const result = await teachersAttendenceCollection.insertOne(data);
      res.send(result);
    });
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
