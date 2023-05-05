require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middle wares
app.use(cors());
app.use(express.json());

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
    //   ================== Database collections Here ==================

    // Use Aggregate to query multiple collection nad then marge data
    app.get("/appointment_services", async (req, res) => {
      const date = req.query.date;
      const query = {};
      const services = await appointmentServicesCollections.find(query).toArray();
    //   get the bookings off the provided date 
      const bookingQuery = {appointmentDate: date};
      const alreadyBooked = await bookingsCollections.find(bookingQuery).toArray();

      services.forEach(service => {
        const serviceBooked= alreadyBooked.filter(book => book.treatment === service.service)
        const bookedSlots = serviceBooked.map(book => book.slot)
        const remainingSlots = service.slots.filter(slot => !bookedSlots.includes(slot))
        service.slots = remainingSlots;
      })
      res.send(services);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        treatment: booking.treatment,
        parentID: booking.parentID
      }
      const alreadyBooked =  await bookingsCollections.find(query).toArray();
      if(alreadyBooked.length){
        const message = `you have already booked on ${booking.appointmentDate}`
        return res.send({acknowledge: false, message})
      }
      const result = await bookingsCollections.insertOne(booking);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

app.get("/", (req, res) => {
  res.send(`Doctors Portal server is running on port ${port}`);
});

app.listen(port, () => {
  console.log(`Doctors Portal Example app listening on port ${port}`);
});
