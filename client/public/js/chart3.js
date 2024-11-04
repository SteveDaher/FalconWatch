// Path: client/public/js/chart3.js

let myChart; // Declare a global variable to store the chart instance

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken'); // Retrieve the authentication token

    // Hide content initially
    const pageContent = document.querySelector('.page-content');
    pageContent.style.display = 'none';

    // If no token is found, redirect to the login page
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

        // Populate the month dropdown and fetch initial crime data
        populateMonths();
        await fetchCrimeData(); // Fetch data for the selected month

        // Fetch new data when the month selection changes
        document.getElementById('month').addEventListener('change', async () => {
            await fetchCrimeData(); // Fetch data for the newly selected month
        });

    } catch (error) {
        console.error('Error during initialization:', error);
        window.location.href = '/html/login.html'; // Redirect to login on error
    }

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
 * Function to populate the month dropdown with options.
 */
function populateMonths() {
    const months = [
        '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
        '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'
    ]; // List of months

    const select = document.getElementById('month');
    select.innerHTML = '<option value="">All</option>'; // Default option to select all months

    // Loop through the months array and create dropdown options
    months.forEach(month => {
        const [year, monthPart] = month.split('-');
        const date = new Date(year, parseInt(monthPart, 10) - 1); // Create a date object for each month
        const option = document.createElement('option');
        option.value = month;
        option.text = date.toLocaleString('default', { month: 'long', year: 'numeric' }); // Format the month and year
        select.appendChild(option);
    });
}

/**
 * Function to fetch and display crime data based on the selected month.
 */
async function fetchCrimeData() {
    try {
        const token = localStorage.getItem('authToken'); // Retrieve the authentication token
        const month = document.getElementById('month').value; // Get the selected month from the dropdown

        // Make an API request to fetch crime data, including the hour of the crime
        const response = await fetch(`/api/chartData?month=${month}&includeHour=true`, {
            headers: {
                'Authorization': `Bearer ${token}` // Add the authorization header
            }
        });

        // Handle non-OK responses from the API
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json(); // Parse the JSON response

        // Handle cases where no data is returned
        if (!Array.isArray(data) || data.length === 0) {
            console.error('No data available:', data);
            throw new Error('No data available for the selected period.');
        }

        // Map the API data into a format suitable for the chart
        const chartData = data.map(item => ({
            x: item.hour !== undefined && !isNaN(item.hour) ? Number(item.hour) : null, // Time of day (hour)
            y: item.category, // Crime type
            count: Number(item.count), // Number of crimes
            incidentIds: item.incidentIds ? item.incidentIds.split(',') : [] // List of incident IDs
        }));

        // Filter out data points where the hour is not valid
        const validChartData = chartData.filter(point => point.x !== null);

        const chartContainer = document.querySelector('.chart-container');
        let canvas = document.getElementById('myChart');

        // Destroy the existing chart before creating a new one
        if (myChart) {
            myChart.destroy();
        }

        // If no valid data is available, display a message
        if (validChartData.length === 0) {
            chartContainer.innerHTML = '<p>No crime data available for this period.</p>';
            return;
        } else {
            // If no canvas exists, create one
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'myChart';
                chartContainer.innerHTML = '';
                chartContainer.appendChild(canvas);
            }
        }

        const ctx = canvas.getContext('2d');

        // Create the scatter plot using Chart.js
        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Crime Frequency',
                    data: validChartData, // The processed crime data
                    backgroundColor: 'rgba(255, 0, 0, 0.6)', // Red color for data points
                    borderColor: 'rgba(255, 0, 0, 0.6)', // Red border color
                    pointStyle: 'circle',
                    radius: 6,  // Size of the points
                    borderWidth: 2  // Border width for better visibility
                }]
            },
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            title() { return ''; }, // No title in the tooltip
                            label(item) {
                                const dataItem = item.raw;
                                return `Hour: ${dataItem.x}:00, Crime: ${dataItem.y}, Frequency: ${dataItem.count}, IncidentID: ${dataItem.incidentIds.join(', ')}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,  // Start the x-axis at 0 (midnight)
                        max: 23, // End the x-axis at 23 (11 PM)
                        title: {
                            display: true,
                            text: 'Time of Day', // Label for the x-axis
                            color: '#333',
                            font: {
                                size: 16
                            }
                        },
                        ticks: {
                            stepSize: 1, // Ensure every hour is displayed
                            callback: function(value) {
                                return `${value}:00`; // Format ticks as time of day
                            },
                            color: '#333',
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                        }
                    },
                    y: {
                        type: 'category', // Category axis for crime types
                        labels: ['Theft', 'Assault', 'Robbery', 'Burglary', 'Vandalism', 'Human Trafficking', 'Drugs', 'Wilful Murder'], // Crime types
                        title: {
                            display: true,
                            text: 'Crime Type', // Label for the y-axis
                            color: '#333',
                            font: {
                                size: 16
                            }
                        },
                        ticks: {
                            color: '#333',
                            font: {
                                size: 12
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error fetching crime data:', error);
        document.querySelector('.chart-container').innerHTML = `<p>Error: ${error.message}</p>`; // Display error message
    }
}
