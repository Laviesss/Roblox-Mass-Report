const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roblox-management-suite');
        console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(`[Database] Error: ${err.message}`);
        // Don't exit process in development if MongoDB is not available, but user needs it for production
        if (process.env.NODE_ENV === 'production') process.exit(1);
    }
};

module.exports = connectDB;
