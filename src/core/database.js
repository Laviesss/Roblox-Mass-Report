const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI not found in environment variables.");
        }
        const conn = await mongoose.connect(uri);
        console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`[Database] Error: ${err.message}`);
        // Don't exit process in development if MongoDB is not available, but user needs it for production
        if (process.env.NODE_ENV === 'production') process.exit(1);
    }
};

module.exports = connectDB;
