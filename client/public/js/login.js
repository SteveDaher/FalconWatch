// Path: client/public/js/login.js

// Wait for the DOM to be fully loaded before executing script
document.addEventListener('DOMContentLoaded', () => {
    // Get the login form element
    const loginForm = document.getElementById('login-form');

    // Attach event listener for form submission
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();  // Prevent default form submission behavior (page reload)

        // Get input values and trim any excess whitespace
        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value.trim();

        // Validate that both fields are filled
        if (!identifier || !password) {
            alert('Please fill in both identifier and password.');
            return;  // Stop further execution if fields are not filled
        }

        try {
            // Send login request to the server
            const response = await fetch('/api/users/login', {
                method: 'POST',  // Use POST method for login
                headers: {
                    'Content-Type': 'application/json',  // Tell the server you're sending JSON
                },
                body: JSON.stringify({ identifier, password })  // Send identifier and password as JSON
            });

            // Handle different response statuses and show appropriate messages
            if (!response.ok) {
                let errorMessage = 'Login failed';  // Default error message
                if (response.status === 401) {
                    errorMessage = 'Unauthorized: Incorrect email or password.';
                } else if (response.status === 400) {
                    errorMessage = 'Bad Request: Please check your input and try again.';
                } else if (response.status === 500) {
                    errorMessage = 'Server error. Please try again later.';
                }

                // Try to get a more specific error message from the server response
                const errorData = await response.json();
                alert(errorData.message || errorMessage);  // Show error message to the user
                return;  // Stop further execution on error
            }

            // Parse the successful response data (expected to contain token and user info)
            const data = await response.json();

            // Save the JWT token and user details in localStorage for later use
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('name', data.user.name);
            localStorage.setItem('role', data.user.role);  // Store user role for role-based access

            const userRole = data.user.role;
            if (userRole === 'police') {
                window.location.href = '/html/services.html';  // Police role redirect
            } else {
                window.location.href = '/client/index.html';  // Non-police users redirect to the homepage
            }
        } catch (error) {
            // Catch any network or processing errors and log them
            console.error('Error during login:', error);
            alert('An error occurred. Please try again.');
        }
    });
});
