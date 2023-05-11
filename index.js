require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

// middle wares
app.use(cors());
app.use(express.json());

function verifyJWT(req, res, next) {
  console.log("token", req.headers.authorization);
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.elpkqgt.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });

    //   ================== Database collections Here ==================
    const appointmentServicesCollections = client
      .db("doctorsPortal")
      .collection("appointmentServices");
    const bookingsCollections = client
      .db("doctorsPortal")
      .collection("bookings");
    const allUsersCollections = client
      .db("doctorsPortal")
      .collection("allUsers");
    //   ================== Database collections Here ==================

    // Use Aggregate to query multiple collection nad then marge data

    app.get("/all_users", async (req, res) => {
      const query = {};
      const allUsers = await allUsersCollections.find(query).toArray();
      res.send(allUsers);
    });
    app.get('/all_users/admin/:email', async (req, res) => {
      const email = req.params.email;
      const query = {email};
      const user = await allUsersCollections.findOne(query);
      res.send({isAdmin: user?.role === 'admin'});
    })
    app.post("/all_users", async (req, res) => {
      const userData = req.body;
      const result = await allUsersCollections.insertOne(userData);
      res.send(result);
    });
    app.put("/all_users/admin/:id", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await allUsersCollections.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await allUsersCollections.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });
    app.get("/my_appointments", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const myAppointments = await bookingsCollections.find(query).toArray();
      res.send(myAppointments);
    });

    app.get("/appointment_services", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const services = await appointmentServicesCollections
        .find(query)
        .toArray();
      //   get the bookings off the provided date
      const bookingQuery = { appointmentDate: date };
      const alreadyBooked = await bookingsCollections
        .find(bookingQuery)
        .toArray();

      services.forEach((service) => {
        const serviceBooked = alreadyBooked.filter(
          (book) => book.treatment === service.service
        );
        const bookedSlots = serviceBooked.map((book) => book.slot);
        const remainingSlots = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = remainingSlots;
      });
      res.send(services);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        treatment: booking.treatment,
        parentID: booking.parentID,
      };
      const alreadyBooked = await bookingsCollections.find(query).toArray();
      if (alreadyBooked.length) {
        const message = `you have already booked on ${booking.appointmentDate}`;
        return res.send({ acknowledge: false, message });
      }
      const result = await bookingsCollections.insertOne(booking);
      res.send(result);
    });
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await allUsersCollections.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN,);
        return res.send({ accessToken: token });
      }
      console.log(user);
      res.status(403).send({ accessToken: "" });
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send(`Doctors Portal server is running on port ${port}`);
});

app.listen(port, () => {
  console.log(`Doctors Portal Example app listening on port ${port}`);
});
