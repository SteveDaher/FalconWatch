// server/src/severity_classifier.js
const { spawn } = require('child_process');
const path = require('path');

function classifyCrimeSeverity(description, category) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python', [
      path.join(__dirname, 'classify_severity.py'),
      description,
      category
    ]);

    let result = '';

    pythonProcess.stdout.on('data', (data) => {
      result += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Python Error: ${data}`);
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

module.exports = { classifyCrimeSeverity };