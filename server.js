const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const port = 3000;
const { v4: uuidv4 } = require('uuid'); // For generating unique incident IDs
const { spawn } = require('child_process');
const path = require('path');

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

mongoose.connect('mongodb://localhost:27017/falconwatch', { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    phone: String,
    password: { type: String, required: true }
});

const User = mongoose.model('User', userSchema);

const reportSchema = new mongoose.Schema({
    incidentId: { type: Number, required: true, unique: true },
    name: String,
    category: String,
    description: String,
    severity: String,
    coordinates: [Number],
    picture: String,
    date: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

// Function to classify report priority using NLP
async function classifySeverity(description) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [path.join(__dirname, 'classify_severity.py'), description]);

    let result = '';
    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(`Python process exited with code ${code}`);
      } else {
        resolve(result.trim());
      }
    });
  });
}

// Function to get the next incident ID
async function getNextIncidentId() {
  const lastReport = await Report.findOne({}, 'incidentId').sort({ incidentId: -1 });
  return lastReport ? lastReport.incidentId + 1 : 1;
}

// Handle user registration
app.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        // Since we're not using bcrypt, we'll skip password hashing
        const user = new User({
            name,
            email,
            phone,
            password // Insecure: Storing plain-text passwords, not recommended
        });

        await user.save();
        res.status(200).json({ message: 'Registration successful', userId: user._id });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

// Handle user login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        // Since we're not using bcrypt, we'll skip password comparison
        if (user.password !== password) { // Insecure: Plain-text password comparison
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        res.status(200).json({ message: 'Login successful', userId: user._id });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// Handle report submission
app.post('/report', async (req, res) => {
  try {
    const reportData = req.body;
    const severity = await classifySeverity(reportData.description); // Classify severity using NLP
    console.log(`Severity classified as: ${severity}`); // Log the severity for debugging

    // Get the next incident ID
    const incidentId = await getNextIncidentId();

    const report = new Report({
      incidentId: incidentId,
      name: reportData.name, // Ensure this field is handled correctly
      category: reportData.category,
      description: reportData.description,
      severity: severity,
      coordinates: reportData.coordinates,
      picture: reportData.picture,
      date: new Date() // Set current date and time
    });

    await report.save();
    res.status(200).json({
      incidentId: report.incidentId,
      name: report.name,
      category: report.category,
      description: report.description,
      severity: report.severity,
      coordinates: report.coordinates,
      picture: report.picture,
      date: report.date
    });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Error submitting report' });
  }
});

app.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find({});
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

app.delete('/report/:id', async (req, res) => {
  try {
    await Report.findOneAndDelete({ incidentId: req.params.id });
    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Error deleting report' });
  }
});

app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
