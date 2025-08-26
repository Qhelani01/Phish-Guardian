// Main application script with authentication
let currentUser = null;

// DOM elements
const urlForm = document.getElementById('url-form');
const urlInput = document.getElementById('url-input');
const urlResult = document.getElementById('url-result');

const emailForm = document.getElementById('email-form');
const emailInput = document.getElementById('email-input');
const emailResult = document.getElementById('email-result');

const userWelcome = document.getElementById('user-welcome');
const userName = document.getElementById('user-name');
const dashboard = document.getElementById('dashboard');
const scanHistory = document.getElementById('scan-history');

// Navigation elements
const headerAuth = document.getElementById('header-auth');
const profileSection = document.getElementById('profile-section');
const headerUserName = document.getElementById('header-user-name');
const profileIcon = document.getElementById('profile-icon');
const profileInitial = document.getElementById('profile-initial');

// Check authentication status on page load
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showAuthenticatedUser();
      loadScanHistory();
    } else {
      showUnauthenticatedUser();
    }
  } catch (error) {
    console.log('Not authenticated');
    showUnauthenticatedUser();
  }
}

// Show authenticated user interface
function showAuthenticatedUser() {
  if (currentUser) {
    userName.textContent = currentUser.name;
    headerUserName.textContent = currentUser.name;
    userWelcome.style.display = 'block';
    headerAuth.style.display = 'none';
    profileSection.style.display = 'flex';
    profileInitial.textContent = currentUser.name.charAt(0).toUpperCase();
    
    dashboard.style.display = 'block';
  }
}

// Show unauthenticated user interface
function showUnauthenticatedUser() {
  currentUser = null;
  userWelcome.style.display = 'none';
  headerAuth.style.display = 'flex';
  profileSection.style.display = 'none';
  dashboard.style.display = 'none';
}

// Load user's scan history
async function loadScanHistory() {
  if (!currentUser) return;
  
  try {
    const response = await fetch('/api/user/scans', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      displayScanHistory(data.scans);
    } else {
      scanHistory.innerHTML = '<p>Failed to load scan history</p>';
    }
  } catch (error) {
    scanHistory.innerHTML = '<p>Error loading scan history</p>';
  }
}

// Display scan history in the dashboard
function displayScanHistory(scans) {
  if (!scans || scans.length === 0) {
    scanHistory.innerHTML = '<p>No scans yet. Start by analyzing a URL or email!</p>';
    return;
  }
  
  const historyHTML = scans.map(scan => {
    const timestamp = new Date(scan.timestamp).toLocaleString();
    let scanType = 'Unknown';
    let scanContent = '';
    
    if (scan.url) {
      scanType = 'URL Scan';
      scanContent = scan.url;
    } else if (scan.emailText) {
      scanType = 'Email Analysis';
      scanContent = scan.emailText.substring(0, 50) + '...';
    }
    
    return `
      <div class="scan-item">
        <div class="scan-header">
          <span class="scan-type">${scanType}</span>
          <span class="scan-time">${timestamp}</span>
        </div>
        <div class="scan-content">${scanContent}</div>
      </div>
    `;
  }).join('');
  
  scanHistory.innerHTML = historyHTML;
}

// Format VirusTotal summary
function formatVirusTotalSummary(vtAnalysis) {
  if (!vtAnalysis) return 'VirusTotal: no data';
  const stats = vtAnalysis?.attributes?.stats || vtAnalysis?.attributes?.results?.stats || vtAnalysis?.attributes || {};
  const malicious = stats?.malicious ?? vtAnalysis?.attributes?.malicious ?? 0;
  const suspicious = stats?.suspicious ?? vtAnalysis?.attributes?.suspicious ?? 0;
  const harmless = stats?.harmless ?? vtAnalysis?.attributes?.harmless ?? 0;
  const undetected = stats?.undetected ?? vtAnalysis?.attributes?.undetected ?? 0;
  return `VirusTotal — malicious: ${malicious}, suspicious: ${suspicious}, harmless: ${harmless}, undetected: ${undetected}`;
}

// Render URL analysis result
function renderUrlResult(data) {
  const vtText = formatVirusTotalSummary(data.virusTotal);
  urlResult.textContent = vtText;
  
  // Reload scan history if user is authenticated
  if (currentUser) {
    loadScanHistory();
  }
}

// Handle URL form submission
urlForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = (urlInput.value || '').trim();
  if (!value) return;
  
  if (!currentUser) {
    urlResult.textContent = 'Please login to use this feature';
    return;
  }
  
  urlResult.textContent = 'Scanning URL...';
  try {
    const res = await fetch('/api/analyze/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ url: value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    renderUrlResult(data);
  } catch (err) {
    urlResult.textContent = `Error: ${err.message}`;
  }
});

