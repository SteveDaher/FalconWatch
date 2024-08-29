// client/public/js/chart3.js
let myChart; // Declare myChart in the global scope

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.error('No authentication token found. Redirecting to login.');
        window.location.href = '/html/login.html';
        return;
    }

    try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
            throw new Error('User ID not found in localStorage');
        }

        // Populate month options and fetch data immediately
        populateMonths();
        await fetchCrimeData(); // Fetch the data immediately after authentication check

    } catch (error) {
        console.error('Error during initialization:', error);
        alert('An error occurred during initialization.');
        window.location.href = '/html/main.html';
    }

    document.getElementById('month').addEventListener('change', async () => {
        await fetchCrimeData();
    });
});

function populateMonths() {
    const months = [
        '2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
        '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'
    ];
    const select = document.getElementById('month');
    select.innerHTML = '<option value="">All</option>';
    months.forEach(month => {
        const [year, monthPart] = month.split('-');
        const date = new Date(year, parseInt(monthPart, 10) - 1);
        const option = document.createElement('option');
        option.value = month;
        option.text = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        select.appendChild(option);
    });
}

async function fetchCrimeData() {
    try {
        const token = localStorage.getItem('authToken');
        const month = document.getElementById('month').value;

        const response = await fetch(`/api/chartData?month=${month}&includeHour=true`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            console.error('No data available:', data);
            throw new Error('No data available for the selected period.');
        }

        console.log('Fetched data:', data);

        const chartData = data.map(item => ({
            x: item.hour !== undefined && !isNaN(item.hour) ? Number(item.hour) : null,
            y: item.category,
            count: Number(item.count),
            incidentIds: item.incidentIds ? item.incidentIds.split(',') : []
        }));
        

        // Filter out invalid data points where x (hour) is null
        const validChartData = chartData.filter(point => point.x !== null);

        console.log('Chart data:', validChartData);

        const chartContainer = document.querySelector('.chart-container');
        let canvas = document.getElementById('myChart');

        if (myChart) {
            myChart.destroy();
        }

        if (validChartData.length === 0) {
            chartContainer.innerHTML = '<p>No crime data available for this period.</p>';
            return;
        } else {
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'myChart';
                chartContainer.innerHTML = '';
                chartContainer.appendChild(canvas);
            }
        }

        const ctx = canvas.getContext('2d');
        console.log('Raw fetched data:', data);
        console.log('Processed chart data:', chartData);
        console.log('Valid chart data:', validChartData);
        
        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Crime Frequency',
                    data: validChartData,
                    backgroundColor: 'rgba(255, 0, 0, 0.6)',
                    borderColor: 'rgba(255, 0, 0, 0.6)',
                    pointStyle: 'circle',
                    radius: 6,  // Increase the size of points
                    borderWidth: 2  // Increase border width for better visibility
                }]
            },
            options: {
                plugins: {
                    tooltip: {
                        callbacks: {
                            title() { return ''; },
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
                            text: 'Time of Day',
                            color: '#333',
                            font: {
                                size: 16
                            }
                        },
                        ticks: {
                            stepSize: 1, // Ensure every hour is displayed
                            callback: function(value) {
                                return `${value}:00`;
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
                        type: 'category',
                        labels: ['Theft', 'Assault', 'Robbery', 'Burglary', 'Vandalism', 'Human Trafficking', 'Drugs', 'Wilful Murder'],
                        title: {
                            display: true,
                            text: 'Crime Type',
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
        document.querySelector('.chart-container').innerHTML = `<p>Error: ${error.message}</p>`;
    }
}
