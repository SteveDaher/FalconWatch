//Path: client/js/services.js
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

        // Execute any further code after the user is verified
        initializeServicesPage(); // Assuming you have a function to initialize services page features

    } catch (error) {
        console.error('Error during user verification:', error);
        window.location.href = '/html/login.html';
    }
});

// Example function for further initialization after verification
function initializeServicesPage() {
    // Add your services page logic here
    console.log('Services page is now active.');
}
