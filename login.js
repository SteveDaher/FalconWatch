document.getElementById('login-form').addEventListener('submit', function(event) {
  event.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  // Simple client-side validation
  if (username.trim() === '' || password.trim() === '') {
    alert('Please fill in both fields.');
    return;
  }
  
  // Send login request to the server
  fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })
  .then(response => {
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  })
  .then(data => {
    // Handle successful login
    alert('Login successful!');
    window.location.href = '/dashboard.html'; // Redirect to dashboard or another page
  })
  .catch(error => {
    console.error('Error:', error);
    alert('Login failed. Please try again.');
  });
});
``
