/**
 * Function to verify if the user is authenticated and has the 'police' role by default.
 * Redirects to the login page if verification fails.
 * 
 * @param {string} [requiredRole='police'] - The role required to access the page (defaults to 'police').
 */
function verifyUser(requiredRole = 'police') {
    const token = localStorage.getItem('authToken');  // Get auth token from local storage
    const role = localStorage.getItem('role');  // Get role from local storage

    // If no token or the role does not match, redirect to the login page
    if (!token || role !== requiredRole) {
        console.error('Unauthorized access. Redirecting to login.');
        window.location.href = '/html/login.html';
        return false;  // Return false indicating failed verification
    }

    return true;  // Return true indicating successful verification
}
