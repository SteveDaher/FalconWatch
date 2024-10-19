// Path: client/public/js/userInfo.js
document.addEventListener("DOMContentLoaded", function() {

    // Fetch token from local storage
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No token found');
        document.getElementById('welcome-message').textContent = "Welcome, Guest";
        return;
    }

    // Fetch user information with token authorization
    fetch('/api/user-info', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        const welcomeMessage = document.getElementById('welcome-message');
        const loginLink = document.getElementById('login-link');

        // Update welcome message and login link based on user data
        if (data && data.name) {
            welcomeMessage.textContent = `Welcome, ${data.name}`;
            if (data.role === 'police') {
                loginLink.textContent = "Dashboard";
                loginLink.href = "/html/services.html";
            }
        } else {
            welcomeMessage.textContent = "Welcome, Guest";
        }
    })
    .catch(error => {
        console.error('Error fetching user info:', error);
        document.getElementById('welcome-message').textContent = "Welcome, Guest";
    });
});


