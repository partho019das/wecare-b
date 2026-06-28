// /server/index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden" });
    }

    req.user = decoded;
    next();
  });
};

async function run() {
  await client.connect();

  const db = client.db("docter");
  const doctors = db.collection("docter");
  const appointments = db.collection("appointments");

  app.get("/", (req, res) => {
    res.send("WeCare backend running");
  });

  app.get("/docter", async (req, res) => {
    const result = await doctors.find().toArray();
    res.send(result);
  });

  app.get("/docter/:id", async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid doctor id" });
    }

    const result = await doctors.findOne({ _id: new ObjectId(id) });

    if (!result) {
      return res.status(404).send({ message: "Doctor not found" });
    }

    res.send(result);
  });

  app.post("/jwt", (req, res) => {
    const user = req.body;

    if (!user?.email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const token = jwt.sign(
      { email: user.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    res.send({ token });
  });

  app.post("/api/appointments", verifyToken, async (req, res) => {
    const data = {
      ...req.body,
      email: req.user.email,
      createdAt: new Date(),
    };

    const result = await appointments.insertOne(data);
    res.status(201).send(result);
  });

  app.get("/api/appointments", verifyToken, async (req, res) => {
    const result = await appointments
      .find({ email: req.user.email })
      .toArray();

    res.send(result);
  });

  app.delete("/api/appointments/:id", verifyToken, async (req, res) => {
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid appointment id" });
    }

    const result = await appointments.deleteOne({
      _id: new ObjectId(id),
      email: req.user.email,
    });

    res.send(result);
  });

  console.log("MongoDB connected");
}

run().catch(console.error);

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});