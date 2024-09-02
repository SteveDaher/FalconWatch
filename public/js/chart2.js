// client/public/js/chart2.js
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('authToken');

  if (!token) {
      console.error('No authentication token found. Redirecting to login.');
      window.location.href = '/login.html';
      return;
  }

  const currentDate = new Date();
  const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  document.getElementById('monthFilter').value = currentMonth;
  await fetchData('category', currentMonth);

  document.getElementById('monthFilter').addEventListener('change', async (event) => {
      const month = event.target.value;
      const type = document.getElementById('typeFilter').value;
      if (month) {
          await fetchData(type, month);
      } else {
          if (categoryChart) {
              categoryChart.destroy();
          }
          updateTotalCrimes(0);
      }
  });

  document.getElementById('typeFilter').addEventListener('change', async (event) => {
      const type = event.target.value;
      const month = document.getElementById('monthFilter').value;
      if (month) {
          await fetchData(type, month);
      } else {
          if (categoryChart) {
              categoryChart.destroy();
          }
          updateTotalCrimes(0);
      }
  });
});

let categoryChart;

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


async function fetchData(type, month = '') {
  try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/chartData?month=${month}`, {
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });

      if (!response.ok) {
          throw new Error(`Network response was not ok. Status: ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
          if (categoryChart) {
              categoryChart.destroy();
          }
          updateTotalCrimes(0);
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
          counts[key] += item.count;
      });

      const labels = Object.keys(counts);
      const values = Object.values(counts);

      const colors = labels.map(label => (type === 'category' ? categoryColors[label] : severityColors[label]) || '#999999');
      const borderColors = colors.map(color => color.replace('0.5', '1'));

      if (categoryChart) {
          categoryChart.destroy();
      }

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
                      position: 'top',
                      display: true
                  },
                  tooltip: {
                      callbacks: {
                          label: function(tooltipItem) {
                              return `${tooltipItem.label}: ${tooltipItem.raw}`;
                          }
                      }
                  }
              }
          }
      });

      const totalCrimes = data.reduce((total, item) => total + item.count, 0);
      updateTotalCrimes(totalCrimes);

  } catch (error) {
      console.error(`Error fetching ${type} data:`, error);
      updateTotalCrimes(0);
  }
}

function updateTotalCrimes(total) {
  try {
      document.getElementById('total-crimes').textContent = total;
  } catch (error) {
      console.error('Error updating total crimes:', error);
      document.getElementById('total-crimes').textContent = '0';
  }
}
