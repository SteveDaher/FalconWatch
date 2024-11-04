mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js');

let geojsonSourceId = 'dubai-zones-source';
let geojsonLayerId = 'dubai-zones-layer';
let isZoneModeActive = false; // Moved this outside the function to global scope

let map;  // Declare the map variable in the global scope
let isZoomingToPin = false; // Flag to indicate if we are zooming to a pin

let socket; // Declare socket globally

document.addEventListener('DOMContentLoaded', function () {

    socket = initializeSocket();

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

                // Fetch the Mapbox token first, then initialize the map
                fetchMapboxToken()
                    .then(mapboxToken => {
                        map = initializeMap(mapboxToken); // Initialize map after token is fetched
                        setupMapStyleSwitcher(map);
                        setupLanguageControls(map);
                        trackUserLocation(userId, name, map, socket);
                        fetchReportsAndAddToMap(map, socket);
                        listenForPoliceLocations(userId, map, socket);
                        listenForNewReports(map, socket);
                        handleShowPinFromURL(map);
                        initializeReportNotifications(map, socket);
                        initializeSortingControls();
                        reapplySavedFilters();
                    })
                    .catch(error => {
                        console.error('Error fetching Mapbox token:', error);
                        window.location.href = '/html/login.html';
                    });
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
    }

    const mapStyleButton = document.getElementById('map-style-button');
    const mapStyleOptions = document.getElementById('map-style-options');


    // Toggle display of map style options
    mapStyleButton.addEventListener('click', () => {
        mapStyleOptions.style.display = mapStyleOptions.style.display === 'block' ? 'none' : 'block';
    });

    // Change map style on option click
    mapStyleOptions.addEventListener('click', (event) => {
        event.preventDefault();
        const target = event.target.tagName === 'IMG' ? event.target.parentElement : event.target;

        const styleId = target.getAttribute('data-style');

        const styles = {
            'satellite-map-dark': 'mapbox://styles/falconwatch/cm0qnadi200nd01qk1e36dr2i',
            'white-map': 'mapbox://styles/mapbox/light-v11',
            'dark-map': 'mapbox://styles/mapbox/dark-v11',
            'standard-map-dynamic': 'mapbox://styles/mapbox/standard',
            'street-map': 'mapbox://styles/mapbox/satellite-streets-v12',
        };

        if (styles[styleId]) {
            map.setStyle(styles[styleId]);
            mapStyleOptions.style.display = 'none'; // Close options after selection
        }
    });

    // Add event listeners for Report Notifications button and close button
      const reportNotificationsButton = document.getElementById('report-notifications-button');
      const reportNotificationsPanel = document.getElementById('report-notifications-panel');
      const closeNotificationsButton = document.getElementById('close-notifications');
      const statisticsPanel = document.getElementById('statistics-panel');
      const statisticsButton = document.getElementById('statistics-button');
      const closeStatisticsButton = document.getElementById('close-statistics');
  
      function closeAllPanels() {
        reportNotificationsPanel.classList.remove('open');
        statisticsPanel.classList.remove('open');
        manageAlertSound(false); // Ensure sound is off when all panels are closed
    }

    // Function to toggle a specific panel
function togglePanel(panelToToggle, soundHandler = () => {}) {
    // If the panel is already open, close it
    if (panelToToggle.classList.contains('open')) {
        panelToToggle.classList.remove('open');
        soundHandler(false); // Turn off sound if closing Report Notifications panel
    } else {
        // Close only other panels (not all panels) and open the requested one
        if (panelToToggle === reportNotificationsPanel) statisticsPanel.classList.remove('open');
        else if (panelToToggle === statisticsPanel) reportNotificationsPanel.classList.remove('open');

        panelToToggle.classList.add('open');
        if (panelToToggle === reportNotificationsPanel) soundHandler(true);
    }
}


    // Toggle Report Notifications panel on button click
// Toggle Report Notifications panel
reportNotificationsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(reportNotificationsPanel, manageAlertSound);
});

// Close Report Notifications panel via the close button
closeNotificationsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    reportNotificationsPanel.classList.remove('open');
    manageAlertSound(false);
});

// Toggle Statistics panel
statisticsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(statisticsPanel);
    initializeCharts();
});

// Close Statistics panel via the close button
closeStatisticsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    statisticsPanel.classList.remove('open');
});

// Prevent closing the report notifications panel when clicking inside it
reportNotificationsPanel.addEventListener('click', (event) => {
    event.stopPropagation(); // Stops the event from propagating to the outside click listener
});

// Prevent closing the statistics panel when clicking inside it
statisticsPanel.addEventListener('click', (event) => {
    event.stopPropagation();
});



    // Close all panels when clicking outside
    document.addEventListener('click', closeAllPanels);

    async function initializeCharts() {
        await renderMyBarChart();      // Chart 1: Severity over time
        await renderTimeOfDayChart();  // Chart 3: Crime by time of day
        await renderCrimeTrendsChart(); // Chart 4: Crime trends by severity over time

        fetchWeeklyReportSummary();
    }

    async function fetchWeeklyReportSummary() {
        try {
            const response = await fetch('/api/chartData?type=crime-summary', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
    
            const data = await response.json();
            const totals = {
                low: 0,
                medium: 0,
                high: 0,
                totalReports: 0
            };
    
            data.forEach(item => {
                totals.totalReports += item.count;
                if (item.severity === 'low') totals.low += item.count;
                if (item.severity === 'medium') totals.medium += item.count;
                if (item.severity === 'high') totals.high += item.count;
            });
    
            const summaryText = `
                <div><strong>Total incidents this week:</strong> <span class="severity-total">${totals.totalReports}</span></div>
                <div><strong>High-severity cases:</strong> <span class="severity-high">${totals.high}</span></div>
                <div><strong>Medium-severity cases:</strong> <span class="severity-medium">${totals.medium}</span></div>
                <div><strong>Low-severity cases:</strong> <span class="severity-low">${totals.low}</span></div>
            `;
            document.getElementById('weekly-report-summary').innerHTML = summaryText;
    
        } catch (error) {
            console.error('Error fetching weekly report summary:', error);
            document.getElementById('weekly-report-summary').textContent = 'Unable to fetch summary.';
        }
    }

    // Chart 1: Severity over time (from `chart.js`)
    async function renderMyBarChart() {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/chartData', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const monthlyData = {};
        data.forEach(item => {
            const month = `${item.year}-${item.month.toString().padStart(2, '0')}`;
            if (!monthlyData[month]) {
                monthlyData[month] = { low: 0, medium: 0, high: 0 };
            }
            monthlyData[month][item.severity.toLowerCase()] += item.count;
        });

        const labels = Object.keys(monthlyData);
        const lowData = labels.map(month => monthlyData[month].low || 0);
        const mediumData = labels.map(month => monthlyData[month].medium || 0);
        const highData = labels.map(month => monthlyData[month].high || 0);

        const ctx = document.getElementById('myBarChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Low Severity', data: lowData, backgroundColor: 'rgba(255, 235, 59, 0.5)' },
                    { label: 'Medium Severity', data: mediumData, backgroundColor: 'rgba(255, 170, 59, 0.5)' },
                    { label: 'High Severity', data: highData, backgroundColor: 'rgba(244, 67, 54, 0.5)' }
                ]
            },
            options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } }
        });
    }

    // Chart 3: Crime by time of day (from `chart3.js`)
    async function renderTimeOfDayChart() {
        const token = localStorage.getItem('authToken');
        const response = await fetch('/api/chartData?includeHour=true', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        const chartData = data.map(item => ({
            x: item.hour,
            y: item.category,
            count: item.count
        }));

        const ctx = document.getElementById('timeOfDayChart').getContext('2d');
        new Chart(ctx, {
            type: 'scatter',
            data: { datasets: [{ label: 'Crime by Time of Day', data: chartData, backgroundColor: 'rgba(255, 0, 0, 0.6)' }] },
            options: {
                responsive: true,
                scales: {
                    x: { type: 'linear', min: 0, max: 23, title: { display: true, text: 'Hour' } },
                    y: { type: 'category', labels: ['Theft', 'Assault', 'Robbery', 'Burglary', 'Vandalism', 'Human Trafficking', 'Drugs', 'Wilful Murder'], title: { display: true, text: 'Crime Type' } }
                }
            }
        });
    }

    // Chart 4: Crime trends by severity (from `chart4.js`)
    async function renderCrimeTrendsChart() {
        const token = localStorage.getItem('authToken');
        const year = new Date().getFullYear();
        const response = await fetch(`/api/chartData?year=${year}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
    
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const labels = months.map((month, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
        const severities = ['low', 'medium', 'high'];
    
        // Create datasets for each severity level
        const datasets = severities.map(severity => ({
            label: severity.charAt(0).toUpperCase() + severity.slice(1),
            data: labels.map(label => 
                data.filter(d => d.severity === severity && `${d.year}-${String(d.month).padStart(2, '0')}` === label)
                    .reduce((sum, item) => sum + item.count, 0)
            ),
            backgroundColor: { 'low': '#ffb700', 'medium': '#ff9100', 'high': '#ff0000' }[severity],
            stack: 'severity'
        }));
    
        // Calculate total crimes for each month and add as a line dataset
        const totalCrimesData = labels.map(label => 
            data.filter(d => `${d.year}-${String(d.month).padStart(2, '0')}` === label)
                .reduce((sum, item) => sum + item.count, 0)
        );
    
        datasets.push({
            label: 'Total Crimes',
            data: totalCrimesData,
            type: 'line',  // Add this dataset as a line
            borderColor: '#000000',  // Black color for total crimes line
            borderWidth: 2,
            fill: false,
            pointRadius: 3
        });
    
        const ctx = document.getElementById('crimeTrendsChart').getContext('2d');
        new Chart(ctx, {
            type: 'bar',
            data: { labels: months, datasets },
            options: {
                responsive: true,
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === 'Total Crimes') {
                                    return `Total Crimes: ${context.raw}`;
                                }
                                return `${context.dataset.label}: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }

    function showTemporaryPopup(message) {
        const popup = document.createElement('div');
        popup.className = 'temporary-popup';
        popup.innerText = message;
        document.body.appendChild(popup);

        setTimeout(() => {
            popup.style.opacity = '0'; 
            setTimeout(() => popup.remove(), 500); 
        }, 2000);
    }

    // Modified togglePatrolMode function
    function togglePatrolMode(socket) {
        const patrolModeButton = document.getElementById('patrol-mode-button');

        if (!isPatrolModeActive) {
            // Activate Patrol Mode
            isPatrolModeActive = true;
            patrolModeButton.textContent = 'Deactivate Patrol Mode';
            showTemporaryPopup('Patrol Mode Activated');
            socket.emit('patrolModeOn'); // Emit event
        } else {
            // Deactivate Patrol Mode
            isPatrolModeActive = false;
            patrolModeButton.textContent = 'Activate Patrol Mode';
            showTemporaryPopup('Patrol Mode Deactivated');
            socket.emit('patrolModeOff'); // Emit event
        }
    }

    // Event binding for patrol mode button
    const patrolModeButton = document.getElementById('patrol-mode-button');
    if (patrolModeButton) {
        patrolModeButton.addEventListener('click', () => {
            if (socket) {
                togglePatrolMode(socket); // Toggle Patrol Mode on/off
            } else {
                console.error('Socket is not initialized.');
            }
        });
    } else {
        console.error('Patrol mode button not found.');
    }

});


