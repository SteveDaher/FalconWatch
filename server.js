const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const port = 3000;
const { v4: uuidv4 } = require('uuid'); // For generating unique incident IDs
const { spawn } = require('child_process');
const path = require('path');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/falconwatch', { useNewUrlParser: true, useUnifiedTopology: true });

// Define schemas and models
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true } // Note: Storing plain-text passwords is insecure
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

// Middleware setup
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Function to classify severity
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
    const user = new User({ name, email, phone, password });
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
    if (!user || user.password !== password) {
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
    const severity = await classifySeverity(reportData.description);
    console.log(`Severity classified as: ${severity}`);

    const incidentId = await getNextIncidentId();
    const report = new Report({
      incidentId,
      name: reportData.name,
      category: reportData.category,
      description: reportData.description,
      severity,
      coordinates: reportData.coordinates,
      picture: reportData.picture,
      date: new Date()
    });

    await report.save();
    res.status(200).json(report);
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Error submitting report' });
  }
});

// Get all reports
app.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find({});
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

// Get crime summary by severity for each month
app.get('/crime-summary', async (req, res) => {
  try {
    const summary = await Report.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            severity: "$severity"
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          severity: "$_id.severity",
          count: 1
        }
      },
      {
        $sort: { year: 1, month: 1, severity: 1 }
      }
    ]);

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching crime summary:', error);
    res.status(500).json({ message: 'Error fetching crime summary' });
  }
});


// Delete a report by incident ID
app.delete('/report/:id', async (req, res) => {
  try {
    await Report.findOneAndDelete({ incidentId: req.params.id });
    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Error deleting report' });
  }
});

// Serve static files from the current directory
app.use(express.static('.'));

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
