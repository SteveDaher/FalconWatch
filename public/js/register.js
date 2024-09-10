// Path: client/public/js/register.js

// Wait for the DOM to fully load before adding event listeners
document.addEventListener('DOMContentLoaded', () => {
    
    // Register form submission event
    const form = document.getElementById('register-form');
    
    form.addEventListener('submit', async (event) => {
        // Prevent the default form submission behavior (no page reload)
        event.preventDefault();

        // Collect form data into an object
        const formData = new FormData(event.target);  // Extract form fields
        const data = Object.fromEntries(formData.entries());  // Convert to plain object

        try {
            // Send POST request to the server for registration
            const response = await fetch('/api/users/register', {
                method: 'POST',  // HTTP method
                headers: {
                    'Content-Type': 'application/json'  // Specify JSON format
                },
                body: JSON.stringify(data)  // Convert form data to JSON string
            });

            // Parse JSON response from the server
            const result = await response.json();

            if (response.ok && result.success) {
                // If registration is successful, redirect to login page
                window.location.href = '/html/login.html';
            } else {
                // Show error message from the server
                alert(result.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            // Handle any network or processing errors
            console.error('Error during registration:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });
});
