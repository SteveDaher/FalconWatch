document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const policeAccountsBody = document.getElementById('police-accounts-body');

    function fetchPoliceAccounts(query = '') {
        const token = localStorage.getItem('authToken');
        if (!token) {
            window.location.href = '/html/login.html';
            return;
        }

        fetch(`/api/police-accounts?search=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            policeAccountsBody.innerHTML = ''; // Clear existing rows
            if (Array.isArray(data)) {
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

                // Add event listeners for each select element
                document.querySelectorAll('.role-select').forEach(select => {
                    select.addEventListener('change', handleRoleChange);
                });
            } else {
                console.error('Unexpected response data:', data);
            }
        })
        .catch(error => console.error('Error fetching police accounts:', error));
    }

    function handleRoleChange(event) {
        const email = event.target.dataset.email;
        const newRole = event.target.value;

        if (newRole === 'delete') {
            if (confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
                deleteAccount(email);
            }
        } else {
            updateRole(email, newRole);
        }
    }

    function updateRole(email, role) {
        const token = localStorage.getItem('authToken');

        fetch('/api/police-accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email, role })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Role updated successfully.');
                fetchPoliceAccounts(); // Refresh the list
            } else {
                console.error('Error updating role:', data.message);
            }
        })
        .catch(error => console.error('Error updating role:', error));
    }

    function deleteAccount(email) {
        const token = localStorage.getItem('authToken');

        fetch('/api/police-accounts', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Account deleted successfully.');
                fetchPoliceAccounts(); // Refresh the list
            } else {
                console.error('Error deleting account:', data.message);
            }
        })
        .catch(error => console.error('Error deleting account:', error));
    }

    searchButton.addEventListener('click', () => {
        fetchPoliceAccounts(searchInput.value);
    });

    searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            fetchPoliceAccounts(searchInput.value);
        }
    });

    // Fetch all police accounts on initial load
    fetchPoliceAccounts();
});
