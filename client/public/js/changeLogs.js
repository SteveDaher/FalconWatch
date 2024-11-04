//Path: client/js/changeLog.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken');

    // Hide the content initially
    const pageContent = document.querySelector('body');
    pageContent.style.display = 'none';

    // Redirect to login if no token found
    if (!token) {
        window.location.href = '/html/login.html';
        return;
    }

    try {
        // Fetch user info to check the role
        const userInfoResponse = await fetch('/api/user-info', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!userInfoResponse.ok) throw new Error('Failed to fetch user info.');

        const userInfo = await userInfoResponse.json();

        // Show the content if user is authenticated
        pageContent.style.display = 'block';

        // If the user is a 'police', show the 'Create Update' button
        if (userInfo.role === 'police') {
            document.getElementById('create-update-section').style.display = 'block';
        }

        // Initialize Quill editor after user info is loaded
        initializeQuillEditor();

        // Add event listener for opening and closing the popup
        document.getElementById('create-update-btn').addEventListener('click', openPopup);
        document.getElementById('close-popup').addEventListener('click', closePopup);
        document.getElementById('submit-update-btn').addEventListener('click', submitUpdate);

        // Fetch and display changelog updates
        await fetchChangelogUpdates();

    } catch (error) {
        console.error('Error during initialization:', error);
        window.location.href = '/html/login.html';
    }

    fetch('/api/user-info', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => response.json())
    .then(data => {
        const userNameElement = document.getElementById('user-name');
        userNameElement.textContent = data.name || "Guest"; // Update with fetched name or default to 'Guest'
    })
    .catch(error => console.error('Error fetching user info:', error));

    document.getElementById('signout-link').addEventListener('click', () => {
        localStorage.removeItem('authToken'); // Clear the authentication token
        localStorage.removeItem('role');      // Clear any stored user role
        window.location.href = '/html/login.html'; // Redirect to the login page
    });
});

// Initialize Quill editor
let quill;
function initializeQuillEditor() {
    quill = new Quill('#editor-container', {
        theme: 'snow',  // Snow is the default theme
        placeholder: 'Write update details here...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline'],
                ['link', 'image'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                [{ 'align': [] }],
            ]
        }
    });
}

// Fetch existing changelog updates from the database
async function fetchChangelogUpdates() {
    try {
        const response = await fetch('/api/serverChangeLogs', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Include the token
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch changelog: ${response.statusText}`);
        }

        const changelogData = await response.json();

        if (!Array.isArray(changelogData)) {
            throw new Error('Unexpected data format');
        }

        const changelogContainer = document.getElementById('changelog-updates');
        changelogContainer.innerHTML = '';

        // Get the user role
        const userInfoResponse = await fetch('/api/user-info', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        const userInfo = await userInfoResponse.json();
        const isPolice = userInfo.role === 'police';

        changelogData.forEach(update => {
            const updateElement = document.createElement('div');
            updateElement.classList.add('changelog-update');
            updateElement.innerHTML = `
                <h3>FalconWatch ${update.version}</h3>
                <p>${update.content}</p>
                <small>Posted on: ${new Date(update.created_at).toLocaleDateString()}</small>
            `;

            // If the user is a police, show the remove button
            if (isPolice) {
                const removeButton = document.createElement('button');
                removeButton.classList.add('btn', 'remove-btn');
                removeButton.textContent = 'Remove';
                removeButton.addEventListener('click', () => removeChangelog(update.id)); // Attach click event to remove changelog
                updateElement.appendChild(removeButton);
            }

            changelogContainer.appendChild(updateElement);
        });
    } catch (error) {
        console.error('Error fetching changelog:', error);
    }
}


// Open the popup modal to create an update
function openPopup() {
    document.getElementById('updateModal').style.display = 'block';
}

// Close the popup modal
function closePopup() {
    document.getElementById('updateModal').style.display = 'none';
}

// Submit the update content using the Quill editor
async function submitUpdate() {
    const content = quill.root.innerHTML;  // Get content from Quill editor
    if (!content.trim()) return;

    try {
        const response = await fetch('/api/serverChangeLogs/create', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });

        if (!response.ok) throw new Error('Failed to create update.');

        // Close the popup and refresh changelog after creating the new update
        closePopup();
        await fetchChangelogUpdates();  // Refresh the changelog

    } catch (error) {
        console.error('Error creating update:', error);
    }
}

async function removeChangelog(id) {
    const confirmed = confirm('Are you sure you want to remove this changelog update?');
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/serverChangeLogs/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        if (!response.ok) throw new Error('Failed to remove changelog.');

        // Refresh changelog after removing the update
        await fetchChangelogUpdates();
    } catch (error) {
        console.error('Error removing changelog:', error);
    }
}
