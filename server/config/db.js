const mongoose = require('mongoose');
async function connectDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  try {
    await mongoose.connect(process.env.MONGODB_URI);
  } catch (error) {
    throw new Error(
      `MongoDB connection failed. Check server/.env MONGODB_URI, Atlas network access, and database credentials. ${error.message}`
    );
  }
}
module.exports = connectDb;
