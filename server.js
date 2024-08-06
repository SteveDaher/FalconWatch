const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // For generating unique incident IDs
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const port = 3000;

app.use(bodyParser.json({ limit: '50mb' })); // Increase payload size limit
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/falconwatch');

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
  date: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Ensure this line exists
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

// Report submission endpoint
app.post('/report', async (req, res) => {
  try {
    const { name, category, description, coordinates, picture, userId } = req.body;
    console.log('Received userId:', userId); // Debug: log the received userId

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const severity = await classifySeverity(description);
    console.log(`Severity classified as: ${severity}`);

    const incidentId = await getNextIncidentId();
    const report = new Report({
      incidentId,
      name,
      category,
      description,
      severity,
      coordinates,
      picture,
      date: new Date(),
      userId: new mongoose.Types.ObjectId(userId) // Convert userId to ObjectId
    });

    await report.save();
    res.status(200).json(report);
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Error submitting report' });
  }
});

// Get reports for the logged-in user
app.get('/reports', async (req, res) => {
  try {
    const userId = req.query.userId; // Assuming userId is passed as a query parameter
    console.log('Fetching reports for userId:', userId); // Debug: log the userId for fetching reports
    const reports = await Report.find({ userId: new mongoose.Types.ObjectId(userId) });
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Error fetching reports' });
  }
});

app.get('/crime-summary', async (req, res) => {
  try {
    const userId = req.query.userId;
    console.log('Fetching crime summary for userId:', userId);

    const summary = await Report.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } }, // Ensure only user-specific data is fetched
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
// Endpoint to fetch crime data by month and category
app.get('/crime-summary-category', async (req, res) => {
  try {
    const userId = req.query.userId;
    const month = req.query.month || '';

    // Prepare the MongoDB query based on the month parameter
    let matchStage = { userId: new mongoose.Types.ObjectId(userId) };

    if (month) {
      const [year, monthNumber] = month.split('-');
      // Convert monthNumber to integer and create date range
      const startDate = new Date(`${year}-${monthNumber}-01T00:00:00.000Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + 1);

      matchStage.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const data = await Report.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          category: "$_id",
          count: 1
        }
      }
    ]);

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching crime data:', error);
    res.status(500).json({ error: 'Internal server error' });
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