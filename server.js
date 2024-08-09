const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid'); // For generating unique incident IDs
const { spawn } = require('child_process');
const path = require('path');


// For real time data
const http = require('http'); // Import http module
const socketIo = require('socket.io'); // Import Socket.IO


const app = express();

// For server 
const server = http.createServer(app); // Create a server with http
const io = socketIo(server); // Initialize Socket.IO with the server

const port = 3000;

app.use(bodyParser.json({ limit: '100mb' })); // Increase payload size limit
app.use(bodyParser.urlencoded({ extended: true }));


// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/falconwatch');

// Define schemas and models
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String},
  phone: String,
  password: { type: String, required: true }, // Note: Storing plain-text passwords is insecure
  badgeNumber: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ['civilian', 'police'], default: 'civilian' }
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

const badgeSchema = new mongoose.Schema({
  badgeNumber: { type: String, required: true, unique: true }
});
const Badge = mongoose.model('Badge', badgeSchema);

// Middleware setup
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

async function addPlaceholderBadges() {
  const badges = ['POLICE123', 'POLICE456', 'POLICE789'];
  for (const badge of badges) {
    try {
      await Badge.updateOne({ badgeNumber: badge }, { badgeNumber: badge }, { upsert: true });
      console.log(`Badge ${badge} added or updated`);
    } catch (error) {
      console.error('Error adding badge:', badge, error);
    }
  }
}
addPlaceholderBadges();

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

// Handle police registration
app.post('/registerPolice', async (req, res) => {
  try {
    const { name, badgeNumber, password } = req.body;

    console.log(`Registering police with badge number: ${badgeNumber}`);
    const badge = await Badge.findOne({ badgeNumber });
    if (!badge) {
      console.log(`Badge number ${badgeNumber} not found`);
      return res.status(400).json({ message: 'Invalid badge number' });
    }

    const user = new User({ name, password, badgeNumber, role: 'police' });
    await user.save();
    res.redirect('/login.html');  // Redirect to login page after successful registration
  } catch (error) {
    console.error('Error registering police:', error);
    res.status(500).json({ message: 'Error registering police' });
  }
});

// Handle user login
app.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ email: identifier }, { badgeNumber: identifier }] });

    if (!user || user.password !== password) {
      return res.status(400).json({ message: 'Invalid email/badge number or password' });
    }

    // Send the user details in the response
    res.status(200).json({ userId: user._id, role: user.role, name: user.name });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});


// Get user role
app.get('/userRole', async (req, res) => {
  try {
    const userId = req.query.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ role: user.role });
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ message: 'Error fetching user role' });
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

// Get all reports (only for police)
app.get('/all-reports', policeAuth, async (req, res) => {
  try {
    const reports = await Report.find({});
    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching all reports:', error);
    res.status(500).json({ error: 'Error fetching all reports' });
  }
});

