document.addEventListener('DOMContentLoaded', function () {
    const assignBadgeForm = document.getElementById('assign-badge-form');
    const wipeReportsBtn = document.getElementById('wipe-reports-btn');

    if (assignBadgeForm) {
        // Event listener for assigning a badge
        assignBadgeForm.addEventListener('submit', async function (event) {
            event.preventDefault(); // Prevent default form submission
            await assignBadge(); // Call the function to assign a badge
        });
    } else {
        console.error("Element with ID 'assign-badge-form' not found.");
    }

    if (wipeReportsBtn) {
        // Event listener for wiping all reports
        wipeReportsBtn.addEventListener('click', async function () {
            await wipeReports(); // Call the function to wipe reports
        });
    } else {
        console.error("Element with ID 'wipe-reports-btn' not found.");
    }
});

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
