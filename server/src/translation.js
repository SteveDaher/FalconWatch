// server/src/translation.js
const express = require('express');
const axios = require('axios');  // Using Axios for HTTP requests
const router = express.Router();

// Translation route
router.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;

        // Set your OpenAI API key directly here
        const apiKey = 'test'; 
        
        // Make the API request to OpenAI
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: "gpt-3.5-turbo",  // Use GPT-4 if available
            messages: [
                { role: "system", content: `Translate the following text to ${targetLanguage}.` },
                { role: "user", content: text }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const translatedText = response.data.choices[0].message.content.trim();
        res.json({ translatedText });
    } catch (error) {
        console.error("Error with translation API:", error);
        res.status(500).json({ error: "Translation failed" });
    }
});


module.exports = router;