// Ensure initializeSocket is defined and correctly connects to your Socket.IO server
function initializeSocket() {
    const socket = io.connect(); 
    socket.on('connect', () => {
    });
    return socket;
}

function fetchMapboxToken() {
    return new Promise((resolve, reject) => {
        const authToken = localStorage.getItem('authToken');

        if (!authToken) {
            console.error('Authentication token is missing. Redirecting to login.');
            window.location.href = '/html/login.html';
            reject(new Error('No authentication token'));
            return;
        }

        fetch('/api/mapbox-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`,
            }
        })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    console.error('Unauthorized or forbidden access. Redirecting to login.');
                    window.location.href = '/html/login.html';
                }
                return reject(new Error('Failed to fetch Mapbox token'));
            }
            return response.json();
        })
        .then(data => {
            if (data.token) {
                resolve(data.token); // Resolve with the token
            } else {
                reject(new Error('No token returned from server'));
            }
        })
        .catch(error => {
            reject(error);
        });
    });
}


function initializeMap(mapboxToken) {
    mapboxgl.accessToken = mapboxToken; // Set the access token

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
        setInterval(setMapLightBasedOnTime, 600000); // Update every 10 minutes

        restoreMapState(map); // Restore the map's previous state

        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none'; // Hide loading screen
            document.getElementById('content').style.display = 'block'; // Show the content
        }, 4000); // 4000 milliseconds = 4 seconds

        map.on('zoomend', updateClusters);
        map.on('moveend', updateClusters);
    });

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
        showPinRedirect = true; // Set the flag indicating this is a "show pin" redirection

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
        essential: true // This ensures the animation happens even during a busy render cycle
    });


    new mapboxgl.Popup({ offset: 25 })
        .setLngLat([lng, lat])
        .setHTML('<p>Incident Location</p>')
        .addTo(map);
}



let hasCenteredOnUser = false; // Flag to ensure the map only centers once on the user
let showPinRedirect = false; // New flag to track if the user is being redirected to show pin

// Track user location, but only if not redirected to "show pin"
function trackUserLocation(userId, userName, map, socket) {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return;
    }

    let userMarker = null; // Variable to hold the user's marker

    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;

            // Only center the map on the user's location if we're not zooming to a pin
            // or being redirected by the "show pin" feature
            if (!showPinRedirect && !isZoomingToPin && !getSavedMapState().center) {
                map.once('moveend', () => {
                    map.setCenter([longitude, latitude]);
                });
            }

            // Only center the map on the user's location if it's the first time and no "show pin" redirect
            if (!hasCenteredOnUser && !showPinRedirect) {
                map.setCenter([longitude, latitude]);
                hasCenteredOnUser = true; // Mark as centered
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

let supercluster = new Supercluster({
    radius: 40, // Radius of each cluster when the map is zoomed out.
    maxZoom: 16, // Clustering will stop at zoom level 16.
    minPoints: 4 // Minimum number of points to form a cluster.
});

let markers = {}; // Store the markers globally
window.allReports = [];
window.filteredReports = [];

function fetchReportsAndAddToMap(map, socket) {
    const storedToken = localStorage.getItem('authToken');
    
    if (!storedToken) {
        console.error('No auth token found. Redirecting to login...');
        window.location.replace("/html/login.html");
        return;
    }

    // Reset global state
    window.allReports = [];
    window.filteredReports = [];
    clearMarkers();

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
            // Process and store reports
            window.allReports = reports.map(report => ({
                ...report,
                acknowledged: isReportAcknowledged(report.id)
            }));

            // Initialize filtered reports with all reports
            window.filteredReports = [...window.allReports];

            // Convert reports to GeoJSON features for clustering
            const features = window.allReports.map(report => ({
                type: 'Feature',
                properties: { ...report },
                geometry: {
                    type: 'Point',
                    coordinates: [report.lng, report.lat]
                }
            }));
            
            // Reset and reload supercluster
            supercluster = new Supercluster({
                radius: 40,
                maxZoom: 16,
                minPoints: 4
            });
            supercluster.load(features);

            // Initialize UI components
            initializeFilters();         // Initialize filters after reports are available
            reapplySavedFilters();       // Reapply any saved filters
            updateClusters();
            renderReportNotifications();
        }
    })
    .catch(error => {
        console.error('Error fetching reports:', error);
    });
}

