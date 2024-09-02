document.getElementById('assign-badge-form').addEventListener('submit', async function(event) {
    event.preventDefault(); // Prevent the default form submission

    const email = document.getElementById('email').value;
    const badgenumber = document.getElementById('badgenumber').value;
    const token = localStorage.getItem('authToken'); // Retrieve the token from localStorage

    try {
        // Send a POST request to the server
        const response = await fetch('/assign-badge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`, // Add the token to the Authorization header
            },
            body: JSON.stringify({ email, badgenumber }),
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
});

// Add event listener for the wipe all reports button
document.getElementById('wipe-reports-btn').addEventListener('click', async function() {
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
            }
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
});
