mapboxgl.accessToken = 'pk.eyJ1IjoiZmFsY29ud2F0Y2giLCJhIjoiY2x5ZWIwcDJhMDBxbTJqc2VnYWMxeWNvdCJ9.bijpr26vfErYoGhhlQnaFA';
mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js');

let map;  // Declare the map variable in the global scope
let isZoomingToPin = false; // Flag to indicate if we are zooming to a pin

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded event fired1.');

    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('role');

    // Debugging statements to verify values
    console.log('Token:', token);
    console.log('Role:', role);

    // Redirect to login if no token is found
    if (!token) {
        console.error('No auth token found. Redirecting to login.');
        window.location.href = '/html/login.html';
        return;
    }

    // Redirect to login if the user is not a police officer
    if (role !== 'police') {
        alert('Access denied. Tracking is enabled only for police users.');
        window.location.href = '/html/login.html';
        return;
    }

    // Set up the Socket.IO connection
    const socket = initializeSocket();

    console.log('Emitting authenticate event with token:', token);
    socket.emit('authenticate', { token });

    socket.on('authenticated', (data) => {
        console.log('Authentication response received:', data);

        if (data.success) {
            const { id: userId, name, role } = data.user; // Ensure 'role' is part of the data.user object
            console.log('Authenticated user:', userId, name, role);

            // Update the user name on the page
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = name;
                console.log('User name updated on page:', name);
            } else {
                console.error('User name element not found on the page.');
            }

            if (role === 'police') {
                // Initialize the map and related functionalities only for police role
                console.log('Initializing map and related functionalities...');
                map = initializeMap();
                trackUserLocation(userId, name, map, socket);
                listenForPoliceLocations(userId, map, socket);
                setupMapStyleSwitcher(map);
                fetchReportsAndAddToMap(map);
                listenForNewReports(map, socket);
                setupLanguageControls(map);
                handleShowPinFromURL(map);
            } else {
                console.error('Access denied: User role is not police.');
                window.location.href = '/html/login.html';
            }
        } else {
            console.error('Authentication failed:', data.message || 'Unknown error');
            window.location.href = '/html/login.html';
        }
    });

    socket.on('disconnect', () => {
        console.warn('Disconnected from server.');
        alert('Connection lost. Please check your internet connection.');
        window.location.href = '/html/login.html';
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert('An error occurred. Please try again later.');
    });

    const signOutButton = document.getElementById('signout-button');
    if (signOutButton) {
        signOutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken'); // Remove auth token
            localStorage.removeItem('role'); // Remove role
            window.location.href = '/html/login.html'; // Redirect to login page
        });
    } else {
        console.error('Sign Out button not found.');
    }
});

// Ensure initializeSocket is defined and correctly connects to your Socket.IO server
function initializeSocket() {
    console.log('Initializing Socket.IO connection...');
    const socket = io.connect(); 
    socket.on('connect', () => {
        console.log('Socket.IO connected:', socket.id);
    });
    return socket;
}

// Initialize Mapbox
function initializeMap() {
    const mapState = getSavedMapState();

    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/standard',
        zoom: mapState.zoom || 15,
        center: mapState.center || [55.146127904809504, 25.041687862886718], // Default center
        bearing: mapState.bearing || -50,
        minZoom: 14,
        maxZoom: 18,
        pitch: mapState.pitch || 0
    });

    console.log('Map initialized.');

    map.on('load', () => {
        setMapLightBasedOnTime();
        setInterval(setMapLightBasedOnTime, 60000);  // Update every minute

        restoreMapState(map); // Restore the map's previous state
    });

    // Save map state on unload
    window.addEventListener('beforeunload', () => saveMapState(map));

    return map;
}

// Save map state to sessionStorage
function saveMapState(map) {
    const mapState = {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch()
    };
    sessionStorage.setItem('mapState', JSON.stringify(mapState));
    console.log('Map state saved:', mapState);
}