function policeAuth(req, res, next) {
  const userId = req.query.userId;
  User.findById(userId).then(user => {
    if (!user) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (user.role !== 'police') {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  }).catch(err => {
    console.error('Error finding user:', err);
    return res.status(500).json({ message: 'Error finding user' });
  });
}

app.get('/crime-summary', async (req, res) => {
  try {
    const userId = req.query.userId;
    const month = req.query.month;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const matchStage = { userId: new mongoose.Types.ObjectId(userId) };

    if (month) {
      const [year, monthNumber] = month.split('-');
      const startDate = new Date(`${year}-${monthNumber}-01T00:00:00Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      matchStage.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const summary = await Report.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          // Adjust the date to Dubai timezone (UTC+4)
          adjustedDate: {
            $dateAdd: {
              startDate: "$date",
              unit: "hour",
              amount: 4
            }
          }
        }
      },
      {
        $addFields: {
          // Extract hour in Dubai timezone
          hour: { $hour: "$adjustedDate" }
        }
      },
      {
        $group: {
          _id: {
            hour: "$hour",
            category: "$category"
          },
          count: { $sum: 1 },
          incidentIds: { $push: "$incidentId" }
        }
      },
      {
        $project: {
          _id: 0,
          hour: "$_id.hour",
          category: "$_id.category",
          count: 1,
          incidentIds: 1
        }
      },
      {
        $sort: { hour: 1, category: 1 }
      }
    ]);

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching crime summary:', error);
    res.status(500).json({ message: 'Error fetching crime summary' });
  }
});


app.get('/all-crime-summary', policeAuth, async (req, res) => {
  try {
    console.log('Fetching all crime summary');

    const month = req.query.month;

    const matchStage = {};

    if (month) {
      const [year, monthNumber] = month.split('-');
      const startDate = new Date(`${year}-${monthNumber}-01T00:00:00Z`);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);

      matchStage.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    const summary = await Report.aggregate([
      { $match: matchStage },
      {
        $addFields: {
          // Adjust the date to Dubai timezone (UTC+4)
          adjustedDate: {
            $dateAdd: {
              startDate: "$date",
              unit: "hour",
              amount: 4
            }
          }
        }
      },
      {
        $addFields: {
          // Extract hour in Dubai timezone
          hour: { $hour: "$adjustedDate" }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$adjustedDate" },
            month: { $month: "$adjustedDate" },
            severity: "$severity",
            hour: "$hour",
            category: "$category"
          },
          count: { $sum: 1 },
          incidentIds: { $push: "$incidentId" }
        }
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          severity: "$_id.severity",
          hour: "$_id.hour",
          category: "$_id.category",
          count: 1,
          incidentIds: 1
        }
      },
      {
        $sort: { year: 1, month: 1, hour: 1, category: 1 }
      }
    ]);

    res.status(200).json(summary);
  } catch (error) {
    console.error('Error fetching all crime summary:', error);
    res.status(500).json({ message: 'Error fetching all crime summary' });
  }
});

// Endpoint to fetch crime data by month and severity for police
app.get('/crime-summary-severity', policeAuth, async (req, res) => {
  try {
    const month = req.query.month || '';
    
    let matchStage = {};

    if (month) {
      const [year, monthNumber] = month.split('-');
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
          _id: "$severity",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          severity: "$_id",
          count: 1
        }
      }
    ]);

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching crime data by severity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/crime-trends', policeAuth, async (req, res) => {
  try {
    const { year } = req.query;

    const startDate = new Date(`${year}-01-01T00:00:00Z`);
    const endDate = new Date(`${year}-12-31T23:59:59Z`);

    const data = await Report.aggregate([
      { 
        $match: {
          date: {
            $gte: startDate,
            $lt: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            severity: '$severity'
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          severity: '$_id.severity',
          count: 1
        }
      },
      { $sort: { year: 1, month: 1, severity: 1 } }
    ]);

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching crime trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// Endpoint to fetch crime data by month and category for police
app.get('/crime-summary-category', policeAuth, async (req, res) => {
  try {
    const month = req.query.month || '';
    
    let matchStage = {};

    if (month) {
      const [year, monthNumber] = month.split('-');
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


// CONNECTION
io.on('connection', async (socket) => {
  const userId = socket.handshake.query.userId;
  const user = await User.findById(userId);

  if (user && user.role === 'police') {
      socket.user = user;
      console.log(`New police client connected: ${user.name}`);

      socket.on('userLocation', (locationData) => {
        console.log(`Received location update for: ${locationData.userName}`, locationData);
        io.emit('locationUpdate', {
            userId: user._id,
            coordinates: locationData.coordinates,
            timestamp: locationData.timestamp,
            userName: user.name,
            role: user.role // Include role
        });
      });
  } else {
      console.log('Access denied: non-police client attempted to connect');
      socket.disconnect(true);
  }

  socket.on('disconnect', () => {
      console.log(`Client disconnected: ${user ? user.name : 'unknown user'}`);
  });
});


// Serve static files from the current directory
app.use(express.static('.'));

// Set default route to typeofuser.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'userType.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'register.html'));
});

app.get('/registerPolice.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'registerPolice.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/userType.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'userType.html'));
});

app.get('/main.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});

app.get('/report.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'report.html'));
});

app.get('/chart.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chart.html'));
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
