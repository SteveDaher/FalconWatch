// Path: client/public/js/userInfo.js
document.addEventListener("DOMContentLoaded", function() {
    console.log("userInfo.js loaded");

    const token = localStorage.getItem('authToken');
    console.log('Token:', token);

    if (!token) {
        console.error('No token found');
        document.getElementById('welcome-message').textContent = "Welcome, Guest";
        return;
    }

    fetch('/api/user-info', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('User Data:', data);
        const welcomeMessage = document.getElementById('welcome-message');
        const loginLink = document.getElementById('login-link');

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