// Get saved map state from sessionStorage
function getSavedMapState() {
    const mapState = sessionStorage.getItem('mapState');
    return mapState ? JSON.parse(mapState) : {};
}

// Restore the map's previous state
function restoreMapState(map) {
    const mapState = getSavedMapState();
    if (mapState.center && mapState.zoom) {
        map.setCenter(mapState.center);
        map.setZoom(mapState.zoom);
        map.setBearing(mapState.bearing);
        map.setPitch(mapState.pitch);
        console.log('Map state restored:', mapState);
    }
}

// Setup language controls
function setupLanguageControls(map) {
    const languageControl = new MapboxLanguage({ defaultLanguage: 'en' });
    map.addControl(languageControl);

    document.getElementById('EnglishLanguage').addEventListener('click', () => setMapLanguage('en', map));
    document.getElementById('ArabicLanguage').addEventListener('click', () => setMapLanguage('ar', map));
}

function setMapLanguage(language, map) {
    // Apply the language to the map's layers
    map.getStyle().layers.forEach((layer) => {
        if (layer.layout && layer.layout['text-field']) {
            map.setLayoutProperty(layer.id, 'text-field', ['get', `name_${language}`]);
        }
    });
}


function listenForNewReports(map, socket) {
    socket.on('newReport', (report) => {
        console.log('New report received:', report);
        addReportToMap(report, map);  // Add the new report to the map
    });
}


// Function when the user clicks 'show pin'
function handleShowPinFromURL(map) {
    const params = new URLSearchParams(window.location.search);
    const lng = parseFloat(params.get('lng'));
    const lat = parseFloat(params.get('lat'));

    if (!isNaN(lng) && !isNaN(lat)) {
        console.log('Zooming to coordinates from URL:', lng, lat);

        if (map.isStyleLoaded()) {
            flyToPin(map, lng, lat);
        } else {
            map.on('load', function () {
                flyToPin(map, lng, lat);
            });
        }
    } else {
        console.log('No valid coordinates found in the URL.');
    }
}

// Function to fly to the pin's coordinates
function flyToPin(map, lng, lat) {
    map.flyTo({
        center: [lng, lat],
        zoom: 16, // Adjust the zoom level as needed
        essential: true
    });

    new mapboxgl.Popup({ offset: 25 })
        .setLngLat([lng, lat])
        .setHTML('<p>Incident Location</p>')
        .addTo(map);

    console.log('Map has flown to the coordinates:', [lng, lat]);
}

// Call the function after initializing the map
document.addEventListener('DOMContentLoaded', function() {
    if (map) {
        handleShowPinFromURL(map);
    } else {
        console.error('Map is not initialized.');
    }
});

// Track user location
function trackUserLocation(userId, userName, map, socket) {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }

    let userMarker = null; // Variable to hold the user's marker

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            // Only center the map on the user's location if we're not zooming to a pin and there's no saved map state
            if (!isZoomingToPin && !getSavedMapState().center) {
                map.once('moveend', () => {
                    map.setCenter([longitude, latitude]);
                    console.log(`Map centered on user's location: Latitude: ${latitude}, Longitude: ${longitude}`);
                });
            }

            // Update or create the user marker
            if (userMarker) {
                userMarker.setLngLat([longitude, latitude]);
            } else {
                const el = document.createElement('div');
                el.className = 'police-marker';
                el.style.backgroundImage = 'url(/img/police.png)';
                el.style.width = '50px';
                el.style.height = '50px';

                userMarker = new mapboxgl.Marker(el)
                    .setLngLat([longitude, latitude])
                    .addTo(map);
            }

            // Emit location data through the socket
            const locationData = { userId, userName, latitude, longitude };
            socket.emit('locationUpdate', locationData);
        },
        (error) => {
            console.error('Geolocation error:', error);
            alert('Unable to retrieve location. Please check your location settings.');
        },
        { 
            enableHighAccuracy: true, // Use high accuracy for better tracking
            maximumAge: 0, // Ensure getting the freshest location data
            timeout: Infinity // Disable the built-in timeout to keep tracking active
        }
    );

    // Remove the marker if the user goes offline
    socket.on('onlineStatusUpdate', (data) => {
        if (data.userId === userId && !data.isOnline && userMarker) {
            userMarker.remove();
            userMarker = null;
        }
    });
}


