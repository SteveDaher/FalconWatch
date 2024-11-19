    //Path: client/js/report.js
    document.addEventListener('DOMContentLoaded', function() {
        const token = localStorage.getItem('authToken');  // Retrieve the token from localStorage
        const userRole = localStorage.getItem('role');
    
        // Redirect to login page if no token is found
        if (!token) {
            window.location.replace("/html/login.html");
            return; // Stop further script execution
        }

        if (userRole !== 'police') {
            const dashboardLink = document.getElementById('view-services');
            if (dashboardLink) {
                dashboardLink.style.display = 'none';
            }
        }
    
        // Only if a valid token exists, continue with the rest of the script
    
        mapboxgl.accessToken = 'pk.eyJ1IjoiZmFsY29ud2F0Y2giLCJhIjoiY2x5ZWIwcDJhMDBxbTJqc2VnYWMxeWNvdCJ9.bijpr26vfErYoGhhlQnaFA';
    
        // Create a new map instance
        const reportMap = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: [55.2708, 25.2048], // Set to a default center
            zoom: 12
        });
    
        let currentMarker = null; // Variable to store the current marker
    
        const layerList = document.getElementById('menu');
        const inputs = layerList.getElementsByTagName('input');
    
        // Add event listeners to each radio button for map style changes
        for (const input of inputs) {
            input.addEventListener('click', function(layer) {
                const layerId = layer.target.value;
                reportMap.setStyle('mapbox://styles/mapbox/' + layerId);
            });
        }
    
        // Fullscreen control
        document.getElementById('fullscreen-btn').addEventListener('click', function() {
            const mapContainer = document.getElementById('map');
            if (!document.fullscreenElement) {
                mapContainer.requestFullscreen().catch(err => {
                    console.log(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        });
    
        // Add geolocate control to get the user's location
        const geolocateControl = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true,
            showAccuracyCircle: false,
            showUserHeading: true
        });
        reportMap.addControl(geolocateControl);
    
        // Automatically trigger the geolocate control to get the user's location as soon as the map is ready
        reportMap.on('load', function() {
            geolocateControl.trigger();
        });
    
        // Handle the geolocation event to center the map
        geolocateControl.on('geolocate', function(e) {
            const lng = e.coords.longitude;
            const lat = e.coords.latitude;
    
            // Center the map on the user's location
            reportMap.setCenter([lng, lat]);
        });
    
        // Handle map clicks to place a new marker and update the coordinates
      
    reportMap.on('click', function(e) {
        const coordinates = e.lngLat;

        // If there is an existing marker, remove it
        if (currentMarker) {
            currentMarker.remove();
        }

        // Place a new marker at the clicked location
        currentMarker = new mapboxgl.Marker({ color: 'red' })
            .setLngLat(coordinates)
            .addTo(reportMap);

        // Update the hidden input with the coordinates
        document.getElementById('crime-coordinates').value = `${coordinates.lng}, ${coordinates.lat}`;
    });

        // Initialize Socket.IO
        const socket = io();  // Initialize Socket.IO connection
    
        // Authenticate user after connecting to Socket.IO
        socket.emit('authenticate', { token });
    
        // Fetch user info and update the welcome message
        fetch('/api/user-info', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            const welcomeMessage = document.getElementById('welcome-message');
            welcomeMessage.textContent = `Welcome, ${data.name}`;  // Update with the username
        })
        .catch(error => {
            console.error('Error fetching user info:', error);
        });

        document.getElementById('signout-link').addEventListener('click', () => {
            localStorage.removeItem('authToken'); // Clear the authentication token
            localStorage.removeItem('role');      // Clear any stored user role
            window.location.href = '/html/login.html'; // Redirect to the login page
        });

     // Form submission logic
     document.getElementById('crime-report-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);

        // Append additional data to FormData
        formData.append('coordinates', document.getElementById('crime-coordinates').value);

        // Ensure category and description are appended correctly
        formData.append('category', document.getElementById('crime-category').value);
        formData.append('description', document.getElementById('crime-description').value);

        // Send the form data to the server via Fetch API
        fetch('/api/reports', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.message === 'Report submitted successfully.') {
                window.location.href = 'success.html';
            } else {
                alert(`Error: ${data.message}`);
            }
        })
        .catch(error => {
            console.error('Error submitting report:', error);
            alert('An error occurred while submitting the report.');
        });
    });

    // Fetch user info and update the displayed username
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

    document.getElementById('EnglishLanguage').addEventListener('click', function(event) {
        event.preventDefault();
        switchLanguage('en'); // Custom function to switch language to English
    });
    
    document.getElementById('ArabicLanguage').addEventListener('click', function(event) {
        event.preventDefault();
        switchLanguage('ar'); // Custom function to switch language to Arabic
    });
    
    function switchLanguage(language) {
        if (language === 'en') {
            // Apply English text to relevant parts of the page
            document.querySelector('title').textContent = "Report a Crime";
            document.querySelector('.titlepart h1').textContent = "Report";
            document.querySelector('.titlepart p').textContent = "Together we can keep this city a safe place for everyone! Help us by reporting any violations you witnessed.";
        } else if (language === 'ar') {
            // Apply Arabic text to relevant parts of the page
            document.querySelector('title').textContent = "الإبلاغ عن جريمة";
            document.querySelector('.titlepart h1').textContent = "تقديم بلاغ";
            document.querySelector('.titlepart p').textContent = "معًا نستطيع أن نحافظ على هذه المدينة مكانًا آمنًا للجميع! ساعدنا بالإبلاغ عن أي مخالفات قد شهدتها";
        }
    }

});