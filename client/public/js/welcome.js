// client/public/js/welcome.js
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const registerButton = document.getElementById('registerButton');

    loginButton.addEventListener('click', (event) => {
        window.location.href = '/html/login.html';  // Correct path
    });

    registerButton.addEventListener('click', (event) => {
        window.location.href = '/html/register.html';  // Correct path
    });
});
