document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent the form from submitting the traditional way

        const identifier = document.getElementById('identifier').value.trim();
        const password = document.getElementById('password').value.trim();

        if (!identifier || !password) {
            alert('Please fill in both identifier and password.');
            return;
        }

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ identifier, password }),
            });

            if (!response.ok) {
                let errorMessage = 'Login failed';
                if (response.status === 401) {
                    errorMessage = 'Unauthorized: Incorrect email or password.';
                } else if (response.status === 400) {
                    errorMessage = 'Bad Request: Please check your input and try again.';
                } else if (response.status === 500) {
                    errorMessage = 'Server error. Please try again later.';
                }
                const errorData = await response.json();
                alert(errorData.message || errorMessage);
                return;
            }

            const data = await response.json();

            // Save JWT token and other user details in local storage
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userId', data.user.id);
            localStorage.setItem('name', data.user.name);
            localStorage.setItem('role', data.user.role);  // Store the role in localStorage

            // Redirect to the main page
            window.location.href = '/client/index.html';
        } catch (error) {
            console.error('Error during login:', error);
            alert('An error occurred. Please try again.');
        }
    });
});
