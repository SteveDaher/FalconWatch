// client/public/js/chart.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken'); // Assuming you store the token in localStorage

    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        window.location.href = '/login.html';
        return;
    }

    try {
        const response = await fetch('/api/chartData', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text(); // Get the text of the error response
            console.error('Failed to fetch chart data:', errorText);
            throw new Error('Failed to fetch chart data');
        }

        let data = await response.json();

        // Ensure data is in array format
        if (!Array.isArray(data)) {
            console.warn('Data is not an array. Converting to an array.');
            data = [data]; // Convert to an array if it's a single object
        }

        renderChart(data);
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load chart data. Please try again.');
    }
});

function renderChart(data) {
    const monthlyData = {};
    data.forEach(item => {
        const month = `${item.year}-${item.month.toString().padStart(2, '0')}`;
        if (!monthlyData[month]) {
            monthlyData[month] = { low: 0, medium: 0, high: 0 };
        }
        monthlyData[month][item.severity.toLowerCase()] += item.count;
    });

    const labels = Object.keys(monthlyData);
    const lowData = labels.map(month => monthlyData[month].low || 0);
    const mediumData = labels.map(month => monthlyData[month].medium || 0);
    const highData = labels.map(month => monthlyData[month].high || 0);

    const ctx = document.getElementById('myBarChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Low Severity',
                    data: lowData,
                    backgroundColor: 'rgba(76, 175, 80, 0.5)',
                    borderColor: 'rgba(76, 175, 80, 1)',
                    borderWidth: 1,
                    barThickness: 10
                },
                {
                    label: 'Medium Severity',
                    data: mediumData,
                    backgroundColor: 'rgba(255, 235, 59, 0.5)',
                    borderColor: 'rgba(255, 235, 59, 1)',
                    borderWidth: 1,
                    barThickness: 10
                },
                {
                    label: 'High Severity',
                    data: highData,
                    backgroundColor: 'rgba(244, 67, 54, 0.5)',
                    borderColor: 'rgba(244, 67, 54, 1)',
                    borderWidth: 1,
                    barThickness: 10
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(tooltipItem) {
                            return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Month'
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Crimes'
                    }
                }
            }
        }
    });
}
