//Path: client/js/admin.js
document.addEventListener('DOMContentLoaded', async function () {
    // Hide the page content initially
    const pageContent = document.querySelector('body');
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

        // Initialize the admin page functionalities after user is verified
        initializeAdminPage();

    } catch (error) {
        console.error('Error during user verification:', error);
        window.location.href = '/html/login.html';
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
 * Function to initialize the admin page features.
 * This function will be called once the user is verified.
 */
function initializeAdminPage() {
    const assignBadgeForm = document.getElementById('assign-badge-form');
    const wipeReportsBtn = document.getElementById('wipe-reports-btn');

    if (assignBadgeForm) {
        // Event listener for assigning a badge
        assignBadgeForm.addEventListener('submit', async function (event) {
            event.preventDefault(); // Prevent default form submission
            await assignBadge(); // Call the function to assign a badge
        });
    }

    if (wipeReportsBtn) {
        // Event listener for wiping all reports
        wipeReportsBtn.addEventListener('click', async function () {
            await wipeReports(); // Call the function to wipe reports
        });
    } else {
        console.error("Element with ID 'wipe-reports-btn' not found.");
    }
}

// Function to assign a badge
async function assignBadge() {
    const email = document.getElementById('email').value;
    const badgeNumber = document.getElementById('badgenumber').value;
    const token = localStorage.getItem('authToken'); // Retrieve the token from localStorage

    try {
        // Send a POST request to the server
        const response = await fetch('/assign-badge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, // Add the token to the Authorization header
            },
            body: JSON.stringify({ email, badgenumber: badgeNumber }),
        });

        if (!response.ok) {
            // Handle non-OK responses
            const errorText = await response.text();
            throw new Error(`Failed to assign badge number: ${response.status} ${errorText}`);
        }

        const result = await response.json(); // Parse the JSON response

        // Display the result message
        document.getElementById('status').textContent = result.message;
    } catch (error) {
        console.error('Error assigning badge number:', error);
        document.getElementById('status').textContent = 'An error occurred. Please try again later.';
    }
}

// Function to wipe all reports
async function wipeReports() {
    const token = localStorage.getItem('authToken'); // Retrieve the token from localStorage

    if (!confirm('Are you sure you want to wipe all reports? This action cannot be undone.')) {
        return; // Exit if the user cancels the action
    }

    try {
        // Send a POST request to wipe all reports
        const response = await fetch('/wipe-reports', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`, // Add the token to the Authorization header
            },
        });

        if (!response.ok) {
            // Handle non-OK responses
            const errorText = await response.text();
            throw new Error(`Failed to wipe reports: ${response.status} ${errorText}`);
        }

        const result = await response.json(); // Parse the JSON response

        // Display the result message
        document.getElementById('wipe-status').textContent = result.message;
    } catch (error) {
        console.error('Error wiping reports:', error);
        document.getElementById('wipe-status').textContent = 'An error occurred. Please try again later.';
    }
}
