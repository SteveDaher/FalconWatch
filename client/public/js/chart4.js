// Path: client/public/js/chart4.js

let myChart = null; // Declare a global variable for the chart instance

// Colors to represent the severity of crimes
const severityColors = {
  'low': '#4CAF50',    // Green for low severity
  'medium': '#FFEB3B', // Yellow for medium severity
  'high': '#F44336'    // Red for high severity
};

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('authToken'); // Retrieve the authentication token

  // Hide content initially
  const pageContent = document.querySelector('.page-content');
  pageContent.style.display = 'none';

  // Redirect to login if token is missing
  if (!token) {
    console.error('No authentication token found. Redirecting to login.');
    window.location.href = '/html/login.html';
    return;
  }

  try {
    // Fetch user information to check their role
    const userInfoResponse = await fetch('/api/user-info', {
      headers: {
        'Authorization': `Bearer ${token}` // Attach the token in the request header
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info.');
    }

    const userInfo = await userInfoResponse.json();

    // Redirect the user if they are not 'police'
    if (userInfo.role !== 'police') {
      console.error('Access denied. Redirecting to login.');
      window.location.href = '/html/login.html';
      return;
    }

    // Now that the user is authorized, show the page content
    pageContent.style.display = 'block';

    // Fetch initial data when the page loads
    await fetchCrimeData(token);

  } catch (error) {
    console.error('Error during initialization:', error);
    alert('An error occurred during initialization.');
    window.location.href = '/html/main.html'; // Redirect to main page if there's an error
  }

  // Event listener for year selection change
  document.getElementById('yearFilter').addEventListener('change', async () => {
    await fetchCrimeData(token); // Fetch new data when a different year is selected
  });

  fetch('/api/user-info', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
})
.then(response => response.json())
.then(data => {
    const userNameElement = document.getElementById('user-name');
    userNameElement.textContent = data.name || "Guest"; // Update with fetched name or default to 'Guest'
})
.catch(error => console.error('Error fetching user info:', error));

document.getElementById('signout-link').addEventListener('click', () => {
  localStorage.removeItem('authToken'); // Clear the authentication token
  localStorage.removeItem('role');      // Clear any stored user role
  window.location.href = '/html/login.html'; // Redirect to the login page
});

});


/**
 * Function to fetch crime data based on the selected year.
 * @param {string} token - Authorization token for the API request.
 */
async function fetchCrimeData(token) {
  try {
    const userId = localStorage.getItem('userId'); // Get the user ID from localStorage
    const year = document.getElementById('yearFilter').value; // Get the selected year

    // Make a request to the API to fetch crime data for the selected year
    const response = await fetch(`/api/chartData?userId=${userId}&year=${year}`, {
      headers: {
        'Authorization': `Bearer ${token}` // Include the token in the headers for authorization
      }
    });

    // Handle non-OK responses
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json(); // Parse the response JSON

    // If the data array is empty or invalid, throw an error
    if (!Array.isArray(data) || data.length === 0) {
      console.error('No data available:', data);
      throw new Error('No data available for the selected period.');
    }

    // Prepare data for the chart
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const labels = months.map((month, index) => `${year}-${String(index + 1).padStart(2, '0')}`); // Format the months

    // Map each severity (low, medium, high) to a dataset for the bar chart
    const severities = ['low', 'medium', 'high'];
    const datasets = severities.map(severity => {
      return {
        label: severity.charAt(0).toUpperCase() + severity.slice(1), // Capitalize the severity label
        data: labels.map(label => {
          const [y, m] = label.split('-'); // Extract year and month
          return data.filter(d => d.year === parseInt(y) && d.month === parseInt(m) && d.severity === severity)
                     .reduce((sum, item) => sum + item.count, 0); // Sum the counts for each severity in the month
        }),
        backgroundColor: severityColors[severity], // Color for each severity
        stack: 'severity', // Stack the bars by severity
        barThickness: 10 // Adjust the thickness of the bars
      };
    });

    // Calculate total crimes for each month and add it as a line dataset
    const totalCrimesData = labels.map(label => {
      const [y, m] = label.split('-'); // Extract year and month
      return data.filter(d => d.year === parseInt(y) && d.month === parseInt(m))
                 .reduce((sum, item) => sum + item.count, 0); // Sum all crimes for the month
    });

    datasets.push({
      label: 'Total Crimes',
      data: totalCrimesData, // Add total crimes as a line dataset
      type: 'line',
      fill: false,
      borderColor: '#000', // Black line for total crimes
      backgroundColor: '#000',
      tension: 0.4,
      borderWidth: 1,
      radius: 0 // No points on the line
    });

    // Get the canvas context to draw the chart
    const ctx = document.getElementById('myChart').getContext('2d');

    // Destroy the previous chart instance if it exists
    if (myChart) {
      myChart.destroy();
    }

    // Create the new bar chart
    myChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: months, // Use month names as labels on the x-axis
        datasets: datasets // Use the datasets for each severity and total crimes
      },
      options: {
        responsive: true, // Make the chart responsive
        maintainAspectRatio: false, // Disable maintaining aspect ratio to fit the container
        scales: {
          x: {
            stacked: true, // Stack the bars on the x-axis
            title: {
              display: true,
              text: 'Month' // Label for the x-axis
            },
            grid: {
              display: false // Disable the x-axis grid
            },
            barPercentage: 0.6 // Adjust the bar thickness
          },
          y: {
            stacked: true, // Stack the bars on the y-axis
            beginAtZero: true, // Ensure the y-axis starts at zero
            title: {
              display: true,
              text: 'Number of Crimes' // Label for the y-axis
            },
            grid: {
              borderDash: [5, 5] // Dashed grid lines for better readability
            }
          }
        },
        plugins: {
          legend: {
            position: 'top', // Position the legend at the top of the chart
            labels: {
              boxWidth: 20, // Adjust legend box width
              boxHeight: 2 // Adjust legend box height
            }
          },
          tooltip: {
            callbacks: {
              label: function(tooltipItem) {
                return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`; // Customize the tooltip content
              }
            }
          }
        },
        interaction: {
          intersect: false // Disable intersection behavior for tooltips
        }
      }
    });

  } catch (error) {
    console.error('Error fetching crime data:', error); // Log any errors during data fetching
  }
}
