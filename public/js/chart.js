document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken'); // Retrieve the auth token from localStorage

    // Check if the token exists, if not redirect to the login page
    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        window.location.href = '/login.html';
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
            const errorText = await userInfoResponse.text();
            console.error('Failed to fetch user info:', errorText);
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
        const pageContent = document.querySelector('body');

        // Explicitly set the display property to make sure it's visible
        pageContent.style.display = 'block'; // Ensure page content is displayed


        console.log("Page content is now visible.");

        // Fetch chart data since the user is authorized
        const response = await fetch('/api/chartData', {
            headers: {
                'Authorization': `Bearer ${token}` // Attach the token in the request header
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch chart data:', errorText);
            throw new Error('Failed to fetch chart data');
        }

        let data = await response.json();

        // Ensure the data is in an array format, convert if necessary
        if (!Array.isArray(data)) {
            console.warn('Data is not an array. Converting to an array.');
            data = [data];
        }

        // Call function to render the chart using the fetched data
        renderChart(data);
    } catch (error) {
        console.error('Error during execution:', error);
        alert('Failed to load chart data. Please try again.');
    }
});

/**
 * Function to render the bar chart using Chart.js.
 * @param {Array} data - Array of data objects from the API.
 */
function renderChart(data) {
    const monthlyData = {}; // Object to accumulate monthly data for different severities

    // Process the data and aggregate it by month and severity
    data.forEach(item => {
        const month = `${item.year}-${item.month.toString().padStart(2, '0')}`; // Format month as YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { low: 0, medium: 0, high: 0 }; // Initialize severity counts
        }
        monthlyData[month][item.severity.toLowerCase()] += item.count; // Increment counts by severity
    });

    // Extract labels (months) and datasets (low, medium, high severity counts)
    const labels = Object.keys(monthlyData);
    const lowData = labels.map(month => monthlyData[month].low || 0); // Low severity data
    const mediumData = labels.map(month => monthlyData[month].medium || 0); // Medium severity data
    const highData = labels.map(month => monthlyData[month].high || 0); // High severity data

    // Create a bar chart using Chart.js
    const ctx = document.getElementById('myBarChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels, // X-axis labels (months)
            datasets: [
                {
                    label: 'Low Severity', // Dataset for low severity crimes
                    data: lowData, // Data for low severity
                    backgroundColor: 'rgba(76, 175, 80, 0.5)', // Bar color
                    borderColor: 'rgba(76, 175, 80, 1)', // Bar border color
                    borderWidth: 1,
                    barThickness: 10 // Bar thickness
                },
                {
                    label: 'Medium Severity', // Dataset for medium severity crimes
                    data: mediumData, // Data for medium severity
                    backgroundColor: 'rgba(255, 235, 59, 0.5)', // Bar color
                    borderColor: 'rgba(255, 235, 59, 1)', // Bar border color
                    borderWidth: 1,
                    barThickness: 10 // Bar thickness
                },
                {
                    label: 'High Severity', // Dataset for high severity crimes
                    data: highData, // Data for high severity
                    backgroundColor: 'rgba(244, 67, 54, 0.5)', // Bar color
                    borderColor: 'rgba(244, 67, 54, 1)', // Bar border color
                    borderWidth: 1,
                    barThickness: 10 // Bar thickness
                }
            ]
        },
        options: {
            responsive: true, // Ensure the chart is responsive to window size
            plugins: {
                legend: {
                    position: 'top' // Position the legend at the top of the chart
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`; // Custom tooltip format
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true, // Stack the bars on the X-axis
                    title: {
                        display: true,
                        text: 'Month' // X-axis title
                    }
                },
                y: {
                    stacked: true, // Stack the bars on the Y-axis
                    beginAtZero: true, // Start the Y-axis at zero
                    title: {
                        display: true,
                        text: 'Number of Crimes' // Y-axis title
                    }
                }
            }
        }
    });
}
