// Path: client/public/js/reportHistory.js


document.addEventListener('DOMContentLoaded', async function() {
    // Hide the page content initially
    
    const pageContent = document.querySelector('.page-content');
    pageContent.style.display = 'none';

    const token = localStorage.getItem('authToken');  // Get the auth token from localStorage

     // Initialize i18next
     i18next.init({
        lng: 'en', // Default language is English
        resources
    }, function(err, t) {
        updateContent(); // Translate initial content
    });

    // Handle Arabic and English language switch
    document.getElementById('ArabicLanguage').addEventListener('click', function() {
        switchLanguage('ar');
    });

    document.getElementById('EnglishLanguage').addEventListener('click', function() {
        switchLanguage('en');
    });

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

        // Fetch crime reports for the first page after the user is verified
        try {
            fetchCrimeReports(1);  // Replace with your function that fetches reports
        } catch (error) {
            console.error('Error during report fetching:', error);
            window.location.href = '/html/login.html';
        }

    } catch (error) {
        console.error('Error during user verification:', error);
        window.location.href = '/html/login.html';
    }
});


// Constants to manage pagination and reports per page
const reportsPerPage = 15;
let currentPage = 1;
let totalReports = 0; // Total number of reports, to calculate total pages

/**
 * Fetch crime reports from the server and render them in the table.
 * @param {number} page - The current page number to fetch.
 */