// New function to initialize category filters
function initializeFilters() {
    const categories = new Set(window.allReports.map(report => report.category.toLowerCase()));
    const filterContainer = document.getElementById('category-filters');
    
    if (!filterContainer) return;
    
    filterContainer.innerHTML = ''; // Clear existing filters
    
    // Create category counts
    const categoryCounts = {};
    window.allReports.forEach(report => {
        const category = report.category.toLowerCase();
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Create and add filter checkboxes
    Array.from(categories).sort().forEach(category => {
        const count = categoryCounts[category] || 0;
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" value="${category}" class="crime-filter">
            ${capitalize(category)} <span class="filter-count">(${count})</span>
        `;
        filterContainer.appendChild(label);
    });

    // Add event listeners to filters
    document.querySelectorAll('.crime-filter').forEach(input => {
        input.checked = true; // Set all checkboxes to checked by default
        input.addEventListener('change', filterReports);
    });
}




// Modified function to initialize sorting controls
function initializeSortingControls() {
    const sortCategory = document.getElementById('sort-category');
    const sortTime = document.getElementById('sort-time');

    if (!sortCategory || !sortTime) {
        console.error('Sorting controls not found');
        return;
    }

    // Load saved preferences
    sortCategory.value = localStorage.getItem('sortCategory') || 'default';
    sortTime.value = localStorage.getItem('sortTime') || 'default';

    // Add event listeners
    sortCategory.addEventListener('change', sortReports);
    sortTime.addEventListener('change', sortReports);

    // Reset button functionality
    const resetSortingButton = document.getElementById('reset-sorting-button');
    if (resetSortingButton) {
        resetSortingButton.addEventListener('click', () => {
            // Reset sort controls
            sortCategory.value = 'default';
            sortTime.value = 'default';
            
            // Clear local storage
            localStorage.removeItem('sortCategory');
            localStorage.removeItem('sortTime');
            
            // Reset to all reports
            window.filteredReports = [...window.allReports];
            
            // Apply current category filters
            filterReports();
            
            // Update display
            renderReportNotifications();
        });
    }

    // Apply initial sorting
    applySorting();
}


// Function to sort reports based on selected criteria
function sortReports() {
    const sortCategory = document.getElementById('sort-category').value;
    const sortTime = document.getElementById('sort-time').value;

    // Save sort preferences
    localStorage.setItem('sortCategory', sortCategory);
    localStorage.setItem('sortTime', sortTime);

    // Apply the sorting
    applySorting();

    // Update the notifications panel
    renderReportNotifications();
}


// New function to apply sorting

// Function to apply sorting
function applySorting() {
    const sortCategory = document.getElementById('sort-category').value;
    const sortTime = document.getElementById('sort-time').value;

    let sortedReports = [...window.filteredReports];

    // Apply category filter if selected
    if (sortCategory !== 'default') {
        sortedReports = sortedReports.filter(report => 
            report.category.toLowerCase() === sortCategory.toLowerCase()
        );
    }

    // Apply time sorting (default is newest first)
    if (sortTime === 'oldest') {
        sortedReports.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else {
        // Default or 'newest' case
        sortedReports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    // Update filtered reports with sorted results
    window.filteredReports = sortedReports;
}



// Function to render the Report Notifications Panel based on filteredReports
function renderReportNotifications() {
    const notificationsContent = document.getElementById('notifications-content');
    if (!notificationsContent) return;
    
    // Clear existing content
    notificationsContent.innerHTML = '';
    
    // Create a Set to track unique report IDs
    const renderedReportIds = new Set();
    
    // Use the filtered and sorted reports
    window.filteredReports.forEach(report => {
        if (!renderedReportIds.has(report.id)) {
            const reportItem = createReportItem(report);
            notificationsContent.appendChild(reportItem);
            renderedReportIds.add(report.id);
        }
    });

    // Update alert sound status
    manageAlertSound();
}

let currentFilteredCategories = [];
function updateClusters() {
    if (!supercluster) {
        console.error('Supercluster is not initialized.');
        return;
    }

    const zoom = map.getZoom();
    const bounds = map.getBounds().toArray().flat();
    const clusters = supercluster.getClusters(bounds, Math.floor(zoom));

    // Clear existing markers and render new clusters/markers
    clearClusterMarkers();
    hideIndividualMarkers();

    clusters.forEach(cluster => {
        const [longitude, latitude] = cluster.geometry.coordinates;
        const properties = cluster.properties;

        if (properties.cluster) {
            // This is a cluster, not an individual report
            const clusterId = properties.cluster_id;
            const allClusterReports = supercluster.getLeaves(clusterId, Infinity); // Get all reports in the cluster

            // Filter reports in the cluster based on the selected categories
            const filteredReports = allClusterReports.filter(report => {
                const category = report.properties.category.toLowerCase();
                return currentFilteredCategories.length === 0 || currentFilteredCategories.includes(category);
            });

            const filteredCount = filteredReports.length;

            if (filteredCount > 0) {
                // Create a cluster marker
                const el = document.createElement('div');
                el.className = 'cluster-marker';
                el.textContent = filteredCount; // Display the filtered count

                const marker = new mapboxgl.Marker(el)
                    .setLngLat([longitude, latitude])
                    .addTo(map);

                // Add event listener for zooming into the cluster
                marker.getElement().addEventListener('click', () => {
                    map.flyTo({
                        center: [longitude, latitude],
                        zoom: Math.min(zoom + 2, supercluster.getClusterExpansionZoom(clusterId)),
                    });
                });

                // Store the cluster marker by ID
                markers[clusterId] = marker;
            }
        } else {
            // This is an individual report, check if it should be displayed based on current filter
            if (currentFilteredCategories.length === 0 || currentFilteredCategories.includes(properties.category.toLowerCase())) {
                addReportToMap(properties, map);
            }
        }
    });
}

function clearClusterMarkers() {
    for (let id in markers) {
        const marker = markers[id];
        if (marker && marker.getElement().classList.contains('cluster-marker')) {
            marker.remove(); // Remove cluster markers
            delete markers[id]; // Remove from global marker store
        }
    }
}

function hideIndividualMarkers() {
    for (let id in markers) {
        const marker = markers[id];
        if (marker && !marker.getElement().classList.contains('cluster-marker')) {
            marker.remove(); // Hide individual markers
        }
    }
}

function clearMarkers() {
    // Only remove cluster markers, not individual report markers
    for (let id in markers) {
        if (markers[id] && markers[id].getElement().classList.contains('cluster-marker')) {
            markers[id].remove(); // Remove cluster markers only
            delete markers[id]; // Remove them from the global marker store
        }
    }
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

    // Create the popup with modified options
    const popup = new mapboxgl.Popup({
        offset: 25,
        closeOnClick: false,     // Prevent closing when clicking inside popup
        closeOnMove: false,      // Prevent closing when map moves
        closeButton: true,       // Show a close button for manual closing
        className: 'persistent-popup' // Add a custom class for styling if needed
    }).setDOMContent(popupContent);

    // Create and add the marker to the map with the custom popup
    const marker = new mapboxgl.Marker(markerElement)
        .setLngLat(coordinates)
        .setPopup(popup)
        .addTo(map);

    // Add click handler to marker element to ensure popup stays open
    markerElement.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.addTo(map);
    });

    markers[report.id] = marker;  // Store marker by report ID
}

// Function to create custom popup content
function createPopupContent({ category, severity, description, createdAt, filePath, fileType, coordinates }) {
    const popupContent = document.createElement('div');
    popupContent.className = 'report-popup';

    // Category Header with Severity Line
    const categoryElement = document.createElement('h3');
    categoryElement.className = 'category-header';
    categoryElement.textContent = category;

    // Line with severity color
    const categoryLine = document.createElement('div');
    categoryLine.className = 'category-header-line';

    let severityColor;
    switch (severity.toLowerCase()) {
        case 'high':
            severityColor = '#ff0000';
            break;
        case 'medium':
            severityColor = '#ff9100';
            break;
        case 'low':
            severityColor = '#ffb700';
            break;
        default:
            severityColor = 'gray';
    }
    categoryLine.style.backgroundColor = severityColor;

    popupContent.appendChild(categoryElement);
    popupContent.appendChild(categoryLine);

    // Description and Reported Time
    const descriptionElement = document.createElement('p');
    descriptionElement.style.fontSize = '12px';
    descriptionElement.innerHTML = `<strong>Description:</strong> ${description}`;
    popupContent.appendChild(descriptionElement);

    const reportedAtElement = document.createElement('p');
    reportedAtElement.style.fontSize = '12px';
    reportedAtElement.innerHTML = `<strong>Reported At:</strong> ${createdAt}`;
    popupContent.appendChild(reportedAtElement);

    // Severity Information
    const severityElement = document.createElement('p');
    severityElement.style.fontSize = '12px';
    severityElement.innerHTML = `<strong>Severity:</strong> ${severity.toUpperCase()}`;
    popupContent.appendChild(severityElement);

    // ETA Display
    const etaDisplay = document.createElement('p');
    etaDisplay.id = 'eta-display';
    etaDisplay.style.marginBottom = '5px';
    //etaDisplay.textContent = 'ETA: Calculating...'; // Placeholder text
    popupContent.appendChild(etaDisplay);

    // Media preview for images/videos
    if (filePath && (fileType.startsWith('image') || fileType.startsWith('video'))) {
        const token = localStorage.getItem('authToken');
    
        fetch(filePath, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);
            return response.blob();
        })
        .then(blob => {
            const mediaContainer = document.createElement('div');
            mediaContainer.className = 'popup-attachment-container';
    
            let mediaElement;
            if (fileType.startsWith('image')) {
                mediaElement = document.createElement('img');
                mediaElement.src = URL.createObjectURL(blob);
                mediaElement.alt = 'Crime Image';
                mediaElement.className = 'popup-attachment-media';
            } else if (fileType.startsWith('video')) {
                mediaElement = document.createElement('video');
                mediaElement.src = URL.createObjectURL(blob);
                mediaElement.controls = true;
                mediaElement.className = 'popup-attachment-media';
            }
    
            if (mediaElement) {
                mediaElement.title = 'Click to expand';
                mediaElement.style.cursor = 'pointer';
                mediaElement.onclick = () => {
                    showAttachmentInContainer(filePath, fileType);
                };
    
                mediaContainer.appendChild(mediaElement);
                popupContent.appendChild(mediaContainer);
            }
        })
        .catch(error => {
            console.error('Error fetching preview:', error);
        });
    }

    // Auto-Direct Button
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';

    const autoDirectButton = document.createElement('button');
    autoDirectButton.id = 'auto-direct-button';
    autoDirectButton.className = 'eta-btn';
    autoDirectButton.textContent = 'Auto-Direct';
    autoDirectButton.style.flex = '1';
    autoDirectButton.onclick = (event) => {
        event.stopPropagation();
        if (isAutoDirecting) {
            cancelAutoDirect(map);
            autoDirectButton.textContent = 'Auto-Direct';
        } else {
            directToMarker(map, coordinates[0], coordinates[1]);
            autoDirectButton.textContent = 'Cancel Auto-Direct';
        }
    };

    buttonContainer.appendChild(autoDirectButton);
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
        // Create ETA display if it doesn’t exist
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
    etaElement.textContent = `ETA: ${eta}`;
}


function updateETA2(eta) {
    const etaDisplay = document.getElementById('etaDisplayCustom');
    if (etaDisplay) {
        etaDisplay.innerHTML = `<strong>ETA:</strong> ${eta}`;
    }
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

    const etaDisplay = document.getElementById('eta-display');
    if (etaDisplay) {
        etaDisplay.textContent = 'ETA: Calculating...';
    }

    if (!isAutoDirecting && userLocation) {
        isAutoDirecting = true;

        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${userLocation.longitude},${userLocation.latitude};${lng},${lat}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (!data.routes || data.routes.length === 0) {
                    console.error('No route found');
                    return;
                }

                const route = data.routes[0].geometry;
                const duration = data.routes[0].duration;
                const eta = formatDuration(duration);

                if (etaDisplay) {
                    etaDisplay.textContent = `ETA: ${eta}`;
                }

                if (map.getSource('routeLayerId')) {
                    map.getSource('routeLayerId').setData(route);
                } else {
                    map.addSource('routeLayerId', {
                        type: 'geojson',
                        data: route
                    });

                    map.addLayer({
                        id: 'routeLayerId',
                        type: 'line',
                        source: 'routeLayerId',
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

                // Fly to the target location
                map.flyTo({
                    center: [lng, lat],
                    zoom: 16,
                    essential: true
                });

                // Reopen the popup after flyTo
                setTimeout(() => {
                    const popup = new mapboxgl.Popup({
                        offset: 25,
                        closeOnClick: false,
                        closeButton: true
                    })
                    .setLngLat([lng, lat])
                    .setDOMContent(document.querySelector('.report-popup'))
                    .addTo(map);
                }, 1000); // Adjust delay as needed for flyTo to complete

                const autoDirectButton = document.getElementById('auto-direct-button');
                if (autoDirectButton) {
                    autoDirectButton.textContent = 'Cancel Auto-Direct';
                }
            })
            .catch(error => console.error('Error fetching route:', error));
    } else {
        cancelAutoDirect(map);
    }
}

// Function to format duration (in seconds) into a readable format
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)} seconds`;
    } else if (seconds < 3600) {
        return `${Math.round(seconds / 60)} minutes`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
}


function clearETA() {
    const etaDisplay = document.getElementById('eta-display');
    if (etaDisplay) {
        etaDisplay.textContent = ''; // Clear ETA text content
    }
}

function cancelAutoDirect(map) {
    console.log('Cancelling Auto-Direct...'); // Debug log

    if (map.getLayer('routeLayerId')) {
        map.removeLayer('routeLayerId');
        map.removeSource('routeLayerId');
        console.log('Route layer removed.');
    }

    // Clear the ETA display
    const etaDisplay = document.getElementById('eta-display');
    if (etaDisplay) {
        etaDisplay.textContent = '';
    }

    // Reset button text to "Auto-Direct"
    const autoDirectButton = document.getElementById('auto-direct-button');
    if (autoDirectButton) {
        autoDirectButton.textContent = 'Auto-Direct';
    }

    // Reset the Auto-Direct state
    isAutoDirecting = false;
    console.log('Auto-Direct mode turned off.');
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

        if (fileType.startsWith('image')) {
            const image = document.createElement('img');
            image.src = URL.createObjectURL(blob);
            image.alt = "Attachment Image";
            image.className = 'attachment-image';
            modalContent.appendChild(image);
        } else if (fileType.startsWith('video')) {
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

// Listener
function listenForNewReports(map, socket) {
    socket.off('newReport'); // Remove any existing listeners first
    
    socket.on('newReport', (report) => {
        if (!report.lng || !report.lat) {
            console.error('Missing coordinates in report:', report);
            return;
        }

        // Check if report already exists
        const existingReport = window.allReports.find(r => r.id === report.id);
        
        if (!existingReport) {
            const processedReport = {
                ...report,
                acknowledged: isReportAcknowledged(report.id)
            };

            // Add to global arrays
            window.allReports.push(processedReport);
            
            // Update the filter list with new counts
            updateFilterList();
            
            // Update category filters and apply current filters
            updateCategoryFilters();
            filterReports();
            
            // Only show patrol mode notification if patrol mode is active
            if (isPatrolModeActive) {
                showCrimeNotification(processedReport);
                playAlertSound();
            }

            // Manage alert sound for non-patrol mode
            if (!isPatrolModeActive) {
                manageAlertSound();
            }
        }
    });
}

// New function to update filter list counts
function updateFilterList() {
    const filterContainer = document.getElementById('category-filters');
    if (!filterContainer) return;

    // Store the current checked states
    const currentCheckedStates = {};
    filterContainer.querySelectorAll('input.crime-filter').forEach(input => {
        currentCheckedStates[input.value] = input.checked;
    });

    // Get all current categories and their counts
    const categoryCounts = {};
    window.allReports.forEach(report => {
        const category = report.category.toLowerCase();
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Update existing category counts or add new categories
    Object.entries(categoryCounts).sort().forEach(([category, count]) => {
        // Look for existing label for this category
        const existingLabel = filterContainer.querySelector(`label input[value="${category}"]`)?.parentElement;

        if (existingLabel) {
            // Update count for existing category
            const countSpan = existingLabel.querySelector('.filter-count');
            if (countSpan) {
                countSpan.textContent = `(${count})`;
            }
        } else {
            // Add new category
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${category}" class="crime-filter">
                ${capitalize(category)} <span class="filter-count">(${count})</span>
            `;
            filterContainer.appendChild(label);

            // Add event listener to new checkbox
            const input = label.querySelector('.crime-filter');
            input.addEventListener('change', filterReports);
        }
    });

    // Re-apply the checked states or default to checked
    const hasCheckedState = Object.keys(currentCheckedStates).length > 0;

    filterContainer.querySelectorAll('input.crime-filter').forEach(input => {
        if (hasCheckedState) {
            if (currentCheckedStates.hasOwnProperty(input.value)) {
                input.checked = currentCheckedStates[input.value];
            } else {
                // For new categories, default to checked
                input.checked = true;
            }
        } else {
            // On initial load, default all to checked
            input.checked = true;
        }
    });
}   


// Modified function to update category filters
function updateCategoryFilters() {
    const filterContainer = document.getElementById('category-filters');
    const sortCategory = document.getElementById('sort-category');
    
    if (!filterContainer || !sortCategory) return;

    // Get all unique categories from current reports
    const categories = new Set(window.allReports.map(report => report.category.toLowerCase()));
    
    // Count reports per category
    const categoryCounts = {};
    window.allReports.forEach(report => {
        const category = report.category.toLowerCase();
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    // Update dropdown options
    sortCategory.innerHTML = '<option value="default">All Categories</option>';
    Array.from(categories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = capitalize(category);
        sortCategory.appendChild(option);
    });

    // Restore selected value if exists
    const savedCategory = localStorage.getItem('sortCategory');
    if (savedCategory && sortCategory.querySelector(`option[value="${savedCategory}"]`)) {
        sortCategory.value = savedCategory;
    }
}


// Setup map style switcher
function setupMapStyleSwitcher(map) {
    const styles = {
        'satellite-map-dark': 'mapbox://styles/falconwatch/cm0qnadi200nd01qk1e36dr2i',
        'white-map': 'mapbox://styles/mapbox/light-v11',
        'dark-map': 'mapbox://styles/mapbox/dark-v11',
        'standard-map-dynamic': 'mapbox://styles/mapbox/standard', 
        'street-map': 'mapbox://styles/mapbox/satellite-streets-v12',
        'dark-standard': 'mapbox://styles/falconwatch/cm0y15wx0011901qofja0525j'
    };

    Object.keys(styles).forEach(id => {
        const styleButton = document.getElementById(id);
        if (styleButton) {
            styleButton.addEventListener('click', () => {
                // Apply the style normally
                map.setStyle(styles[id]);
            });
        } else {
            console.warn(`Style button with ID "${id}" not found.`);
        }
    });

    // Zone Mode button functionality
    const zoneModeButton = document.getElementById('zone-mode-button');
    if (zoneModeButton) {
        zoneModeButton.addEventListener('click', () => {
            if (isZoneModeActive) {
                removeGeoJSON(map);
                zoneModeButton.textContent = 'Zone Mode';
            } else {
                loadGeoJSON(map);
                zoneModeButton.textContent = 'Disable Zone Mode';
            }
            isZoneModeActive = !isZoneModeActive;
        });
    }
} // <-- Ensure this closing brace is added

// Load GeoJSON data
function loadGeoJSON(map) {
    if (map.isStyleLoaded()) {
        if (!window.zonesData) {
            fetch('/js/geojson/dubaiZones.geojson')
                .then(response => response.json())
                .then(geojsonData => {
                    window.zonesData = geojsonData; // Store globally
                    addGeoJSONSourceAndLayer(map);
                    // Process zones with filtered reports
                    processZonesAndReports(map, window.filteredReports || window.allReports);
                })
                .catch(error => {
                    console.error('Error loading GeoJSON data:', error);
                });
        } else {
            addGeoJSONSourceAndLayer(map);
            // Process zones with filtered reports
            processZonesAndReports(map, window.filteredReports || window.allReports);
        }
    } else {
        map.once('styledata', () => {
            loadGeoJSON(map);
        });
    }
}



// Helper function to add source and layer
function addGeoJSONSourceAndLayer(map) {
    if (!map.getSource(geojsonSourceId)) {
        map.addSource(geojsonSourceId, {
            type: 'geojson',
            data: window.zonesData
        });
    }

    if (!map.getLayer(geojsonLayerId)) {
        map.addLayer({
            'id': geojsonLayerId,
            'type': 'fill',
            'source': geojsonSourceId,
            'paint': {
                'fill-color': '#888888',
                'fill-opacity': 0.4,
                'fill-outline-color': '#000000'
            }
        });
    }

    // Process the reports with zones after the layer is added
    if (window.allReports) {
        let reportsToProcess = (window.filteredReports && window.filteredReports.length > 0) ? window.filteredReports : window.allReports;
        processZonesAndReports(map, reportsToProcess);
    }

    // Set up the click listener for zones after adding the layer
    setupZoneClickListener(map);
}


// Remove GeoJSON data
function removeGeoJSON(map) {
    if (map.getLayer(geojsonLayerId)) {
        map.removeLayer(geojsonLayerId);
        // Remove event listeners
        if (zoneClickHandler) {
            map.off('click', geojsonLayerId, zoneClickHandler);
            zoneClickHandler = null;
        }
        if (zoneMouseEnterHandler) {
            map.off('mouseenter', geojsonLayerId, zoneMouseEnterHandler);
            zoneMouseEnterHandler = null;
        }
        if (zoneMouseLeaveHandler) {
            map.off('mouseleave', geojsonLayerId, zoneMouseLeaveHandler);
            zoneMouseLeaveHandler = null;
        }
    }
    if (map.getSource(geojsonSourceId)) {
        map.removeSource(geojsonSourceId);
    }
}
function processZonesAndReports(map, reports, zonesData = window.zonesData) {
    if (!zonesData) {
        console.error('Zones data not found.');
        return;
    }

    // Reset zone properties before processing
    zonesData.features.forEach(zone => {
        zone.properties.majoritySeverity = null;
        zone.properties.totalCrimes = 0;
        zone.properties.categoryCounts = '{}';
    });

    if (!reports || reports.length === 0) {
        console.warn('No reports data available.');
        map.getSource(geojsonSourceId).setData(zonesData);
        updateZoneColors(map);
        return;
    }

    zonesData.features.forEach(zone => {
        const severityCounts = { high: 0, medium: 0, low: 0 };
        let totalCrimes = 0;
        const categoryCounts = {};

        reports.forEach(report => {
            const point = turf.point([report.lng, report.lat]);
            const isInside = turf.booleanPointInPolygon(point, zone);

            if (isInside) {
                totalCrimes++;

                // Count severity
                const severity = report.severity.toLowerCase();
                if (severityCounts.hasOwnProperty(severity)) {
                    severityCounts[severity]++;
                }

                // Count categories
                const category = report.category.toLowerCase();
                if (!categoryCounts[category]) {
                    categoryCounts[category] = 0;
                }
                categoryCounts[category]++;
            }
        });

        const majoritySeverity = getMajoritySeverity(severityCounts);
        zone.properties.majoritySeverity = majoritySeverity;
        zone.properties.totalCrimes = totalCrimes;

        // Serialize categoryCounts before assigning
        zone.properties.categoryCounts = JSON.stringify(categoryCounts);
    });

    map.getSource(geojsonSourceId).setData(zonesData);
    updateZoneColors(map);
}


// Helper function
function getMajoritySeverity(severityCounts) {
    const { high, medium, low } = severityCounts;
    const maxCount = Math.max(high, medium, low);

    if (maxCount === 0) {
        return null; // No reports in this zone
    }

    if (high === maxCount) {
        return 'high';
    } else if (medium === maxCount) {
        return 'medium';
    } else if (low === maxCount) {
        return 'low';
    }
    return null;
}

// Helper function
function updateZoneColors(map) {
    if (map.getLayer(geojsonLayerId)) {
        map.setPaintProperty(geojsonLayerId, 'fill-color', [
            'case',
            ['==', ['get', 'majoritySeverity'], 'high'], '#FF0000',    // Red for high severity
            ['==', ['get', 'majoritySeverity'], 'medium'], '#FFA500', // Orange for medium severity
            ['==', ['get', 'majoritySeverity'], 'low'], '#008000',    // Green for low severity
            '#888888' // Default color
        ]);
    }
}

// Function to fetch 
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
    const popupContent = 
        `<div class="popup-content">
            <h3>Incident Details</h3>
            <p><strong>Report ID:</strong> ${report.id}</p>
            <p><strong>Severity:</strong> ${report.severity}</p>
            <p><strong>Description:</strong> ${report.description}</p>
            <p><strong>Created At:</strong> ${new Date(report.created_at).toLocaleString()}</p>
        </div>`;

    new mapboxgl.Popup()
        .setLngLat([report.longitude, report.latitude])
        .setHTML(popupContent)
        .addTo(map);
}

// Add reports to filter list with crime counts
function addReportsToFilterList(reports) {
    const filterContainer = document.getElementById('category-filters');
    if (!filterContainer) return;

    filterContainer.innerHTML = ''; // Clear existing filters

    const categoryCounts = {};
    reports.forEach(report => {
        const category = report.category.toLowerCase();
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });

    Object.entries(categoryCounts).sort().forEach(([category, count]) => {
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" value="${category}" class="crime-filter" checked>
            ${capitalize(category)} <span class="filter-count">(${count})</span>
        `;
        filterContainer.appendChild(label);
    });

    // Add event listeners
    document.querySelectorAll('.crime-filter').forEach(input => {
        input.addEventListener('change', () => {
            filterReports();
            updateClusters();
        });
    });
}

// Filter reports based on selected categories

// Modified filter function
// Modified filterReports function to work with sorting
function filterReports() {
    // Get currently selected categories
    currentFilteredCategories = Array.from(document.querySelectorAll('.crime-filter:checked'))
        .map(input => input.value);

    // Clear existing markers
    clearMarkers();

    // If no categories are selected, show no reports
    if (currentFilteredCategories.length === 0) {
        window.filteredReports = [];
    } else {
        // Filter reports based on selected categories
        window.filteredReports = window.allReports.filter(report => 
            currentFilteredCategories.includes(report.category.toLowerCase())
        );
    }

    // Apply sorting (this will ensure newest first by default)
    applySorting();

    // Update features for clustering
    const features = window.filteredReports.map(report => ({
        type: 'Feature',
        properties: { ...report },
        geometry: {
            type: 'Point',
            coordinates: [report.lng, report.lat]
        }
    }));

    // Reset and reload supercluster with filtered data
    supercluster.load(features);

    // Update the map display
    updateClusters();

    // Update zones if zone mode is active
    if (isZoneModeActive && map.getSource(geojsonSourceId)) {
        processZonesAndReports(map, window.filteredReports);
    }

    // Save filter state
    saveFilterState();

    // Update notifications panel
    renderReportNotifications();
}



// New function to save filter state
function saveFilterState() {
    const filterState = Array.from(document.querySelectorAll('.crime-filter:checked'))
        .map(input => input.value);
    localStorage.setItem('savedFilters', JSON.stringify(filterState));
}

// New function to reapply saved filters
function reapplySavedFilters() {
    const savedFilters = localStorage.getItem('savedFilters');
    const filterInputs = document.querySelectorAll('.crime-filter');

    if (savedFilters) {
        const filterState = JSON.parse(savedFilters);

        if (filterState.length > 0) {
            // Apply saved filter states
            filterInputs.forEach(input => {
                input.checked = filterState.includes(input.value);
            });
        } else {
            // If savedFilters is an empty array, check all filters
            filterInputs.forEach(input => {
                input.checked = true;
            });
        }
    } else {
        // No saved filters, check all filters by default
        filterInputs.forEach(input => {
            input.checked = true;
        });
    }

    // Apply filters
    filterReports();
}

// Update event listeners to use filterReports
document.querySelectorAll('.crime-filter').forEach(input => {
    input.addEventListener('change', filterReports);
});

// Updated showMarker function
function showMarker(markerId) {
    if (markers && markers[markerId]) {
        markers[markerId].addTo(map);
    }
}

// Updated hideMarker function
function hideMarker(markerId) {
    if (markers && markers[markerId]) {
        markers[markerId].remove();
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

        } else {
            filterContainer.classList.add('show');
            
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

// Declare variables to store event handlers
let zoneClickHandler = null;
let zoneMouseEnterHandler = null;
let zoneMouseLeaveHandler = null;

// Function to handle zone click events and display popups
function setupZoneClickListener(map) {
    // Remove existing event handlers if they exist
    if (zoneClickHandler) {
        map.off('click', geojsonLayerId, zoneClickHandler);
        zoneClickHandler = null;
    }

    zoneClickHandler = function (e) {
        const features = map.queryRenderedFeatures(e.point, {
            layers: [geojsonLayerId]
        });

        if (!features.length) {
            return;
        }

        const zone = features[0];
        const coordinates = e.lngLat;
        const properties = zone.properties;

        // Create the basic popup content
        const popupContent = document.createElement('div');
        popupContent.className = 'zone-popup';

        const title = document.createElement('h3');
        title.textContent = properties.CNAME_E || 'Zone'; // Use 'CNAME_E' for zone name
        popupContent.appendChild(title);

        const crimeCount = document.createElement('p');
        crimeCount.textContent = `Total Crimes: ${properties.totalCrimes || 0}`;
        popupContent.appendChild(crimeCount);

        // Add 'Advanced View' button
        const advancedButton = document.createElement('button');
        advancedButton.classList.add('view-attachment-btn'); // Apply the same class
        advancedButton.textContent = 'Advanced View';
        advancedButton.onclick = () => {
            showAdvancedZonePopup(properties);
        };
        popupContent.appendChild(advancedButton);

        // Create and show the popup
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setDOMContent(popupContent)
            .addTo(map);
    };

    // Attach the click handler
    map.on('click', geojsonLayerId, zoneClickHandler);

    // Optionally, handle mouse events for pointer changes
    map.on('mouseenter', geojsonLayerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', geojsonLayerId, () => {
        map.getCanvas().style.cursor = '';
    });
}

function showAdvancedZonePopup(properties) {
    // Remove any existing modal
    const existingModal = document.querySelector('.zone-advanced-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create a modal container
    const modal = document.createElement('div');
    modal.className = 'zone-advanced-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'zone-advanced-content';

    // Close button
    const closeButton = document.createElement('span');
    closeButton.className = 'zone-advanced-close';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
        modal.remove();
    };
    modalContent.appendChild(closeButton);

    // Title
    const title = document.createElement('h2');
    title.textContent = properties.CNAME_E || 'Zone Details'; // Use 'CNAME_E' for zone name
    modalContent.appendChild(title);

    // Total crimes
    const totalCrimes = document.createElement('p');
    totalCrimes.textContent = `Total Crimes: ${properties.totalCrimes || 0}`;
    modalContent.appendChild(totalCrimes);

    // Parse categoryCounts if it's a string
    let categoryCounts = properties.categoryCounts || '{}';
    if (typeof categoryCounts === 'string') {
        try {
            categoryCounts = JSON.parse(categoryCounts);
        } catch (e) {
            console.error('Error parsing categoryCounts:', e);
            categoryCounts = {};
        }
    }

    // Detailed category counts
    const categoryList = document.createElement('ul');

    for (const [category, count] of Object.entries(categoryCounts)) {
        const listItem = document.createElement('li');
        listItem.textContent = `${capitalize(category)}: ${count}`;
        categoryList.appendChild(listItem);
    }

    modalContent.appendChild(categoryList);

    // Append content to modal and modal to body
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

function capitalize(str) {
    return str
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

let lastAppliedLightPreset = ''; // Keeps track of the last applied light preset

function setMapLightBasedOnTime() {
    // Check if the map is initialized and loaded before proceeding
    if (!map || !map.isStyleLoaded()) {
        return;
    }

    const timeOfDay = getDubaiTimeOfDay();
    
    // Only update the map light preset if it's different from the last applied one
    if (timeOfDay === lastAppliedLightPreset) {
        return; // Exit early if the preset hasn't changed
    }

    lastAppliedLightPreset = timeOfDay; // Update the last applied preset

    map.setConfigProperty('basemap', 'lightPreset', timeOfDay);
}


// Call this function whenever you need to update the map lighting based on time
setMapLightBasedOnTime();

// Optionally, set up a timer to periodically check and update the lighting
setInterval(setMapLightBasedOnTime, 600000); // Check every 10 minutes

// Helper function to get the current time of day in Dubai
function getDubaiTimeOfDay() {
    const dubaiTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" });
    const hours = new Date(dubaiTime).getHours();

    if (hours >= 5 && hours < 12) {
        return 'dawn';
    } else if (hours >= 12 && hours < 15) {
        return 'day';
    } else if (hours >= 15 && hours < 16) { 
        return 'dusk';
    } else {
        return 'night';
    }
}

// Function to initialize Report Notifications
function initializeReportNotifications(map, socket) {
    const notificationsContent = document.getElementById('notifications-content');
    
    // Clear existing notifications first
    if (notificationsContent) {
        notificationsContent.innerHTML = '';
    }

    // Only render the reports that are already in window.allReports
    // Remove the separate fetch since reports are already loaded
    if (window.allReports && Array.isArray(window.allReports)) {
        renderReportNotifications();
    }
}

// Function to create a report item element (Defined globally)
function createReportItem(report) {
    const reportDiv = document.createElement('div');
    reportDiv.classList.add('report-item');
    reportDiv.setAttribute('data-report-id', report.id);

    // Category
    const category = document.createElement('div');
    category.classList.add('report-category');
    category.innerHTML = `<strong>Category:</strong> ${report.category}`;
    reportDiv.appendChild(category);

    reportDiv.appendChild(document.createElement('br'));

    // Severity
    const severity = document.createElement('div');
    severity.classList.add('report-severity', report.severity.toLowerCase());
    severity.innerHTML = `<strong>Severity:</strong> ${report.severity.toUpperCase()}`;
    reportDiv.appendChild(severity);

    // Description
    const description = document.createElement('div');
    description.innerHTML = `<strong>Description:</strong> ${report.description}`;
    reportDiv.appendChild(description);

    reportDiv.appendChild(document.createElement('br'));

    // Time
    const time = document.createElement('div');
    const reportTime = new Date(report.created_at).toLocaleString();
    time.innerHTML = `<strong>Time:</strong> ${reportTime}`;
    reportDiv.appendChild(time);

    // Button Container
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('button-container');

    // Show Pin Button
    const showPinBtn = document.createElement('button');
    showPinBtn.classList.add('show-pin-btn');
    showPinBtn.textContent = 'Show Pin';
    showPinBtn.setAttribute('aria-label', 'Show Incident Pin on Map');
    showPinBtn.addEventListener('click', () => {
        flyToReportPin(map, report.lng, report.lat);
    });
    buttonContainer.appendChild(showPinBtn);

    // Check if the report is already acknowledged
    const isAcknowledged = isReportAcknowledged(report.id);

    // If the report is of HIGH severity and not acknowledged, add the "Acknowledge" button
    if (report.severity.toLowerCase() === 'high' && !isAcknowledged) {
        const acknowledgeBtn = document.createElement('button');
        acknowledgeBtn.classList.add('acknowledge-btn', 'pulse');
        acknowledgeBtn.textContent = 'Acknowledge';
        acknowledgeBtn.setAttribute('aria-label', 'Acknowledge High Severity Report');

        acknowledgeBtn.addEventListener('click', () => {
            acknowledgeReport(report.id, acknowledgeBtn);
        });

        buttonContainer.appendChild(acknowledgeBtn);
        report.acknowledged = false;
        manageAlertSound();
    } else if (report.severity.toLowerCase() === 'high' && isAcknowledged) {
        const acknowledgedLabel = document.createElement('button');
        acknowledgedLabel.classList.add('acknowledge-btn', 'acknowledged');
        acknowledgedLabel.textContent = 'Acknowledged';
        acknowledgedLabel.setAttribute('aria-label', 'Acknowledged Report');
        acknowledgedLabel.disabled = true;
        buttonContainer.appendChild(acknowledgedLabel);
    }

    reportDiv.appendChild(buttonContainer);

    return reportDiv;
}

// Function to append a report to the panel (Defined globally)
function appendReport(report) {
    const notificationsContent = document.getElementById('notifications-content');
    if (!notificationsContent) {
        console.error('Notifications content element not found.');
        return;
    }
    const reportItem = createReportItem(report);
    // Prepend to show the latest reports on top
    notificationsContent.prepend(reportItem);
}


// Function to fly to the report's pin on the map
function flyToReportPin(map, lng, lat) {
    map.flyTo({
        center: [lng, lat],
        zoom: 16, // Adjust zoom level as needed
        essential: true
    });

    // Optional: Open a popup at the report's location
    new mapboxgl.Popup({ offset: 25 })
        .setLngLat([lng, lat])
        .setHTML('<p>Incident Location</p>')
        .addTo(map);
}


let alertSoundPlaying = false;

// Function to play the alert sound
function playAlertSound() {
    if (!alertSoundPlaying) {
        const alertSound = document.getElementById('alert-sound');
        if (alertSound) {
            alertSound.play()
                .then(() => {
                    alertSoundPlaying = true;
                })
                .catch(error => {
                    console.error('Error playing alert sound:', error);
                    // Optional: Notify the user to allow sound playback
                });
        } else {
            console.error('Alert sound element not found.');
        }
    }
}

// Function to stop the alert sound
function stopAlertSound() {
    if (alertSoundPlaying) {
        const alertSound = document.getElementById('alert-sound');
        if (alertSound) {
            alertSound.pause();
            alertSound.currentTime = 0; // Reset to the beginning
            alertSoundPlaying = false;
        } else {
            console.error('Alert sound element not found.');
        }
    }
}

// Function to check and manage alert sound based on unacknowledged HIGH severity reports
function manageAlertSound() {
    const reportNotificationsPanel = document.getElementById('report-notifications-panel');
    const isPanelOpen = reportNotificationsPanel.classList.contains('open');

    if (!isPanelOpen) {
        // Panel is not open, stop the alert sound
        stopAlertSound();
        return;
    }

    const unacknowledgedHighReports = window.allReports.filter(report => 
        report.severity.toLowerCase() === 'high' && !isReportAcknowledged(report.id)
    );
    
    if (unacknowledgedHighReports.length > 0) {
        playAlertSound();
    } else {
        stopAlertSound();
    }
}


/// Function to acknowledge a high severity report
function acknowledgeReport(reportId, acknowledgeBtn) {
    // Find the report in the global reports array
    const report = window.allReports.find(r => r.id === reportId);
    if (report) {
        report.acknowledged = true; // Mark as acknowledged

        // Update the button appearance
        acknowledgeBtn.classList.remove('pulse'); // Stop pulsing
        acknowledgeBtn.classList.add('acknowledged'); // Apply acknowledged styles
        acknowledgeBtn.textContent = 'Acknowledged';
        acknowledgeBtn.disabled = true; // Disable the button

        // Persist the acknowledgment in localStorage
        addAcknowledgedReport(reportId);
    } else {
        console.error(`Report with ID ${reportId} not found.`);
    }

    // Manage the alert sound based on the current state of reports
    manageAlertSound();
}


// Retrieve acknowledged report IDs from localStorage
function getAcknowledgedReports() {
    const acknowledged = localStorage.getItem('acknowledgedReports');
    return acknowledged ? JSON.parse(acknowledged) : [];
}

// Add a report ID to the acknowledged list
function addAcknowledgedReport(reportId) {
    const acknowledged = getAcknowledgedReports();
    if (!acknowledged.includes(reportId)) {
        acknowledged.push(reportId);
        localStorage.setItem('acknowledgedReports', JSON.stringify(acknowledged));
    }
}

// Check if a report is acknowledged
function isReportAcknowledged(reportId) {
    const acknowledged = getAcknowledgedReports();
    return acknowledged.includes(reportId);
}

let isPatrolModeActive = false;
let assignedCrime = null; // Store the crime assigned to the officer
let patrolModeListener = null; // Store the listener reference

// Simplify stopPatrolMode since we don't need to remove listeners anymore
function stopPatrolMode(socket) {
    stopAlertSound();
    // Any additional cleanup if required
}

// Utility function to handle media display in patrol mode notifications
function showPatrolModeMedia(filePath, fileType) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        console.error('No auth token found.');
        return Promise.reject('No auth token found');
    }

    return fetch(filePath, {
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
        const mediaUrl = URL.createObjectURL(blob);
        
        if (fileType === 'image') {
            return `<div class="popupMediaContainerCustom">
                        <img src="${mediaUrl}" alt="Crime Scene Image" class="popupMediaCustom"/>
                    </div>`;
        } else if (fileType === 'video') {
            return `<div class="popupMediaContainerCustom">
                        <video controls class="popupMediaCustom">
                            <source src="${mediaUrl}" type="video/mp4"/>
                            Your browser does not support the video tag.
                        </video>
                    </div>`;
        }
        return '<p>Unsupported media type.</p>';
    })
    .catch(error => {
        console.error('Error loading media:', error);
        return '<p>Failed to load media.</p>';
    });
}

// Function to show crime notification with ETA
function showNotificationWithETA(report, eta) {
    const modal = document.createElement('div');
    modal.className = 'crimeModalCustom';

    modal.innerHTML = `
        <div class="crimePopupCustom">
            <h2 class="popupCategoryCustom">${report.category}</h2>  
            <div id="mediaPlaceholder">Loading media...</div>
            <p class="popupDescriptionCustom"><strong>Description:</strong> ${report.description || 'No description provided'}</p>
            <p class="popupSeverityCustom"><strong>Severity:</strong> 
                <span class="${getSeverityClass(report.severity)}">${report.severity}</span>
            </p>
            <p class="popupTimeCustom"><strong>Reported Time:</strong> ${new Date(report.created_at).toLocaleTimeString()}</p>
            <div id="etaDisplayCustom"><strong>ETA:</strong> ${eta}</div>
            <div class="popupActionsCustom">
                <button class="popupBtnCustom acknowledge-btn">Acknowledge</button>
                <button class="popupBtnCustom respond-btn">Respond</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    if (report.file_path) {
        showPatrolModeMedia(report.file_path, report.file_type)
            .then(mediaHtml => {
                const mediaPlaceholder = modal.querySelector('#mediaPlaceholder');
                if (mediaPlaceholder) {
                    mediaPlaceholder.outerHTML = mediaHtml;
                }
            });
    } else {
        const mediaPlaceholder = modal.querySelector('#mediaPlaceholder');
        if (mediaPlaceholder) {
            mediaPlaceholder.outerHTML = '<p>No media available.</p>';
        }
    }

    const acknowledgeBtn = modal.querySelector('.acknowledge-btn');
    const respondBtn = modal.querySelector('.respond-btn');

    if (acknowledgeBtn) {
        acknowledgeBtn.addEventListener('click', () => {
            stopAlertSound();
            modal.remove();
        });
    }

    if (respondBtn) {
        respondBtn.addEventListener('click', () => {
            stopAlertSound();
            modal.remove();

            // Store the assigned crime
            assignedCrime = report;

            // Display the assigned crime widget
            displayAssignedCrime(report);

            // Initialize auto-direct to the crime location
            if (report.lng && report.lat) {
                initiateAutoDirect(report);
            }
        });
    }
}

function showCrimeNotification(report) {
    // First calculate ETA, then show the modal with the result
    if (!userLocation) {
        showNotificationWithETA(report, "Location unavailable");
        return;
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${userLocation.longitude},${userLocation.latitude};${report.lng},${report.lat}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const duration = data.routes[0].duration;
                const eta = formatDuration(duration);
                showNotificationWithETA(report, eta);
            } else {
                throw new Error("No routes found");
            }
        })
        .catch(error => {
            console.error("Error calculating ETA:", error);
            showNotificationWithETA(report, "Error calculating ETA");
        });
}

function initiateAutoDirect(report) {
    if (!report || !report.lng || !report.lat) {
        console.error('Invalid report data for auto-direct.');
        return;
    }

    // Fly to the report's location
    flyToReportPin(map, report.lng, report.lat);

    // Enable auto-direct by fetching and displaying the route
    directToMarker(map, report.lng, report.lat);

    // Optionally, notify the officer that auto-direct is active
    alert(`Auto-Direct to Report ID: ${report.id} is now active.`);
}



function calculateETA(destinationLng, destinationLat) {
    if (!userLocation) {
        console.warn("User location is not available for ETA calculation.");
        updateETA2("Location unavailable");
        return;
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${userLocation.longitude},${userLocation.latitude};${destinationLng},${destinationLat}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const duration = data.routes[0].duration;
                const eta = formatDuration(duration);
                
                // Update ETA in patrol mode notification
                const etaDisplay = document.getElementById('etaDisplayCustom');
                if (etaDisplay) {
                    etaDisplay.innerHTML = `<strong>ETA:</strong> ${eta}`;
                }
                
                // Update ETA in assigned crime widget
                const etaDisplayWidget = document.getElementById('eta-display-widget');
                if (etaDisplayWidget) {
                    etaDisplayWidget.innerHTML = `<strong>ETA:</strong> ${eta}`;
                }
            } else {
                throw new Error("No routes found");
            }
        })
        .catch(error => {
            console.error("Error calculating ETA:", error);
            updateETA2("Error calculating ETA");
        });
}


// Show the assigned crime in the corner of the screen
function displayAssignedCrime(report) {
    // Remove any existing assigned crime display
    const existingDisplay = document.querySelector('.assigned-crime-display');
    if (existingDisplay) {
        existingDisplay.remove();
    }

    const assignedCrimeDisplay = document.createElement('div');
    assignedCrimeDisplay.className = 'assigned-crime-display';
    assignedCrimeDisplay.innerHTML = `
        <div class="assigned-crime-details">
            <h3>Assigned Crime #${report.id}</h3>
            <p><strong>Category:</strong> ${report.category}</p>
            <p><strong>Severity:</strong> <span class="${getSeverityClass(report.severity)}">${report.severity}</span></p>
            <p><strong>Description:</strong> ${report.description}</p>
            <div id="eta-display-widget"><strong>ETA:</strong> Calculating...</div>
            <button id="conclude-btn" class="conclude-button">Conclude Response</button>
        </div>
    `;

    document.body.appendChild(assignedCrimeDisplay);

    // Calculate initial ETA immediately
    if (report.lng && report.lat) {
        calculateETA(report.lng, report.lat);
        
        // Update ETA every 30 seconds
        const etaInterval = setInterval(() => {
            if (assignedCrime) {
                calculateETA(report.lng, report.lat);
            } else {
                clearInterval(etaInterval);
            }
        }, 30000);
    }

    // Set up conclude button functionality
    const concludeBtn = document.getElementById('conclude-btn');
    if (concludeBtn) {
        concludeBtn.addEventListener('click', () => {
            if (isAutoDirecting) {
                cancelAutoDirect(map);
            }
            assignedCrime = null;
            assignedCrimeDisplay.remove();
        });
    }

    // Position the display
    assignedCrimeDisplay.style.position = 'fixed';
    assignedCrimeDisplay.style.bottom = '20px';
    assignedCrimeDisplay.style.right = '20px';
    assignedCrimeDisplay.style.zIndex = '1000';
    assignedCrimeDisplay.style.backgroundColor = '#ffffff';
    assignedCrimeDisplay.style.padding = '15px';
    assignedCrimeDisplay.style.borderRadius = '8px';
    assignedCrimeDisplay.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    assignedCrimeDisplay.style.maxWidth = '300px';
}


function getSeverityClass(severity) {
    switch (severity.toLowerCase()) {
        case 'high':
            return 'severityHighCustom';
        case 'medium':
            return 'severityMediumCustom';
        case 'low':
            return 'severityLowCustom';
        default:
            return '';
    }
}