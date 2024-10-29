// Path: server/src/emailVerification.js

const express = require('express');
const router = express.Router();
const axios = require('axios'); // You'll need to install this: npm install axios

// Email verification endpoint
router.post('/verify-email', async (req, res) => {
    try {
        const { email } = req.body;

        // Basic format validation
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        if (!emailRegex.test(email)) {
            return res.json({ 
                isValid: false, 
                message: 'Invalid email format' 
            });
        }

        // List of disposable email domains
        const disposableDomains = [
            'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 
            'sharklasers.com', 'grr.la', 'guerrillamail.info',
            'yopmail.com', 'maildrop.cc', '10minutemail.com',
            'tempmail.net', 'mailinator.com', 'temp-mail.io',
            'disposablemail.com', 'trashmail.com', 'mailnesia.com',
            'tempr.email', 'dispostable.com', 'temporary-mail.net',
            'tmpmail.org', 'spamgourmet.com', 'throwawaymail.com',
            'emailondeck.com', 'tempinbox.com', 'fake-box.com',
            'jetable.org', 'meltmail.com', 'throwawaymail.com',
            'tempmail.ninja', 'temp-mail.org', 'fakeinbox.com',
            'tempmailer.com', 'emailtemporal.org', 'spambox.us',
            'deadfake.com', 'mailcatch.com', 'anonbox.net',
            'sharklasers.com', 'guerrillamailblock.com', 'odaymail.com',
            'tempmailaddress.com', 'tempmaildata.info', 'tempmailcenter.com'
        ];

        // Check if email domain is in the disposable list
        const domain = email.split('@')[1].toLowerCase();
        if (disposableDomains.includes(domain)) {
            return res.json({
                isValid: false,
                message: 'Disposable email addresses are not allowed'
            });
        }

        // Use Abstract API for email verification
        // Sign up at https://www.abstractapi.com/api/email-verification-validation-api
        // Get your API key and replace it here
        const apiKey = 'b7b5dabf5fbe43c4b5cb0a5e7e139d44'; // Replace with your API key
        const apiUrl = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`;

        const response = await axios.get(apiUrl);
        const data = response.data;

        // Comprehensive email validation checks
        const isValidEmail = 
            data.deliverability === "DELIVERABLE" &&
            data.is_valid_format.value &&
            !data.is_disposable_email.value &&
            data.is_mx_found.value &&
            !data.is_role_email.value;

        if (!isValidEmail) {
            let message = 'Invalid email address';
            if (data.is_disposable_email.value) {
                message = 'Disposable email addresses are not allowed';
            } else if (!data.is_mx_found.value) {
                message = 'Invalid email domain';
            } else if (data.is_role_email.value) {
                message = 'Role-based email addresses are not allowed';
            }

            return res.json({
                isValid: false,
                message: message
            });
        }

        // If all checks pass
        res.json({ 
            isValid: true,
            message: 'Email is valid'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        // On error, default to basic validation
        res.json({ 
            isValid: true, 
            message: 'Basic validation passed' 
        });
    }
});

module.exports = router;