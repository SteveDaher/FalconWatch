// Path: client/public/js/chart2.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken'); // Retrieve the auth token from localStorage

    // Hide content initially
    const pageContent = document.querySelector('.page-content');
    pageContent.style.display = 'none';

    // Redirect to login if the user is not authenticated
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

        // Set the current month as the default filter in the month dropdown
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        document.getElementById('monthFilter').value = currentMonth;

        // Fetch initial data based on default filter (category and current month)
        await fetchData('category', currentMonth);

    } catch (error) {
        console.error('Error during initialization:', error);
        window.location.href = '/html/login.html'; // Redirect to login on error
    }

    // Handle changes to the month filter
    document.getElementById('monthFilter').addEventListener('change', async (event) => {
        const month = event.target.value;
        const type = document.getElementById('typeFilter').value;
        if (month) {
            await fetchData(type, month); // Fetch new data when the month is selected
        } else {
            if (categoryChart) {
                categoryChart.destroy(); // Destroy the chart if no month is selected
            }
            updateTotalCrimes(0); // Reset total crimes to 0
        }
    });

    // Handle changes to the type filter (category or severity)
    document.getElementById('typeFilter').addEventListener('change', async (event) => {
        const type = event.target.value;
        const month = document.getElementById('monthFilter').value;
        if (month) {
            await fetchData(type, month); // Fetch new data when the type is selected
        } else {
            if (categoryChart) {
                categoryChart.destroy(); // Destroy the chart if no month is selected
            }
            updateTotalCrimes(0); // Reset total crimes to 0
        }
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

// Global variable to store the chart instance
let categoryChart;

// Colors for category and severity chart
const categoryColors = {
    'Willful Murder': '#FF5733',
    'Aggravated Assault': '#33FF57',
    'Rape': '#3357FF',
    'Robbery': '#F1C40F',
    'Theft': '#FF6384',
    'Abduction': '#8E44AD',
    'Burglary': '#FFCE56',
    'Drugs': '#2ECC71',
    'Human Trafficking': '#E74C3C',
    'Other': '#95A5A6'
};

const severityColors = {
    'low': '#4CAF50',
    'medium': '#FFEB3B',
    'high': '#F44336'
};

// Function to fetch and display data based on selected filters
async function fetchData(type, month = '') {
    try {
        const token = localStorage.getItem('authToken');

        let fetchUrl = `/api/chartData?month=${month}`;

        const response = await fetch(fetchUrl, {
            headers: {
                'Authorization': `Bearer ${token}` // Attach the token to the request
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch data. Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            if (categoryChart) {
                categoryChart.destroy(); // Destroy the chart if no data is returned
            }
            updateTotalCrimes(0); // Reset total crimes to 0
            return;
        }

        const counts = {};
        data.forEach(item => {
            const key = type === 'category' ? item.category : item.severity;
            if (!key) {
                console.error(`Missing ${type} field in data item:`, item);
                return;
            }
            if (!counts[key]) {
                counts[key] = 0;
            }
            counts[key] += item.count; // Aggregate counts based on type
        });

        const labels = Object.keys(counts);
        const values = Object.values(counts);
        const colors = labels.map(label => (type === 'category' ? categoryColors[label] : severityColors[label]) || '#999999');
        const borderColors = colors.map(color => color.replace('0.5', '1'));

        if (categoryChart) {
            categoryChart.destroy(); // Destroy previous chart instance
        }

        // Create a new chart instance
        const ctx = document.getElementById('categoryChart').getContext('2d');
        categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    label: `Crimes by ${type.charAt(0).toUpperCase() + type.slice(1)}`,
                    data: values,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top', // Position legend at the top
                        display: true
                    },
                    tooltip: {
                        callbacks: {
                            label: function(tooltipItem) {
                                return `${tooltipItem.label}: ${tooltipItem.raw}`; // Custom tooltip labels
                            }
                        }
                    }
                }
            }
        });

        // Calculate and update the total crimes count
        const totalCrimes = data.reduce((total, item) => total + item.count, 0);
        updateTotalCrimes(totalCrimes);

    } catch (error) {
        console.error(`Error fetching ${type} data:`, error);
        updateTotalCrimes(0); // Reset total crimes to 0 in case of an error
    }
}

// Function to update the total crimes displayed on the page
function updateTotalCrimes(total) {
    try {
        document.getElementById('total-crimes').textContent = total;
    } catch (error) {
        console.error('Error updating total crimes:', error);
        document.getElementById('total-crimes').textContent = '0'; // Reset to 0 if an error occurs
    }
}