// Listen for location updates from other police users
function listenForPoliceLocations(currentUserId, map, socket) {
    socket.on('locationUpdate', (data) => {
        const { userId, latitude, longitude, userName } = data;
        if (userId === currentUserId) return; // Skip updating the marker for the current user

        if (!userId || typeof latitude !== 'number' || typeof longitude !== 'number') {
            console.error('Invalid location update data:', data);
            return;
        }

        updateOrAddMarker(map, userId, latitude, longitude, userName);
    });

    socket.on('onlineStatusUpdate', (data) => {
        if (data.isOnline === false) {
            removeMarker(map, data.userId);
        }
    });
}


// Update or add a marker for police locations with the officer's name
function updateOrAddMarker(map, userId, latitude, longitude, userName) {
    console.log(`Updating or adding marker for user ${userId} at [${longitude}, ${latitude}]`);

    if (!window.userMarkers) {
        window.userMarkers = {};
    }

    if (window.userMarkers[userId]) {
        // Update marker location
        window.userMarkers[userId].marker.setLngLat([longitude, latitude]);

        // Update the label with the officer's name
        window.userMarkers[userId].nameLabel.textContent = userName;
    } else {
        // Create a container for the marker and label
        const markerContainer = document.createElement('div');
        markerContainer.className = 'police-marker-container';

        // Create the label for the officer's name
        const nameLabel = document.createElement('div');
        nameLabel.className = 'police-name-label';
        nameLabel.textContent = userName;

        // Create the marker element
        const markerElement = document.createElement('div');
        markerElement.className = 'police-marker';
        markerElement.style.backgroundImage = 'url(/img/police.png)';
        markerElement.style.width = '50px';
        markerElement.style.height = '50px';

        // Append the name label and marker to the container
        markerContainer.appendChild(nameLabel);
        markerContainer.appendChild(markerElement);

        // Create the marker with the container
        const marker = new mapboxgl.Marker(markerContainer)
            .setLngLat([longitude, latitude])
            .addTo(map);

        window.userMarkers[userId] = { marker, nameLabel };

        console.log(`Added new marker for user ${userId}`);
    }
}

// Remove marker for a user when they go offline
function removeMarker(map, userId) {
    if (window.userMarkers && window.userMarkers[userId]) {
        window.userMarkers[userId].marker.remove(); // Remove the marker from the map
        delete window.userMarkers[userId]; // Delete the reference from the global object
        console.log(`Removed marker for user ${userId}`);
    }
}


function fetchReportsAndAddToMap(map, token) {
    const storedToken = localStorage.getItem('authToken'); // Ensure token is retrieved from localStorage
    console.log('Token being sent:', storedToken); // Log the token being sent

    fetch('/api/reports', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`  // Include the token in the request
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Access forbidden: You do not have permission to access this resource.');
            }
            throw new Error('Failed to fetch reports from the server.');
        }
        return response.json();
    })
    .then(reports => {
        console.log('Fetched reports:', reports);
        if (Array.isArray(reports)) {
            reports.forEach(report => {
                addReportToMap(report, map);
            });
        } else {
            console.error('Invalid response format for reports:', reports);
        }
    })
    .catch(error => {
        console.error('Error fetching and adding reports to map:', error);
    });
}


function addReportToMap(report, map) {
    // Log the full report object for debugging
    console.log('New report received:', report);

    // Validate the structure of the coordinates object
    const lng = report.coordinates.lng || report.coordinates.x;
    const lat = report.coordinates.lat || report.coordinates.y;

    if (typeof lng !== 'number' || typeof lat !== 'number') {
        console.error('Invalid coordinates for report:', report, 'Coordinates:', report.coordinates);
        return;
    }

    const coordinates = [lng, lat];
    console.log('Adding marker at coordinates:', coordinates);

    const markerElement = document.createElement('div');
    markerElement.className = 'custom-marker';

    switch (report.severity.toLowerCase()) {
        case 'high':
            markerElement.classList.add('red-marker', 'pulse');
            break;
        case 'medium':
            markerElement.classList.add('orange-marker');
            break;
        case 'low':
            markerElement.classList.add('green-marker');
            break;
        default:
            markerElement.classList.add('blue-marker');
            break;
    }

    // Fallbacks in case the category or created_at fields are missing
    const category = report.category || 'Unknown Category';
    const createdAt = report.created_at ? new Date(report.created_at).toLocaleString() : 'Unknown Date';

    // Log values for debugging
    console.log('Category:', category);
    console.log('Created At:', createdAt);

    new mapboxgl.Marker(markerElement)
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
                <h3>${category}</h3>
                <p><strong>Severity:</strong> ${report.severity}</p>
                <p><strong>Description:</strong> ${report.description}</p>
                <p><strong>Reported At:</strong> ${createdAt}</p>
            `))
        .addTo(map);
}


// Setup map style switcher
function setupMapStyleSwitcher(map) {
    const styles = {
        'satellite-map': 'mapbox://styles/mapbox/satellite-v9',
        'white-map': 'mapbox://styles/mapbox/light-v11',
        'dark-map': 'mapbox://styles/mapbox/dark-v11',
        'standard-map': 'mapbox://styles/mapbox/standard',
        'arabic-map': 'mapbox://styles/mapbox/satellite-streets-v12'
    };

    Object.keys(styles).forEach(id => {
        const styleButton = document.getElementById(id);
        if (styleButton) {
            styleButton.addEventListener('click', () => {
                map.setStyle(styles[id]);
                console.log(`Map style switched to: ${styles[id]}`);
            });
        } else {
            console.warn(`Style button with ID "${id}" not found.`);
        }
    });
}


function getDubaiTimeOfDay() {
    const dubaiTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" });
    const hours = new Date(dubaiTime).getHours();

    if (hours >= 5 && hours < 12) {
        return 'dawn';
    } else if (hours >= 12 && hours < 15) {
        return 'day';
    } else if (hours >= 15 && hours < 18) { 
        return 'dusk';
    } else {
        return 'night';
    }
}


let lastAppliedLightPreset = '';

function setMapLightBasedOnTime() {
    // Check if the map is initialized and loaded before proceeding
    if (!map || !map.isStyleLoaded()) {
        console.warn('Map is not initialized or style is not loaded.');
        return;
    }

    const timeOfDay = getDubaiTimeOfDay();
    
    if (timeOfDay === lastAppliedLightPreset) {
        return; // Exit early if the preset hasn't changed
    }

    lastAppliedLightPreset = timeOfDay;
    console.log(`Applying light preset for ${timeOfDay}: ${timeOfDay}`);

    map.setConfigProperty('basemap', 'lightPreset', timeOfDay);
}

// Call this function whenever you need to update the map lighting based on time
setMapLightBasedOnTime();

// Optionally, set up a timer to periodically check and update the lighting
setInterval(setMapLightBasedOnTime, 60000); // Check every minute



// Toggle reporting page
const reportingButton = document.getElementById('toggle-reporting');
if (reportingButton) {
    reportingButton.addEventListener('click', function () {
        window.location.href = '/html/report.html';  // Adjust the path as needed
    });
} else {
    console.warn('Element with ID "toggle-reporting" not found.');
}

// Toggle timeline visibility
const toggleTimelineTab = document.getElementById('toggle-timeline-tab');
if (toggleTimelineTab) {
    toggleTimelineTab.addEventListener('click', function () {
        const timelineContainer = document.getElementById('timeline-container');
        const toggleArrow = document.getElementById('toggle-arrow');

        if (timelineContainer.classList.contains('show')) {
            timelineContainer.classList.remove('show');
            this.style.bottom = '0px';
            toggleArrow.style.transform = 'rotate(0deg)';
        } else {
            timelineContainer.classList.add('show');
            this.style.bottom = '153px';
            toggleArrow.style.transform = 'rotate(180deg)';
        }
    });
} else {
    console.warn('Element with ID "toggle-timeline-tab" not found.');
}

// Fetch and add reports to timeline
function fetchReports() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found, redirecting to login...');
        window.location.href = '/html/login.html';
        return;
    }

    return fetch('/api/reports', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized access - token may be invalid or expired.');
                window.location.href = '/html/login.html';
            }
            throw new Error('Failed to fetch reports');
        }
        return response.json();
    })
    .then(reports => {
        if (!Array.isArray(reports)) {
            throw new Error('Invalid response format');
        }
        return reports;
    })
    .catch(error => {
        console.error('Error fetching reports:', error);
        throw error;
    });
}

// Add reports to timeline
function addReportsToTimeline(reports) {
    const timeline = document.getElementById('timeline');
    const dateMarkers = {};

    reports.forEach(report => {
        const dot = document.createElement('div');
        dot.className = 'timeline-dot';
        dot.dataset.severity = report.severity.toLowerCase();
        dot.dataset.incidentId = report.id;

        dot.style.backgroundColor = getSeverityColor(report.severity);

        dot.addEventListener('click', () => showNewCrimeDetailsPopup(report));

        const reportDate = new Date(report.created_at);
        const reportDay = reportDate.toISOString().split('T')[0];
        dot.dataset.date = reportDay;

        if (!dateMarkers[reportDay]) {
            const dateMarker = document.createElement('div');
            dateMarker.className = 'timeline-date-marker';
            dateMarker.dataset.date = reportDay;
            dateMarker.innerHTML = `<div class="timeline-date"><span>${reportDate.getDate()} ${reportDate.toLocaleString('default', { month: 'short' })}</span></div>`;
            dateMarkers[reportDay] = dateMarker;
            timeline.appendChild(dateMarker);
        }

        dateMarkers[reportDay].appendChild(dot);
    });
}

// Show crime details in a popup
function showNewCrimeDetailsPopup(report) {
    const popupContent = `
        <div class="popup-content">
            <h3>Incident Details</h3>
            <p><strong>Report ID:</strong> ${report.id}</p>
            <p><strong>Severity:</strong> ${report.severity}</p>
            <p><strong>Description:</strong> ${report.description}</p>
            <p><strong>Created At:</strong> ${new Date(report.created_at).toLocaleString()}</p>
        </div>
    `;

    new mapboxgl.Popup()
        .setLngLat([report.longitude, report.latitude])
        .setHTML(popupContent)
        .addTo(map);
}

// Get severity color for timeline dot
function getSeverityColor(severity) {
    switch (severity.toLowerCase()) {
        case 'high':
            return '#ff0000';
        case 'medium':
            return '#ffa500';
        case 'low':
            return '#00ff00';
        default:
            return '#0000ff';
    }
}

// User stuff

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOMContentLoaded event fired.');

    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/html/login.html';
        return;
    }

    console.log('Auth Token:', token);

    // Handle dropdown toggle
    const userInfo = document.getElementById('user-info');
    const userMenu = document.getElementById('user-menu');

    userInfo.addEventListener('click', function () {
        userInfo.classList.toggle('active');
    });

    // Handle sign out
    const signOutLink = document.getElementById('signout-link');
    if (signOutLink) {
        signOutLink.addEventListener('click', function (event) {
            event.preventDefault();
            localStorage.removeItem('authToken'); // Remove auth token
            window.location.href = '/html/login.html'; // Redirect to login page
        });
    } else {
        console.error('Sign Out link not found.');
    }

    // Close the dropdown if clicking outside of it
    document.addEventListener('click', function (event) {
        if (!userInfo.contains(event.target) && userInfo.classList.contains('active')) {
            userInfo.classList.remove('active');
        }
    });
});
