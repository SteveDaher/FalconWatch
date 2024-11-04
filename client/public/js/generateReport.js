//Path: client/js/generateReport.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('authToken'); // Retrieve the authentication token

    // Hide the page content initially
    const pageContent = document.querySelector('body');
    pageContent.style.display = 'none';

    // Redirect to login if token is missing
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

        // Generate the crime chart after user authorization
        await generateCrimeChart();

    } catch (error) {
        console.error('Error during initialization:', error);
        alert('An error occurred during initialization.');
        window.location.href = '/html/main.html'; // Redirect to the main page if there's an error
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

    fetchCrimeSummaryDetails();
});

// Helper function to adjust time and ensure correct timezone (UTC+4 for Dubai)
function convertToDubaiTime(date) {
    const dubaiOffset = 4 * 60; // Dubai is UTC+4
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000); // Convert to UTC
    const dubaiDate = new Date(utcDate.getTime() + dubaiOffset * 60000); // Apply Dubai offset

    // Subtract 1 day
    dubaiDate.setDate(dubaiDate.getDate() - 1);

    return dubaiDate;
}

async function fetchCrimeSummaryDetails() {
    try {
        const response = await fetch('/api/chartData?type=crime-summary', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });

        const data = await response.json();

        if (!data || data.length === 0) {
            document.querySelector(".crime-summary").textContent = "No data available for this week.";
            return;
        }

        // Initialize counts and severity weights
        let totalReports = 0;
        let lowSeverity = 0, mediumSeverity = 0, highSeverity = 0;
        let severityIndex = 0;

        data.forEach(item => {
            totalReports += item.count;
            if (item.severity === 'low') {
                lowSeverity += item.count;
                severityIndex += item.count * 1; // Low severity weight
            }
            if (item.severity === 'medium') {
                mediumSeverity += item.count;
                severityIndex += item.count * 2; // Medium severity weight
            }
            if (item.severity === 'high') {
                highSeverity += item.count;
                severityIndex += item.count * 3; // High severity weight
            }
        });

        // Calculate the average severity index (index) based on total reports
        const averageSeverityIndex = (totalReports > 0) ? (severityIndex / totalReports).toFixed(2) : 0;

        // Crime rate as a ratio of high-severity crimes to total crimes
        const highSeverityRate = totalReports > 0 ? ((highSeverity / totalReports) * 100).toFixed(2) : 0;

        // Set a basic trend analysis based on high severity rate and total reports
        const trend = highSeverityRate > 50
            ? "There is a predominance of high-severity incidents."
            : "Most incidents are of low to medium severity.";

        // Create a paragraph summary
        const summaryHTML = `
            <p>This week's crime index is <strong>${averageSeverityIndex}</strong>, with a high severity rate of <strong>${highSeverityRate}%</strong>. 
            There were <strong>${totalReports}</strong> reported incidents, categorized into 
            <strong>${lowSeverity}</strong> low-severity, <strong>${mediumSeverity}</strong> medium-severity, 
            and <strong>${highSeverity}</strong> high-severity cases. ${trend}</p>
        `;
        
        document.querySelector(".crime-summary").innerHTML = summaryHTML;

        // Create a chart to visualize the severity breakdown
        createSeverityChart(lowSeverity, mediumSeverity, highSeverity);

    } catch (error) {
        console.error('Error fetching weekly crime summary:', error);
        document.querySelector(".crime-summary").textContent = "Unable to fetch the summary.";
    }
}

// Function to create a bar chart using D3.js
function createSeverityChart(low, medium, high) {
    // Set up chart dimensions and data
    const data = [
        { severity: 'Low', count: low },
        { severity: 'Medium', count: medium },
        { severity: 'High', count: high }
    ];

    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 30, bottom: 30, left: 50 };

    // Clear any existing SVG in the chart container
    d3.select("#severityChart").selectAll("*").remove();

    // Create an SVG container
    const svg = d3.select("#severityChart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Define the X and Y scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.severity))
        .range([0, width])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count)])
        .nice()
        .range([height, 0]);

    // Create the X-axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Create the Y-axis
    svg.append("g")
        .call(d3.axisLeft(y));

    // Create the bars
    svg.selectAll(".bar")
        .data(data)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.severity))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.count))
        .attr("fill", d => d.severity === 'High' ? "#ff0000" : d.severity === 'Medium' ? "#ff9100" : "#ffb700");
}

