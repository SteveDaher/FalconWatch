const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const port = 3000;

app.use(bodyParser.json({ limit: '50mb' }));

mongoose.connect('mongodb://localhost:27017/falconwatch', {});

const reportSchema = new mongoose.Schema({
  name: String,
  category: String,
  description: String,
  severity: String,
  coordinates: [Number],
  picture: String,
  date: { type: Date, default: Date.now }
});

const Report = mongoose.model('Report', reportSchema);

const { spawn } = require('child_process');
const path = require('path');

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

app.post('/report', async (req, res) => {
  try {
    const reportData = req.body;
    const severity = await classifySeverity(reportData.description); // Classify severity using NLP
    console.log(`Severity classified as: ${severity}`); // Log the severity for debugging
    const report = new Report({
      name: reportData.name,
      category: reportData.category,
      description: reportData.description,
      severity: severity,
      coordinates: reportData.coordinates,
      picture: reportData.picture,
      date: new Date() // Set current date and time
    });
    await report.save();
    res.status(200).send('Report submitted successfully');
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).send('Error submitting report');
  }
});

app.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find({});
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).send('Error fetching reports');
  }
});

app.delete('/report/:id', async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.status(200).send('Report deleted successfully');
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).send('Error deleting report');
  }
});

app.use(express.static('.'));

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
