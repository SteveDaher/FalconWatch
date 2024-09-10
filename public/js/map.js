// Path: client/public/js/map.js
mapboxgl.accessToken = 'pk.eyJ1IjoiZmFsY29ud2F0Y2giLCJhIjoiY2x5ZWIwcDJhMDBxbTJqc2VnYWMxeWNvdCJ9.bijpr26vfErYoGhhlQnaFA';
mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js');

let map;  // Declare the map variable in the global scope
let isZoomingToPin = false; // Flag to indicate if we are zooming to a pin

document.addEventListener('DOMContentLoaded', function () {

    // Hide the page content initially
    const pageContent = document.querySelector('.page-content');
    pageContent.style.display = 'none';

    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('role');

    // Redirect to login if no auth token or the role isn't 'police'
    if (!token || role !== 'police') {
        console.error('Authentication failed. Redirecting to login.');
        window.location.href = '/html/login.html';
        return;
    }

    // Set up the Socket.IO connection
    const socket = initializeSocket();

    socket.emit('authenticate', { token });

    socket.on('authenticated', (data) => {

        if (data.success) {
            const { id: userId, name, role } = data.user; // Ensure 'role' is part of the data.user object

            // Update the user name on the page
            const userNameElement = document.getElementById('user-name');
            if (userNameElement) {
                userNameElement.textContent = name;
            } else {
                console.error('User name element not found on the page.');
            }

            if (role === 'police') {
                // Now that the user is authorized, show the page content
                pageContent.style.display = 'block';

                // Initialize the map and related functionalities only for police role
                map = initializeMap();
                setupMapStyleSwitcher(map);
                setupLanguageControls(map);
                trackUserLocation(userId, name, map, socket);
                fetchReportsAndAddToMap(map);
                listenForPoliceLocations(userId, map, socket);
                listenForNewReports(map, socket);
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
    }
});

// Ensure initializeSocket is defined and correctly connects to your Socket.IO server
function initializeSocket() {
    const socket = io.connect(); 
    socket.on('connect', () => {
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
        minZoom: 10,
        maxZoom: 21,
        pitch: mapState.pitch || 0
    });


    
    map.on('load', () => {
        setMapLightBasedOnTime();
        setInterval(setMapLightBasedOnTime, 600000);  // Update every minute

        restoreMapState(map); // Restore the map's previous state
        
        // Add a 4-second buffer before hiding the loading screen
    setTimeout(() => {
        document.getElementById('loading-screen').style.display = 'none'; // Hide loading screen after 4 seconds
        document.getElementById('content').style.display = 'block'; // Show the content
    }, 4000); // 4000 milliseconds = 4 seconds

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


// Function when the user clicks 'show pin'
function handleShowPinFromURL(map) {
    const params = new URLSearchParams(window.location.search);
    const lng = parseFloat(params.get('lng'));
    const lat = parseFloat(params.get('lat'));

    if (!isNaN(lng) && !isNaN(lat)) {

        if (map.isStyleLoaded()) {
            flyToPin(map, lng, lat);
        } else {
            map.on('load', function () {
                flyToPin(map, lng, lat);
            });
        }
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

}

// Call the function after initializing the map
document.addEventListener('DOMContentLoaded', function() {
    if (map) {
        handleShowPinFromURL(map);
    } else {
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

    }
}

// Remove marker for a user when they go offline
function removeMarker(map, userId) {
    if (window.userMarkers && window.userMarkers[userId]) {
        window.userMarkers[userId].marker.remove(); // Remove the marker from the map
        delete window.userMarkers[userId]; // Delete the reference from the global object
    }
}

// Function to actually add to the map
function fetchReportsAndAddToMap(map) {
    const storedToken = localStorage.getItem('authToken');
    
    if (!storedToken) {
        console.error('No auth token found. Redirecting to login...');
        window.location.replace("/html/login.html");
        return;
    }

    fetch('/api/reports', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => { 
                throw new Error(`Failed to fetch reports: ${text}`); 
            });
        }
        return response.json();
    })
    .then(reports => {
        if (Array.isArray(reports)) {
            // First, add reports to the map
            reports.forEach(report => {
                if (report.lng !== undefined && report.lat !== undefined) {
                    addReportToMap(report, map);
                } else {
                    console.error('Missing coordinates in report:', report);
                }
            });

            // Then, update the filter list
            addReportsToFilterList(reports);
        } else {
            console.error('Invalid response format for reports:', reports);
        }
    })
    .catch(error => {
        console.error('Error fetching and adding reports to map:', error);
    });
}

// Helper function to capitalize the category names
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

// Function to add a report to the map with a marker and custom popup
function addReportToMap(report, map) {
    const lng = report.lng;
    const lat = report.lat;

    if (typeof lng !== 'number' || typeof lat !== 'number') {
        console.error('Invalid coordinates for report:', report);
        return;
    }

    const coordinates = [lng, lat];

    // Create a marker element
    const markerElement = document.createElement('div');
    markerElement.classList.add('custom-marker');
    markerElement.setAttribute('data-category', report.category.toLowerCase());

    // Apply marker color based on the severity of the report
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

    // Create custom popup content with coordinates
    const popupContent = createPopupContent({
        category: report.category || 'Unknown Category',
        severity: report.severity,
        description: report.description,
        createdAt: report.created_at ? new Date(report.created_at).toLocaleString() : 'Unknown Date',
        filePath: report.file_path,
        fileType: report.file_type,
        coordinates
    });

    // Create and add the marker to the map with the custom popup content
    const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 })
        .setDOMContent(popupContent))
        .addTo(map);


    // Store the marker in a global object for filtering
    if (!window.mapMarkers) {
        window.mapMarkers = {};
    }
    window.mapMarkers[report.id] = marker;  // Log storing the marker
}


// Function to create custom popup content
function createPopupContent({ category, severity, description, createdAt, filePath, fileType, coordinates }) {
    const popupContent = document.createElement('div');
    popupContent.className = 'report-popup'; // Apply the custom CSS class

    // Create and append the category element
    const categoryElement = document.createElement('h3');
    categoryElement.textContent = category;
    popupContent.appendChild(categoryElement);

    // Create and append the description element
    const descriptionElement = document.createElement('p');
    descriptionElement.innerHTML = `<strong>Description:</strong> ${description}`;
    popupContent.appendChild(descriptionElement);

    // Create and append the reportedAt element
    const reportedAtElement = document.createElement('p');
    reportedAtElement.innerHTML = `<strong>Reported At:</strong> ${createdAt}`;
    popupContent.appendChild(reportedAtElement);

    // Create and append the severity element
    const severityElement = document.createElement('p');
    severityElement.innerHTML = `<strong>Severity:</strong> ${severity}`;
    popupContent.appendChild(severityElement);

    // Create a container for the buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.style.display = 'flex'; // Ensure buttons are aligned in a row
    buttonContainer.style.justifyContent = 'space-between'; // Distribute space evenly

    if (filePath) {
        // Create and append the attachment button
        const attachmentButton = document.createElement('button');
        attachmentButton.classList.add('view-attachment-btn');
        attachmentButton.textContent = 'View Attachment';
        attachmentButton.style.flex = '1'; // Make the button take up equal space
        attachmentButton.onclick = () => {
            showAttachmentInContainer(filePath, fileType);
        };
        buttonContainer.appendChild(attachmentButton);
    }

    // Create an element for the ETA
    const etaElement = document.createElement('div');
    etaElement.id = 'eta-display';
    etaElement.textContent = 'ETA: Calculating...';
    etaElement.style.marginBottom = '5px'; // Add some spacing between the ETA and the button

    // Create and append the auto-direct button
    const autoDirectButton = document.createElement('button');
    autoDirectButton.id = 'auto-direct-button'; // Ensure the button has an ID
    autoDirectButton.classList.add('auto-direct-btn');
    autoDirectButton.textContent = isAutoDirecting ? 'Cancel Auto-Direct' : 'Auto-Direct';
    autoDirectButton.style.flex = '1'; // Make the button take up equal space
    autoDirectButton.onclick = () => {
        if (isAutoDirecting) {
            cancelAutoDirect(map);
            autoDirectButton.textContent = 'Auto-Direct';
        } else {
            directToMarker(map, coordinates[0], coordinates[1]);
            autoDirectButton.textContent = 'Cancel Auto-Direct';
        }
    };

    // Create and append the ETA and Auto-Direct button inside a vertical container
    const etaButtonContainer = document.createElement('div');
    etaButtonContainer.style.display = 'flex';
    etaButtonContainer.style.flexDirection = 'column';
    etaButtonContainer.style.alignItems = 'center'; // Center the content horizontally

    // Append ETA to this container
    etaButtonContainer.appendChild(etaElement);

    // Append the Auto-Direct button to this container
    etaButtonContainer.appendChild(autoDirectButton);

    // Append the combined container to the buttonContainer
    buttonContainer.appendChild(etaButtonContainer);

    popupContent.appendChild(buttonContainer);

    return popupContent;
}

// Function to toggle the Directions control
function toggleDirectionsControl(map) {
    if (!directionsControl) {
        // Initialize the Directions control if it doesn't exist
        directionsControl = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            unit: 'metric',
            profile: 'mapbox/driving-traffic',
        });
        map.addControl(directionsControl, 'top-left');
        document.getElementById('auto-direct-button').textContent = 'Disable Directions';
    } else {
        // Remove the Directions control if it exists
        map.removeControl(directionsControl);
        directionsControl = null;
        document.getElementById('auto-direct-button').textContent = 'Auto-Direct';
    }
}

