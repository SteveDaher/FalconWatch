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