// Initialize the function on page load
document.addEventListener('DOMContentLoaded', fetchCrimeSummaryDetails);



async function generateCrimeChart() {
    try {
        // Fetch crime data from the backend for the current week
        const response = await fetch('/api/chartData?type=crime-summary', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`, // Ensure the authentication token is included
            }
        });

        const data = await response.json();

        if (!data || data.length === 0) {
            console.error('No crime data available');
            return;
        }

        // Calculate the total number of reports and severities
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

        // Group reports by category and date
        const crimeData = {};
        data.forEach(item => {
            const dubaiDate = convertToDubaiTime(new Date(item.created_at));
            const date = dubaiDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const hour = dubaiDate.getHours(); // Convert time to Dubai time

            if (!crimeData[item.category]) {
                crimeData[item.category] = {
                    count: 0,
                    dates: {},
                    times: {}
                };
            }

            crimeData[item.category].count += item.count;

            // Group reports by date for each category
            if (!crimeData[item.category].dates[date]) {
                crimeData[item.category].dates[date] = { count: 0 };
            }
            crimeData[item.category].dates[date].count += item.count;

            // Group reports by hours for each category
            if (!crimeData[item.category].times[hour]) {
                crimeData[item.category].times[hour] = { count: 0 };
            }
            crimeData[item.category].times[hour].count += item.count;
        });

        // Find the highest category and most frequent date and time
        let highestCategory = '';
        let highestCount = 0;
        let mostFrequentDate = '';
        let mostFrequentTimeRange = { start: null, end: null };

        for (const category in crimeData) {
            if (crimeData[category].count > highestCount) {
                highestCategory = category;
                highestCount = crimeData[category].count;

                // Now find the most frequent date within this category
                const dates = crimeData[category].dates;
                mostFrequentDate = Object.keys(dates).reduce((a, b) => dates[a].count > dates[b].count ? a : b);

                // Find the most frequent time range
                const times = Object.keys(crimeData[category].times).map(Number).sort((a, b) => a - b);
                if (times.length > 1) {
                    mostFrequentTimeRange.start = Math.min(...times);
                    mostFrequentTimeRange.end = Math.max(...times);
                } else {
                    mostFrequentTimeRange.start = times[0];
                    mostFrequentTimeRange.end = times[0];
                }
            }
        }

        // Format the time range
        const formattedTimeRange = `${adjustTimeForTimezone(mostFrequentTimeRange.start)}:00 - ${adjustTimeForTimezone(mostFrequentTimeRange.end)}:00`;

        // Format the most frequent date for display
        const formattedDate = new Date(mostFrequentDate).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        // Sort data by count for proper bar height scaling
        const sortedData = Object.entries(crimeData)
            .sort(([, a], [, b]) => b.count - a.count)
            .map(([category, data]) => ({ category, count: data.count }));

        // Prepare labels and counts for the chart (sorted by count)
        const labels = sortedData.map(item => item.category);
        const counts = sortedData.map(item => item.count);

        // Get the current week's date range
        const { startDate, endDate } = getCurrentWeekRange();

        // Update the text with the dynamic data
        const reportSummaryText = `
            Out of all <strong>${totals.totalReports}</strong> crime reports received during the week of <strong>${startDate} - ${endDate}</strong>, 
            the breakdown reveals <strong>${totals.low}</strong> low-severity incidents, <strong>${totals.medium}</strong> medium-severity incidents, 
            and <strong>${totals.high}</strong> high-severity incidents.
            <br><br>
            <strong>${highestCategory}</strong> stands as the most prevalent category of crimes for this reporting period, 
            with the highest concentration of reports recorded on <strong>${formattedDate}</strong> between the hours of <strong>${formattedTimeRange}</strong>. 
            A total of <strong>${highestCount}</strong> incidents were logged for this category alone.
            <br><br>
            This substantial figure emphasizes the prominence of <strong>${highestCategory}</strong>, calling for targeted strategies and concerted efforts to 
            reduce its occurrence and safeguard the community from further risk.`;

        // Update the HTML element with the report summary text
        document.getElementById('highest-crime-category').innerHTML = reportSummaryText;

        // Set up the chart dimensions
        const width = 400;
        const height = 200;
        const margin = { top: 50, right: 30, bottom: 10, left: 200 };

        // Define color scale for each category
        const colorScale = d3.scaleOrdinal()
            .domain(labels)
            .range(['#E74C3C', '#F1C40F', '#2ECC71', '#27AE60', '#3498DB', '#9B59B6', '#E67E22', '#34495E']);

        // Create the SVG container
        const svg = d3.select('#crimeChart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        // Create the Y axis (categories)
        const y = d3.scaleBand()
            .range([0, height])
            .domain(labels)
            .padding(0.3);

        // Create the X axis (values)
        const x = d3.scaleLinear()
            .domain([0, d3.max(counts)]) // Max value from counts
            .range([0, width]);

        // Draw the bars
        svg.selectAll('rect')
            .data(sortedData)
            .enter()
            .append('rect')
            .attr('x', 0)
            .attr('y', d => y(d.category))
            .attr('width', d => x(d.count))
            .attr('height', y.bandwidth()) // Bar height corresponds to the value
            .attr('fill', d => colorScale(d.category));

        // Add category names inside the bars
        svg.selectAll('categoryText')
            .data(sortedData)
            .enter()
            .append('text')
            .attr('x', 10)
            .attr('y', d => y(d.category) + y.bandwidth() / 2 + 5)
            .attr('text-anchor', 'start')
            .style('fill', 'white')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .style('text-shadow', '2px 2px 4px rgba(0, 0, 0, 0.7)')
            .text(d => d.category);

    } catch (error) {
        console.error('Error fetching crime data:', error);
    }
}




// Helper function to get the current week's date range
function getCurrentWeekRange() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const diffToMonday = (dayOfWeek + 6) % 7; // Adjust for Sunday (day 0)
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Format dates as "MM/DD/YYYY"
    const options = { month: '2-digit', day: '2-digit', year: 'numeric' };
    const startDate = monday.toLocaleDateString('en-US', options);
    const endDate = sunday.toLocaleDateString('en-US', options);

    return { startDate, endDate };
}


// Helper function to find the most frequent item in an array
function findMostFrequent(arr) {
    const frequency = {};
    let maxFreq = 0;
    let mostFrequentItem = null;

    arr.forEach(item => {
        if (frequency[item]) {
            frequency[item]++;
        } else {
            frequency[item] = 1;
        }

        if (frequency[item] > maxFreq) {
            maxFreq = frequency[item];
            mostFrequentItem = item;
        }
    });

    return mostFrequentItem;
}

// Subtract 4 hours from the most frequent time range
function adjustTimeForTimezone(hour) {
    const adjustedHour = hour - 4;
    return adjustedHour >= 0 ? adjustedHour : 24 + adjustedHour; // Adjust for negative values (e.g., -1 becomes 23)
}

// Function to get the Monday and Sunday of the current week
function getWeekRange() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
    // Calculate the difference between today and Monday (day 1)
    const diffToMonday = (dayOfWeek + 6) % 7; // Adjust for Sunday (day 0)
    const monday = new Date(today);
    monday.setDate(today.getDate() - diffToMonday); // Set to the nearest Monday
  
    // Set the end date to the upcoming Sunday (6 days after Monday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6); // Set to Sunday (6 days later)
  
    // Format dates as "Month Day, Year"
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    const formattedMonday = monday.toLocaleDateString('en-US', options);
    const formattedSunday = sunday.toLocaleDateString('en-US', options);
  
    return { formattedMonday, formattedSunday };
}
  
// Function to update the report text with dates
function updateReportDates() {
    const { formattedMonday, formattedSunday } = getWeekRange();
  
    // Find elements and update their text content
    const startDateElement = document.getElementById('start-date');
    const endDateElement = document.getElementById('end-date');
    const titleStartDateElement = document.getElementById('title-start-date');
    const titleEndDateElement = document.getElementById('title-end-date');
  
    if (startDateElement && endDateElement) {
        startDateElement.textContent = formattedMonday;
        endDateElement.textContent = formattedSunday;
    } else {
        console.error('Elements for start date and end date not found');
    }

    if (titleStartDateElement && titleEndDateElement) {
        titleStartDateElement.textContent = formattedMonday;
        titleEndDateElement.textContent = formattedSunday;
    } else {
        console.error('Elements for title start date and title end date not found');
    }
}
  
// Wait until the DOM is fully loaded before running the script
document.addEventListener('DOMContentLoaded', updateReportDates);
