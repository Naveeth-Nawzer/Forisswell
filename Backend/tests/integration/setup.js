const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const connectDB = require("../../config/db");

let mongoServer;

const clearDatabase = async () => {
  if (mongoose.connection.readyState !== 1) return;

  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({})));
};

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

  mongoServer = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongoServer.getUri("forisswell_test");

  await connectDB();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
  } finally {
    if (mongoServer) {
      await mongoServer.stop();
    }
  }
});