async function fetchCrimeReports(page = 1, language = 'en') {
    try {
        // Make an authenticated request to fetch report history with pagination
        const response = await fetch(`/api/reportHistory?page=${page}&limit=${reportsPerPage}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch reports');
        }

        const data = await response.json();

        const reports = data.reports;
        totalReports = data.totalReports; // Update total reports

        // Check if reports is an array
        if (!Array.isArray(reports)) {
            throw new Error('Reports data is not an array');
        }

        // Add human-readable location names to each report
        await addLocationNamesToReports(reports);

        // Translate and render the reports in the table
        await renderCrimeTable(reports, language);

        // Render pagination controls
        const totalPages = Math.ceil(totalReports / reportsPerPage);
        renderPaginationControls(totalPages);

    } catch (error) {
        console.error('Error fetching reports:', error);
    }
}



/**
 * Add human-readable location names to the reports using reverse geocoding.
 * @param {Array} reports - Array of reports that need location names.
 */
async function addLocationNamesToReports(reports) {
    for (let report of reports) {
        if (report.lng && report.lat) {
            const locationName = await reverseGeocode([report.lng, report.lat]);  // Get location name using reverse geocoding
            report.locationName = locationName;  // Assign the location name to the report object
        } else {
            report.locationName = 'Unknown Location';
        }
    }
}


/**
 * Use Mapbox API to convert coordinates into a human-readable location.
 * @param {Array} coordinates - Array with longitude and latitude.
 * @returns {string} - The human-readable location name.
 */
async function reverseGeocode([longitude, latitude]) {
    const apiKey = 'pk.eyJ1IjoiZmFsY29ud2F0Y2giLCJhIjoiY2x5ZWIwcDJhMDBxbTJqc2VnYWMxeWNvdCJ9.bijpr26vfErYoGhhlQnaFA';  // Replace with your actual Mapbox API key
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${apiKey}`;

    try {
        const response = await fetch(url);  // Fetch location data from Mapbox
        const data = await response.json();

        // Check if there are any valid features returned
        if (data.features && data.features.length > 0) {
            return data.features[0].place_name;
        } else {
            return 'Unknown Location';
        }
    } catch (error) {
        console.error('Error during reverse geocoding:', error);
        return 'Error fetching location';
    }
}

/**
 * Fetch and render crime reports, but translate multiple fields at once.
 */
async function renderCrimeTable(reports, language = 'en') {
    const tbody = document.getElementById('report-body');
    tbody.innerHTML = '';  // Clear existing table rows

    const textArray = [];
    for (const report of reports) {
        textArray.push(report.category, report.description, report.severity, 'Show Pin', 'Delete');
    }

    const translatedTexts = (language === 'ar') ? await translateMultipleTexts(textArray, 'ar') : textArray;

    let translationIndex = 0;
    for (const report of reports) {
        const row = document.createElement('tr');
        const lng = parseFloat(report.lng).toFixed(6);  // Ensure longitude has six decimal places
        const lat = parseFloat(report.lat).toFixed(6);  // Ensure latitude has six decimal places

        const category = translatedTexts[translationIndex++];
        const description = translatedTexts[translationIndex++];
        const severity = translatedTexts[translationIndex++];
        const showPin = translatedTexts[translationIndex++];
        const deleteText = translatedTexts[translationIndex++];

        // Insert report data into table row
        row.innerHTML = `
        <td>${report.incidentId}</td>
        <td>${category}</td>
        <td class="${getPriorityClass(report.severity)}">${severity}</td>
        <td>${description}</td>
        <td>${formatDate(report.date)}</td>
        <td>${report.locationName || `${lng}, ${lat}`}</td>
        <td><a href="/html/main.html?lng=${lng}&lat=${lat}" class="view-pin-btn">${showPin}</a></td>
        <td><button class="delete-report-btn" data-report-id="${report.incidentId}">${deleteText}</button></td> <!-- Delete button -->
        `;

        // Append the row to the table body
        tbody.appendChild(row);
    }

    // Attach event listeners to all delete buttons
    document.querySelectorAll('.delete-report-btn').forEach(button => {
        button.addEventListener('click', async (event) => {
            const reportId = event.target.getAttribute('data-report-id');
            await deleteReport(reportId);
        });
    });
}

// Function to delete a report by its ID
async function deleteReport(reportId) {
    const confirmation = confirm('Are you sure you want to delete this report?');
    if (!confirmation) return;

    try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`/api/reports/${reportId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            alert('Report deleted successfully.');
            // Reload the table after deleting the report
            fetchCrimeReports(currentPage, i18next.language);
        } else {
            const errorData = await response.json();
            alert(`Error deleting report: ${errorData.message}`);
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        alert('An error occurred while deleting the report.');
    }
}




/**
 * Render pagination controls based on the total number of pages.
 * @param {number} totalPages - The total number of pages for pagination.
 */
function renderPaginationControls(totalPages) {
    const pagination = document.getElementById('pagination-controls');
    pagination.innerHTML = '';  // Clear existing pagination controls

    // Previous Button
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            fetchCrimeReports(currentPage, i18next.language);
        }
    };
    pagination.appendChild(prevButton);

    // Page Number Buttons
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement('button');
        button.textContent = i;
        button.className = i === currentPage ? 'active' : '';
        button.onclick = () => {
            currentPage = i;
            fetchCrimeReports(currentPage, i18next.language);
        };
        pagination.appendChild(button);
    }

    // Next Button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchCrimeReports(currentPage, i18next.language);
        }
    };
    pagination.appendChild(nextButton);
}


/**
 * Return the appropriate CSS class for the severity level.
 * @param {string} severity - The severity level of the report.
 * @returns {string} - The corresponding CSS class.
 */
function getPriorityClass(severity) {
    switch (severity) {
        case 'low': return 'low';
        case 'medium': return 'medium';
        case 'high': return 'high';
        default: return '';  // Default case returns no additional class
    }
}

/**
 * Format the report date into a more readable format.
 * @param {string} dateStr - The raw date string from the report.
 * @returns {string} - The formatted date.
 */
function formatDate(dateStr) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' };
    return new Date(dateStr).toLocaleDateString('en-US', options);
}


// Translation
const resources = {
    en: {
        translation: {
            "pageTitle": "Report History", // Add this line for the English title
            "IncidentId": "Incident ID",
            "Category": "Category",
            "Severity": "Severity",
            "Pin": "Pin",
            "Name": "Name",
            "Description": "Description",
            "Date": "Date",
            "Location": "Location",
            "ShowPin": "Show Pin",
            "Home": "Home",
            "ViewServices": "View Services",
            "Language": "Language/لغة",
            "backToMap": "Back to Map", // Add missing translation key
            "Report History": "Report History", // Add this key as it’s missing
        }
    },
    ar: {
        translation: {
            "pageTitle": "تاريخ التقارير", // Add this line for the Arabic title
            "IncidentId": "معرف الحادث",
            "Category": "الفئة",
            "Severity": "الخطورة",
            "Pin": "دبوس",
            "Name": "الاسم",
            "Description": "الوصف",
            "Date": "التاريخ",
            "Location": "الموقع",
            "ShowPin": "عرض الدبوس",
            "Home": "الصفحة الرئيسية",
            "ViewServices": "عرض الخدمات",
            "Language": "اللغة",
            "backToMap": "العودة إلى الخريطة", // Add missing translation
            "Report History": "تاريخ التقارير" // Add this key as it’s missing
        }
    }
};


// function to update the text content of the page when the language changes
function updateContent() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = i18next.t(key); // Use the translation key
    });
}

// Switch Languages
function switchLanguage(language) {
    i18next.changeLanguage(language, async () => {
        updateContent();  // Update static content

        // Re-fetch and re-render reports in the selected language
        await fetchCrimeReports(currentPage, language);
    });
}

/**
/**
 * Translate multiple texts using the server-side OpenAI API.
 * @param {Array} textArray - Array of texts to translate.
 * @param {string} targetLanguage - The target language (e.g., 'ar' for Arabic).
 * @returns {Promise<Array>} - The translated texts.
 */
async function translateMultipleTexts(textArray, targetLanguage) {
    const textToTranslate = textArray.join(' | ');  // Join all texts into one string
    
    try {
        const translatedText = await translateTextWithRetry(textToTranslate, targetLanguage);  // Use retry mechanism
        // Ensure the translatedText is available before calling split
        if (translatedText) {
            return translatedText.split(' | ');  // Split the translated text back into individual parts
        } else {
            console.error('No translatedText received.');
            return textArray;  // Return the original text array if translation failed
        }
    } catch (error) {
        console.error('Error during translation:', error);
        return textArray;  // Return the original text array in case of error
    }
}



/**
 * Add human-readable location names to the reports using reverse geocoding.
 * @param {Array} reports - Array of reports that need location names.
 */
async function addLocationNamesToReports(reports) {
    for (let report of reports) {
        if (report.lng && report.lat) {
            const locationName = await reverseGeocode([report.lng, report.lat]);  // Get location name using reverse geocoding
            report.locationName = locationName;
        } else {
            report.locationName = 'Unknown Location';
        }
    }
}

/**
 * Retry mechanism with exponential backoff for OpenAI API translation.
 * @param {string} text - Text to be translated.
 * @param {string} targetLanguage - Target language.
 * @param {number} retries - Number of retries.
 * @param {number} delay - Delay between retries in milliseconds.
 * @returns {Promise<string>} - Translated text.
 */
async function translateTextWithRetry(text, targetLanguage, retries = 3, delay = 1000) {
    const token = localStorage.getItem('authToken');  // Retrieve the token from localStorage
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`  // Include the token in the Authorization header
                },
                body: JSON.stringify({ text, targetLanguage })
            });

            // Check for 429 status and retry-after header
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay;
                console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;  // Retry after delay
            }

            const data = await response.json();

            // Ensure the translatedText is available before returning
            if (data.translatedText) {
                return data.translatedText;
            } else {
                console.error('No translatedText received:', data);
                return text;  // Return the original text if translation failed
            }

        } catch (error) {
            if (attempt < retries) {
                console.warn(`Error during translation, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;  // Exponential backoff
            } else {
                console.error('Error during translation after retries:', error);
                return text;  // Return the original text after all retries
            }
        }
    }
    console.error('Translation failed after multiple retries.');
    return text;  // Return the original text after all retries have failed
}
