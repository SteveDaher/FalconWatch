async function fetchReports() {
    const userId = localStorage.getItem('userId'); // assuming userId is stored in localStorage
    const role = await fetch(`/userRole?userId=${userId}`).then(res => res.json()).then(data => data.role);
  
    let reports;
    if (role === 'police') {
      reports = await fetch('/allReports?userId=' + userId).then(res => res.json());
    } else {
      reports = await fetch('/reports?userId=' + userId).then(res => res.json());
    }
  
    displayReports(reports);
  }
  