function updateETA(eta) {
    let etaElement = document.getElementById('eta-display');
    if (!etaElement) {
        // If the element doesn't exist, create it
        etaElement = document.createElement('div');
        etaElement.id = 'eta-display';
        etaElement.style.marginBottom = '5px';

        const autoDirectButton = document.getElementById('auto-direct-button');
        if (autoDirectButton && autoDirectButton.parentNode) {
            autoDirectButton.parentNode.insertBefore(etaElement, autoDirectButton);
        } else {
            return;
        }
    }
    
    // Update the content of the ETA element
    etaElement.textContent = `ETA: ${eta}`;
}


// Auto Direct Functionality
let directionsControl = null;
let userLocation = null;
let isAutoDirecting = false;
let routeLayerId = 'auto-direct-route'; // Layer ID for the route

// Function to fetch and display the route using Mapbox Directions API
function directToMarker(map, lng, lat) {
    if (!lng || !lat) {
        console.error('Invalid coordinates for Auto Direct.');
        return;
    }

    if (!isAutoDirecting) {
        // Fetch the route from the user's location to the destination with traffic data
        if (userLocation) {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${userLocation.longitude},${userLocation.latitude};${lng},${lat}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

            fetch(url)
                .then(response => response.json())
                .then(data => {
                    if (!data.routes || data.routes.length === 0) {
                        console.error('No route found');
                        return;
                    }

                    const route = data.routes[0].geometry;
                    const duration = data.routes[0].duration; // in seconds
                    const eta = formatDuration(duration);

                    // Update the ETA display
                    updateETA(eta);

                    // Add the route to the map
                    if (map.getSource(routeLayerId)) {
                        map.getSource(routeLayerId).setData(route);
                    } else {
                        map.addSource(routeLayerId, {
                            type: 'geojson',
                            data: route
                        });

                        map.addLayer({
                            id: routeLayerId,
                            type: 'line',
                            source: routeLayerId,
                            layout: {
                                'line-join': 'round',
                                'line-cap': 'round'
                            },
                            paint: {
                                'line-color': '#007bff',
                                'line-width': 4
                            }
                        });
                    }

                    // Fly to the destination
                    map.flyTo({
                        center: [lng, lat],
                        zoom: 16,
                        essential: true
                    });

                    // Update button text to "Cancel Auto Direct"
                    const autoDirectButton = document.getElementById('auto-direct-button');
                    autoDirectButton.textContent = 'Cancel Auto Direct';

                    isAutoDirecting = true;
                })
                .catch(error => {
                    console.error('Error fetching route:', error);
                });
        } else {
            console.warn('User location is not yet available.');
        }
    } else {
        cancelAutoDirect(map);
    }
}

// Function to format duration (in seconds) into a readable format
function formatDuration(duration) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes} min ${seconds} sec`;
}

function clearETA() {
    const etaElement = document.getElementById('eta-display');
    if (etaElement) {
        etaElement.textContent = ''; // Clear the text content
    }
}

function cancelAutoDirect(map) {
    // Remove the route layer from the map
    if (map.getLayer(routeLayerId)) {
        map.removeLayer(routeLayerId);
        map.removeSource(routeLayerId);
    } else {
        console.warn("Route layer not found on the map.");
    }

    // Clear the ETA display
    clearETA();

    // Reset button text to "Auto Direct"
    const autoDirectButton = document.getElementById('auto-direct-button');
    if (autoDirectButton) {
        autoDirectButton.textContent = 'Auto Direct';
    } else {
        console.warn("Auto Direct button not found.");
    }

    // Stop auto-directing
    isAutoDirecting = false;  
    // Remove the directions control if it exists
    if (directionsControl) {
        map.removeControl(directionsControl);
        directionsControl = null;
    }

    // Stop tracking user location for auto-direct
    navigator.geolocation.clearWatch(userLocationWatcherId);
}

let userLocationWatcherId;

// tracking user for auto-direct
userLocationWatcherId = navigator.geolocation.watchPosition(
    (position) => {
        userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };


        // Update route if Auto Direct is active
        if (isAutoDirecting) {
            // Update the route with the new user location
            const destination = directionsControl && directionsControl.destination;
            if (destination) {
                directToMarker(map, destination[0], destination[1]);
            }
        }
    },
    (error) => {
        console.error('Error tracking user location:', error);
        alert('Unable to retrieve location. Please check your location settings.');
    },
    {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: Infinity
    }
);

// For when user clicks show attachment
function showAttachmentInContainer(filePath, fileType) {

    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found.');
        return;
    }

    // Fetch the file with the Authorization header
    fetch(filePath, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        return response.blob();
    })
    .then(blob => {
        const modal = document.createElement('div');
        modal.className = 'attachment-modal';

        const modalContent = document.createElement('div');
        modalContent.className = 'attachment-modal-content';

        const closeButton = document.createElement('span');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.onclick = () => modal.remove();

        if (fileType === 'image') {
            const image = document.createElement('img');
            image.src = URL.createObjectURL(blob);
            image.alt = "Attachment Image";
            image.className = 'attachment-image';
            modalContent.appendChild(image);
        } else if (fileType === 'video') {
            const video = document.createElement('video');
            video.src = URL.createObjectURL(blob);
            video.controls = true;
            video.className = 'attachment-video';
            modalContent.appendChild(video);
        } else {
            console.error('Unsupported file type:', fileType);
            return;
        }

        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    })
    .catch(error => {
        console.error('Error fetching the attachment:', error);
    });
}


function listenForNewReports(map, socket) {
    socket.on('newReport', (report) => {
        if (report.lng !== undefined && report.lat !== undefined) {
            addReportToMap(report, map);
        } else {
            console.error('Missing coordinates in report:', report);
        }
    });
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
        return;
    }

    const timeOfDay = getDubaiTimeOfDay();
    
    if (timeOfDay === lastAppliedLightPreset) {
        return; // Exit early if the preset hasn't changed
    }

    lastAppliedLightPreset = timeOfDay;

    map.setConfigProperty('basemap', 'lightPreset', timeOfDay);
}

// Call this function whenever you need to update the map lighting based on time
setMapLightBasedOnTime();

// Optionally, set up a timer to periodically check and update the lighting
setInterval(setMapLightBasedOnTime, 600000); // Check every minute


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



// Add reports to filter list with crime counts
function addReportsToFilterList(reports) {
    const filterList = document.getElementById('filter-list');
    filterList.innerHTML = ''; // Clear existing reports

    const categoryCounts = {};

    // Count reports per category
    reports.forEach(report => {
        const category = report.category.toLowerCase();
        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }
        categoryCounts[category]++;
    });

    const filterContainer = document.getElementById('category-filters');
    filterContainer.innerHTML = ''; // Clear existing filters

    for (const category in categoryCounts) {
        const count = categoryCounts[category];
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" value="${category}" class="crime-filter" checked>
            ${capitalize(category)} <span class="filter-count">(${count})</span>
        `;
        filterContainer.appendChild(label);
    }

    // Reattach event listeners for filtering
    document.querySelectorAll('.crime-filter').forEach(input => {
        input.addEventListener('change', filterReports);
    });

    // Initially show all markers on the map
    filterReports(); // Call this to apply the initial visibility state
}




// Filter reports based on selected categories
function filterReports() {
    const selectedCategories = Array.from(document.querySelectorAll('.crime-filter:checked')).map(input => input.value);
    
    if (!window.mapMarkers) return;

    for (const markerId in window.mapMarkers) {
        const marker = window.mapMarkers[markerId];
        const markerCategory = marker.getElement().getAttribute('data-category');

        if (selectedCategories.includes(markerCategory)) {
            marker.addTo(map); // Show the marker
        } else {
            marker.remove(); // Hide the marker
        }
    }
}

document.querySelectorAll('.crime-filter').forEach(input => {
    input.addEventListener('change', filterReports);
});

function showMarker(markerId) {
    if (window.mapMarkers && window.mapMarkers[markerId]) {
        window.mapMarkers[markerId].addTo(map);
    }
}

function hideMarker(markerId) {
    if (window.mapMarkers && window.mapMarkers[markerId]) {
        window.mapMarkers[markerId].remove();
    }
}


// Toggle filter visibility
const toggleFilterTab = document.getElementById('toggle-filter-tab');
if (toggleFilterTab) {
    toggleFilterTab.addEventListener('click', function () {
        const filterContainer = document.getElementById('filter-container');
        const toggleArrow = document.getElementById('toggle-arrow');

        if (filterContainer.classList.contains('show')) {
            filterContainer.classList.remove('show');
            this.style.bottom = '0px';
            toggleArrow.style.transform = 'rotate(0deg)';
        } else {
            filterContainer.classList.add('show');
            this.style.bottom = '153px'; // Adjust the value based on the height of the filter container
            toggleArrow.style.transform = 'rotate(180deg)';
        }
    });
}

