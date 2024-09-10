// Path: client/public/js/reportHistory.js

document.addEventListener('DOMContentLoaded', async function() {
    // Hide the page content initially
    const pageContent = document.querySelector('.page-content');
    pageContent.style.display = 'none';

    const token = localStorage.getItem('authToken');  // Get the auth token from localStorage

    // Redirect to login if no auth token is found
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

        // Fetch crime reports for the first page after the user is verified
        try {
            fetchCrimeReports(1);  // Replace with your function that fetches reports
        } catch (error) {
            console.error('Error during report fetching:', error);
            window.location.href = '/html/login.html';
        }

    } catch (error) {
        console.error('Error during user verification:', error);
        window.location.href = '/html/login.html';
    }
});


// Constants to manage pagination and reports per page
const reportsPerPage = 15;
let currentPage = 1;

/**
 * Fetch crime reports from the server and render them in the table.
 * @param {number} page - The current page number to fetch.
 */
async function fetchCrimeReports(page = 1) {
    try {
        // Make an authenticated request to fetch report history
        const response = await fetch(`/api/reportHistory`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`  // Include auth token in request headers
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch reports');
        }

        const reports = await response.json();  // Parse the JSON response

        // Check if reports is an array
        if (!Array.isArray(reports)) {
            throw new Error('Reports data is not an array');
        }

        // Calculate total pages for pagination based on the number of reports
        const totalReports = reports.length;
        const totalPages = Math.ceil(totalReports / reportsPerPage);

        // Slice the reports to only include the ones for the current page
        const start = (page - 1) * reportsPerPage;
        const end = start + reportsPerPage;
        const paginatedReports = reports.slice(start, end);

        // Fetch location names for all reports with latitude and longitude
        await addLocationNamesToReports(paginatedReports);

        // Render the reports in the table and set up pagination controls
        renderCrimeTable(paginatedReports);
        renderPaginationControls(totalPages);
    } catch (error) {
        console.error('Error fetching reports:', error);
    }
}


/**
 * Add human-readable location names to the reports using reverse geocoding.
 * @param {Array} reports - Array of reports that need location names.
 */
async function addLocationNamesToReports(reports) {
    for (let report of reports) {
        if (report.lng && report.lat) {
            const locationName = await reverseGeocode([report.lng, report.lat]);  // Get location name using reverse geocoding
            report.locationName = locationName;
        } else {
            report.locationName = 'Unknown Location';
        }
    }
}

/**
 * Use Mapbox API to convert coordinates into a human-readable location.
 * @param {Array} coordinates - Array with longitude and latitude.
 * @returns {string} - The human-readable location name.
 */
async function reverseGeocode([longitude, latitude]) {
    const apiKey = 'pk.eyJ1IjoiZmFsY29ud2F0Y2giLCJhIjoiY2x5ZWIwcDJhMDBxbTJqc2VnYWMxeWNvdCJ9.bijpr26vfErYoGhhlQnaFA';  // Replace with your actual Mapbox API key
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${apiKey}`;

    try {
        const response = await fetch(url);  // Fetch location data from Mapbox
        const data = await response.json();

        // Check if there are any valid features returned
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

/**
 * Render the crime reports into the table.
 * @param {Array} reports - Array of report objects to render in the table.
 */
function renderCrimeTable(reports) {
    const tbody = document.getElementById('report-body');
    tbody.innerHTML = '';  // Clear existing table rows

    reports.forEach(report => {
        const row = document.createElement('tr');
        const lng = parseFloat(report.lng).toFixed(6);  // Ensure longitude has six decimal places
        const lat = parseFloat(report.lat).toFixed(6);  // Ensure latitude has six decimal places

        // Insert report data into table row
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

/**
 * Render pagination controls based on the total number of pages.
 * @param {number} totalPages - The total number of pages for pagination.
 */
function renderPaginationControls(totalPages) {
    const pagination = document.getElementById('pagination-controls');
    pagination.innerHTML = '';  // Clear existing pagination controls

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage ? 'active' : '';  // Highlight current page
        button.onclick = () => {
            currentPage = i;
            fetchCrimeReports(currentPage);  // Fetch reports for the selected page
        };
        pagination.appendChild(button);
    }
}

/**
 * Return the appropriate CSS class for the severity level.
 * @param {string} severity - The severity level of the report.
 * @returns {string} - The corresponding CSS class.
 */
function getPriorityClass(severity) {
    switch (severity) {
        case 'low': return 'low';
        case 'medium': return 'medium';
        case 'high': return 'high';
        default: return '';  // Default case returns no additional class
    }
}

/**
 * Format the report date into a more readable format.
 * @param {string} dateStr - The raw date string from the report.
 * @returns {string} - The formatted date.
 */
function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}
