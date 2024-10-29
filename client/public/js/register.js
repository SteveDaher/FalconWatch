// Path: client/public/js/register.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('register-form');
    
    // Create error message display elements
    const createErrorDisplay = (inputId) => {
        const input = document.getElementById(inputId);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.id = `${inputId}-error`;
        errorDiv.style.color = 'red';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '5px';
        input.parentNode.appendChild(errorDiv);
    };

    // Create error displays for all inputs
    ['name', 'email', 'phone', 'password'].forEach(createErrorDisplay);

    // Validation patterns
    const patterns = {
        name: /^[a-zA-Z\s]{2,30}$/,
        email: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/,
        phone: /^(?:\+971|00971|0)?(?:50|51|52|55|56|58|2|3|4|6|7|9)\d{7}$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    };

    // Error messages
    const errorMessages = {
        name: 'Name should be 2-30 characters long and contain only letters',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid UAE phone number',
        password: 'Password must be at least 8 characters long and include uppercase, lowercase, number and special character'
    };

    // Real-time validation
    const validateField = (field, pattern) => {
        const input = document.getElementById(field);
        const errorDisplay = document.getElementById(`${field}-error`);
        
        input.addEventListener('input', () => {
            if (!pattern.test(input.value)) {
                errorDisplay.textContent = errorMessages[field];
                input.style.borderColor = 'red';
            } else {
                errorDisplay.textContent = '';
                input.style.borderColor = 'green';
            }
        });
    };

    // Add validation to each field
    Object.keys(patterns).forEach(field => {
        validateField(field, patterns[field]);
    });

    // Form submission handler
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        // Get form data
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());

        // Validate all fields
        let isValid = true;
        Object.keys(patterns).forEach(field => {
            if (!patterns[field].test(data[field])) {
                document.getElementById(`${field}-error`).textContent = errorMessages[field];
                isValid = false;
            }
        });

        if (!isValid) {
            return;
        }

        try {
            // First, verify the email
            const emailVerifyResponse = await fetch('/api/verify-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: data.email })
            });

            const emailVerifyResult = await emailVerifyResponse.json();

            if (!emailVerifyResult.isValid) {
                document.getElementById('email-error').textContent = 'This email address is invalid or inactive';
                return;
            }

            // If email is valid, proceed with registration
            const registerResponse = await fetch('/api/users/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await registerResponse.json();

            if (registerResponse.ok && result.success) {
                window.location.href = '/html/login.html';
            } else {
                alert(result.message || 'Registration failed. Please try again.');
            }
        } catch (error) {
            console.error('Error during registration:', error);
            alert('An unexpected error occurred. Please try again.');
        }
    });
});