// User and filter stuff
document.addEventListener('DOMContentLoaded', function () {

    const loadingScreen = document.getElementById('loading-screen');
    const content = document.getElementById('content');
    const toggleFilterTab = document.getElementById('toggle-filter-tab');
    const filterContainer = document.getElementById('filter-container');
    const toggleArrow = document.getElementById('toggle-arrow');

    // Hide the loading screen and show the content after 4 seconds
    setTimeout(function () {
        loadingScreen.style.display = 'none';
        content.style.display = 'block';
        
        // Trigger map resize
        if (typeof map !== 'undefined') {
            map.resize();
        }
    }, 4000); // 4 seconds

    // Token Check
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/html/login.html';
        return;
    }

    // Toggle Filter List
    if (toggleFilterTab) {
        toggleFilterTab.addEventListener('click', function () {

            if (filterContainer.classList.contains('filter-shown')) {
                filterContainer.classList.remove('filter-shown');
                filterContainer.classList.add('filter-hidden');
                toggleArrow.style.transform = 'rotate(0deg)';
            } else {
                filterContainer.classList.remove('filter-hidden');
                filterContainer.classList.add('filter-shown');
                toggleArrow.style.transform = 'rotate(180deg)';
            }
        });
    } else {
        console.warn('Element with ID "toggle-filter-tab" not found.');
    }

    // Handle dropdown toggle
    const userInfo = document.getElementById('user-info');
    const userMenu = document.getElementById('user-menu');

    if (userInfo) {
        userInfo.addEventListener('click', function () {
            userInfo.classList.toggle('active');
        });
    }

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
