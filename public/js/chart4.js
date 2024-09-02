let myChart = null;

const severityColors = {
  'low': '#4CAF50',    // Green
  'medium': '#FFEB3B', // Yellow
  'high': '#F44336'    // Red
};

document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('authToken');

  if (!token) {
    console.error('No authentication token found. Redirecting to login.');
    window.location.href = '/html/login.html';
    return;
  }

  try {
    await fetchCrimeData(token); // Pass the token for authorization
  } catch (error) {
    console.error('Error during initialization:', error);
    alert('An error occurred during initialization.');
    window.location.href = '/html/main.html';
}

  document.getElementById('yearFilter').addEventListener('change', async () => {
    await fetchCrimeData(token);
  });
});
async function fetchCrimeData(token) {
    try {
      const userId = localStorage.getItem('userId');
      const year = document.getElementById('yearFilter').value;
  
      const response = await fetch(`/api/chartData?userId=${userId}&year=${year}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      console.log('Fetched data:', data);
  
      if (!Array.isArray(data) || data.length === 0) {
        console.error('No data available:', data);
        throw new Error('No data available for the selected period.');
      }
  
      // Prepare data for the chart
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const labels = months.map((month, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
  
      const severities = ['low', 'medium', 'high'];
      const datasets = severities.map(severity => {
        return {
          label: severity,
          data: labels.map(label => {
            const [y, m] = label.split('-');
            return data.filter(d => d.year === parseInt(y) && d.month === parseInt(m) && d.severity === severity)
                       .reduce((sum, item) => sum + item.count, 0);
          }),
          backgroundColor: severityColors[severity],
          stack: 'severity',
          barThickness: 10 // Adjusted bar thickness
        };
      });
  
      const totalCrimesData = labels.map(label => {
        const [y, m] = label.split('-');
        return data.filter(d => d.year === parseInt(y) && d.month === parseInt(m))
                   .reduce((sum, item) => sum + item.count, 0);
      });
  
      datasets.push({
        label: 'Total Crimes',
        data: totalCrimesData,
        type: 'line',
        fill: false,
        borderColor: '#000',
        backgroundColor: '#000',
        tension: 0.4,
        borderWidth: 1,
        radius: 0
      });
  
      const ctx = document.getElementById('myChart').getContext('2d');
  
      if (myChart) {
        myChart.destroy();
      }
  
      myChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: months,
          datasets: datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              stacked: true,
              title: {
                display: true,
                text: 'Month'
              },
              grid: {
                display: false
              },
              barPercentage: 0.6 // Adjust the thickness of the bars
            },
            y: {
              stacked: true,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Crimes'
              },
              grid: {
                borderDash: [5, 5] // Dashed grid lines for better readability
              }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                boxWidth: 20,
                boxHeight: 2
              }
            },
            tooltip: {
              callbacks: {
                label: function(tooltipItem) {
                  return `${tooltipItem.dataset.label}: ${tooltipItem.raw}`;
                }
              }
            }
          },
          interaction: {
            intersect: false
          }
        }
      });
  
    } catch (error) {
      console.error('Error fetching crime data:', error);
    }
  }
  