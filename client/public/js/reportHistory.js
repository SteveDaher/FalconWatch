document.addEventListener('DOMContentLoaded', async function() {
    const token = localStorage.getItem('authToken');

    if (!token) {
        console.error('No auth token found. Redirecting to login.');
        window.location.href = '/html/login.html';
        return;
    }

    try {
        fetchCrimeReports(1); // Fetch the reports for the first page
    } catch (error) {
        console.error('Error during report fetching:', error);
        window.location.href = '/html/login.html';
    }
});

const reportsPerPage = 15;
let currentPage = 1;

async function fetchCrimeReports(page = 1) {
    try {
        const response = await fetch(`/api/reportHistory`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch reports');
        }

        const reports = await response.json();

        // Handle pagination if reports are more than the reportsPerPage
        const totalReports = reports.length;
        const totalPages = Math.ceil(totalReports / reportsPerPage);

        // Slice reports for the current page
        const start = (page - 1) * reportsPerPage;
        const end = start + reportsPerPage;
        const paginatedReports = reports.slice(start, end);

        // Get location names for all reports
        await addLocationNamesToReports(paginatedReports);

        renderCrimeTable(paginatedReports);
        renderPaginationControls(totalPages);
    } catch (error) {
        console.error('Error fetching reports:', error);
    }
}

async function addLocationNamesToReports(reports) {
    for (let report of reports) {
        if (report.lng && report.lat) {
            const locationName = await reverseGeocode([report.lng, report.lat]);
            report.locationName = locationName;
        } else {
            report.locationName = 'Unknown Location';
        }
    }
}

async function reverseGeocode([longitude, latitude]) {
    const apiKey = 'pk.eyJ1IjoiZmFsY29ud2F0Y2giLCJhIjoiY2x5ZWIwcDJhMDBxbTJqc2VnYWMxeWNvdCJ9.bijpr26vfErYoGhhlQnaFA';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${apiKey}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            return data.features[0].place_name;
        } else {
            return 'Unknown Location';
        }
    } catch (error) {
        console.error('Error during reverse geocoding:', error);
        return 'Error fetching location';
    }
}

function renderCrimeTable(reports) {
    const tbody = document.getElementById('report-body');
    tbody.innerHTML = '';

    reports.forEach(report => {
        const row = document.createElement('tr');
        const lng = parseFloat(report.lng).toFixed(6);  // Ensure proper formatting
        const lat = parseFloat(report.lat).toFixed(6);  // Ensure proper formatting

        row.innerHTML = `
            <td>${report.incidentId}</td>
            <td>${report.category}</td>
            <td class="${getPriorityClass(report.severity)}">${report.severity}</td>
            <td>${report.description}</td>
            <td>${formatDate(report.date)}</td>
            <td>${report.locationName || `${lng}, ${lat}`}</td>
            <td><a href="/html/main.html?lng=${lng}&lat=${lat}" class="view-pin-btn">Show Pin</a></td>
        `;
        tbody.appendChild(row);
    });
}




function renderPaginationControls(totalPages) {
    const pagination = document.getElementById('pagination-controls');
    pagination.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage ? 'active' : '';
        button.onclick = () => {
            currentPage = i;
            fetchCrimeReports(currentPage);
        };
        pagination.appendChild(button);
    }
}

function getPriorityClass(severity) {
    switch (severity) {
        case 'low': return 'low';
        case 'medium': return 'medium';
        case 'high': return 'high';
        default: return '';
    }
}

function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}
