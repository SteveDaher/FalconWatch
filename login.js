document.getElementById('login-form').addEventListener('submit', async function(event) {
  event.preventDefault();
  const identifier = document.getElementById('identifier').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });

    const result = await response.json();
    if (response.ok) {
      // Store user data in localStorage
      localStorage.setItem('userId', result.userId);
      localStorage.setItem('role', result.role);
      localStorage.setItem('name', result.name);
      console.log('Stored in localStorage:', localStorage.getItem('userId'), localStorage.getItem('role'), localStorage.getItem('name'));
      window.location.href = 'main.html';
    } else {
      alert(result.message);
    }
  } catch (error) {
    console.error('Login error:', error);
  }
});
