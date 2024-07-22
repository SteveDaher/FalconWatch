const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();

const port = 3000;

app.use(bodyParser.json({ limit: '50mb' }));

mongoose.connect('mongodb://localhost:27017/falconwatch', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const reportSchema = new mongoose.Schema({
  name: String,
  category: String,
  description: String,
  severity: String,
  coordinates: [Number],
  picture: String,
  date: { type: Date, default: Date.now } // Add date field with default value
});

const Report = mongoose.model('Report', reportSchema);

app.post('/report', async (req, res) => {
  try {
    const reportData = req.body;
    const report = new Report({
      name: reportData.name,
      category: reportData.category,
      description: reportData.description,
      severity: reportData.severity,
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
