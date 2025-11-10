const express = require('express');
    const mongoose = require('mongoose');
    const cors = require('cors');
    require('dotenv').config();

    const app = express();
    const PORT = process.env.PORT || 5000;

    // --- Middleware ---
    app.use(cors()); // Allow cross-origin requests
    app.use(express.json({ limit: '5mb' })); // To parse JSON request bodies and set a limit for images

    // --- MongoDB Connection ---
    mongoose.connect(process.env.MONGO_DB_CONNECTION_STRING)
        .then(() => console.log('Successfully connected to MongoDB Atlas.'))
        .catch(err => console.error('Connection error', err));

    // --- Mongoose Schema and Model ---
    // This schema MUST match the structure of the 'Report' type in your frontend.
    const reportSchema = new mongoose.Schema({
        id: { type: String, required: true, unique: true },
        date: { type: String, required: true },
        patient: {
            name: String,
            age: String,
            gender: String,
            contact: String,
            email: String,
        },
        symptoms: [String],
        result: {
            predictedDisease: String,
            description: String,
            precautions: [String],
            medications: [String],
            diet: [String],
            disclaimer: String,
        },
        image: String, // Stores the base64 string of the image
    });

    const Report = mongoose.model('Report', reportSchema);

    // --- API Routes ---

    // GET all reports
    app.get('/api/reports', async (req, res) => {
        try {
            const reports = await Report.find().sort({ id: -1 }); // Sort by most recent
            res.json(reports);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching reports', error });
        }
    });
    
    // GET reports for a specific user
    app.get('/api/reports/user', async (req, res) => {
        const { name, age } = req.query;
        if (!name || !age) {
            return res.status(400).json({ message: 'Name and age are required query parameters.' });
        }
        try {
            // Case-insensitive search
            const reports = await Report.find({
                'patient.name': new RegExp(`^${name}$`, 'i'),
                'patient.age': age
            }).sort({ id: -1 });
            res.json(reports);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching user reports', error });
        }
    });

    // POST a new report
    app.post('/api/reports', async (req, res) => {
        try {
            const newReport = new Report(req.body);
            await newReport.save();
            res.status(201).json({ message: 'Report saved successfully!', report: newReport });
        } catch (error) {
            res.status(400).json({ message: 'Error saving report', error });
        }
    });

    // --- Start the server ---
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });