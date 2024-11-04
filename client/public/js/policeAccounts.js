// Path: client/public/js/policeAccounts.js
document.addEventListener('DOMContentLoaded', async function () {
    // Hide the page content initially
    const pageContent = document.querySelector('body');
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

    // Continue with the rest of the code to fetch and manage police accounts
    const searchInput = document.getElementById('search-input');  // Input field for search queries
    const searchButton = document.getElementById('search-button');  // Button to trigger search
    const policeAccountsBody = document.getElementById('police-accounts-body');  // Table body where accounts are displayed

    /**
     * Fetch police accounts from the server and populate the table.
     * Optionally filter by a search query.
     * @param {string} query - The search query for filtering police accounts.
     */

    function fetchPoliceAccounts(query = '') {
        const token = localStorage.getItem('authToken');  // Get the auth token from localStorage
        if (!token) {
            window.location.href = '/html/login.html';  // Redirect to login if no token is found
            return;
        }

        // Make GET request to fetch police accounts
        fetch(`/api/police-accounts?search=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`  // Add the auth token in headers
            }
        })
        .then(response => response.json())  // Parse the JSON response
        .then(data => {
            policeAccountsBody.innerHTML = '';  // Clear the table body before populating new rows

            // Ensure data is an array before processing
            if (Array.isArray(data)) {
                // Iterate over each police account and create table rows
                data.forEach(account => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${account.badgeNumber || 'N/A'}</td>
                        <td>${account.name}</td>
                        <td>${account.email}</td>
                        <td>${account.role}</td>
                        <td>${new Date(account.created_at).toLocaleDateString()}</td>
                        <td>${account.phone || 'N/A'}</td>
                        <td>
                            <select class="role-select" data-email="${account.email}">
                                <option value="user" ${account.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="police" ${account.role === 'police' ? 'selected' : ''}>Police</option>
                                <option value="delete">Delete</option>
                            </select>
                        </td>
                    `;
                    policeAccountsBody.appendChild(row);
                });

                // Add event listeners to handle role change for each dropdown
                document.querySelectorAll('.role-select').forEach(select => {
                    select.addEventListener('change', handleRoleChange);
                });
            } else {
                console.error('Unexpected response data:', data);
            }
        })
        .catch(error => console.error('Error fetching police accounts:', error));  // Handle fetch errors
    }

    /**
     * Handle changes in role selection or deletion.
     * @param {Event} event - The change event triggered by selecting a new role or delete option.
     */
    function handleRoleChange(event) {
        const email = event.target.dataset.email;  // Get the email of the selected account
        const newRole = event.target.value;  // Get the new role selected

        if (newRole === 'delete') {
            // Confirm deletion before proceeding
            if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
                deleteAccount(email);  // Call function to delete the account
            }
        } else {
            updateRole(email, newRole);  // Call function to update the role
        }
    }

    /**
     * Update the role of a police account.
     * @param {string} email - The email of the account to update.
     * @param {string} role - The new role to assign (user/police).
     */
    function updateRole(email, role) {
        const token = localStorage.getItem('authToken');  // Get the auth token from localStorage

        // Make POST request to update the role
        fetch('/api/police-accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`  // Add the auth token in headers
            },
            body: JSON.stringify({ email, role })  // Send email and new role as JSON
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Role updated successfully.');
                fetchPoliceAccounts();  // Refresh the list after updating role
            } else {
                console.error('Error updating role:', data.message);
            }
        })
        .catch(error => console.error('Error updating role:', error));  // Handle errors
    }

    /**
     * Delete a police account.
     * @param {string} email - The email of the account to delete.
     */
    function deleteAccount(email) {
        const token = localStorage.getItem('authToken');  // Get the auth token from localStorage

        // Make DELETE request to remove the account
        fetch('/api/police-accounts', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`  // Add the auth token in headers
            },
            body: JSON.stringify({ email })  // Send email as JSON
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Account deleted successfully.');
                fetchPoliceAccounts();  // Refresh the list after deleting the account
            } else {
                console.error('Error deleting account:', data.message);
            }
        })
        .catch(error => console.error('Error deleting account:', error));  // Handle errors
    }

    // Event listener for the search button click
    searchButton.addEventListener('click', () => {
        fetchPoliceAccounts(searchInput.value);  // Fetch accounts based on search query
    });

    // Event listener for pressing "Enter" in the search input
    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            fetchPoliceAccounts(searchInput.value);  // Fetch accounts when Enter is pressed
        }
    });

    // Fetch all police accounts on page load
    fetchPoliceAccounts();

} catch (error) {
    console.error('Error during initialization:', error);
    window.location.href = '/html/login.html'; // Redirect to login in case of error
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