// Render email analysis result
function renderEmailResult(data) {
  const { extractedUrls = [], analyses = [] } = data;
  const parts = [];
  parts.push(`Extracted URLs (${extractedUrls.length}):`);
  if (extractedUrls.length === 0) {
    parts.push('- none');
  } else {
    for (const u of extractedUrls) parts.push(`- ${u}`);
  }
  for (const a of analyses) {
    const vtText = formatVirusTotalSummary(a.virusTotal);
    parts.push(`\nURL: ${a.url}\n${vtText}`);
  }
  emailResult.textContent = parts.join('\n');
  
  // Reload scan history if user is authenticated
  if (currentUser) {
    loadScanHistory();
  }
}

// Handle email form submission
emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = (emailInput.value || '').trim();
  if (!value) return;
  
  if (!currentUser) {
    emailResult.textContent = 'Please login to use this feature';
    return;
  }
  
  emailResult.textContent = 'Analyzing email...';
  try {
    const res = await fetch('/api/analyze/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emailText: value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    renderEmailResult(data);
  } catch (err) {
    emailResult.textContent = `Error: ${err.message}`;
  }
});

// Initialize app
checkAuthStatus();

// Smart footer visibility
function handleFooterVisibility() {
  const footer = document.querySelector('.footer');
  const dashboard = document.getElementById('dashboard');
  const container = document.querySelector('.container');
  
  if (!footer || !container) return;
  
  // Always show footer on home page (when no dashboard)
  if (!dashboard || dashboard.style.display === 'none') {
    footer.style.display = 'block';
    return;
  }
  
  // Smart hiding only when dashboard is visible
  const containerHeight = container.scrollHeight;
  const windowHeight = window.innerHeight;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  // Show footer only when there's enough content or user has scrolled down
  if (containerHeight > windowHeight || scrollTop > 100) {
    footer.style.display = 'block';
  } else {
    footer.style.display = 'none';
  }
}

// Mobile Menu Functionality
function initializeMobileMenu() {
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileMenuClose = document.getElementById('mobile-menu-close');
  const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
  const dropdownToggles = document.querySelectorAll('.mobile-dropdown-toggle');
  
  // Toggle mobile menu
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileMenu.classList.add('open');
      mobileMenuOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }
  
  // Close mobile menu
  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
  }
  
  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener('click', closeMobileMenu);
  }
  
  // Dropdown functionality
  dropdownToggles.forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      const target = e.target.getAttribute('data-target');
      const dropdown = document.getElementById(target);
      const isActive = dropdown.classList.contains('active');
      
      // Close all other dropdowns
      document.querySelectorAll('.mobile-dropdown-content').forEach(dd => {
        dd.classList.remove('active');
      });
      
      // Toggle current dropdown
      if (!isActive) {
        dropdown.classList.add('active');
        e.target.classList.add('active');
      } else {
        dropdown.classList.remove('active');
        e.target.classList.remove('active');
      }
    });
  });
  
  // Close mobile menu function
  function closeMobileMenu() {
    mobileMenu.classList.remove('open');
    mobileMenuOverlay.classList.remove('active');
    document.body.style.overflow = '';
    
    // Close all dropdowns
    document.querySelectorAll('.mobile-dropdown-content').forEach(dd => {
      dd.classList.remove('active');
    });
    document.querySelectorAll('.mobile-dropdown-toggle').forEach(toggle => {
      toggle.classList.remove('active');
    });
  }
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    }
  });
}

// Update mobile menu authentication state
function updateMobileAuthState() {
  const mobileGuestAuth = document.getElementById('mobile-guest-auth');
  const mobileUserAuth = document.getElementById('mobile-user-auth');
  const mobileUserName = document.getElementById('mobile-user-name');
  
  if (currentUser && mobileGuestAuth && mobileUserAuth && mobileUserName) {
    mobileGuestAuth.style.display = 'none';
    mobileUserAuth.style.display = 'block';
    mobileUserName.textContent = currentUser.name;
  } else if (mobileGuestAuth && mobileUserAuth) {
    mobileGuestAuth.style.display = 'block';
    mobileUserAuth.style.display = 'none';
  }
}

// Add event listeners for footer visibility
window.addEventListener('scroll', handleFooterVisibility);
window.addEventListener('resize', handleFooterVisibility);

// Initialize mobile menu when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  handleFooterVisibility();
  initializeMobileMenu();
});

// Update mobile auth state when user logs in/out
const originalShowAuthenticatedUser = showAuthenticatedUser;
const originalShowUnauthenticatedUser = showUnauthenticatedUser;

showAuthenticatedUser = function() {
  originalShowAuthenticatedUser.call(this);
  updateMobileAuthState();
};

showUnauthenticatedUser = function() {
  originalShowUnauthenticatedUser.call(this);
  updateMobileAuthState();
};


