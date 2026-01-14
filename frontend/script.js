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

// Format VirusTotal summary as HTML
function formatVirusTotalSummary(vtAnalysis) {
  if (!vtAnalysis) {
    return '<div class="result-status"><span class="status-label">VirusTotal:</span> <span class="status-value">No data available</span></div>';
  }
  const stats = vtAnalysis?.attributes?.stats || vtAnalysis?.attributes?.results?.stats || vtAnalysis?.attributes || {};
  const malicious = stats?.malicious ?? vtAnalysis?.attributes?.malicious ?? 0;
  const suspicious = stats?.suspicious ?? vtAnalysis?.attributes?.suspicious ?? 0;
  const harmless = stats?.harmless ?? vtAnalysis?.attributes?.harmless ?? 0;
  const undetected = stats?.undetected ?? vtAnalysis?.attributes?.undetected ?? 0;
  
  const total = malicious + suspicious + harmless + undetected;
  const threatLevel = malicious > 0 ? 'high' : suspicious > 0 ? 'medium' : 'low';
  
  return `
    <div class="result-header">
      <h3 style="margin: 0 0 1rem 0; font-size: 1.125rem; font-weight: 700; color: var(--text-primary);">VirusTotal Analysis</h3>
      <div class="threat-badge threat-${threatLevel}">
        ${threatLevel === 'high' ? '⚠️ High Risk' : threatLevel === 'medium' ? '⚡ Medium Risk' : '✓ Low Risk'}
      </div>
    </div>
    <div class="result-stats">
      <div class="stat-item stat-danger">
        <span class="stat-label">Malicious</span>
        <span class="stat-value">${malicious}</span>
      </div>
      <div class="stat-item stat-warning">
        <span class="stat-label">Suspicious</span>
        <span class="stat-value">${suspicious}</span>
      </div>
      <div class="stat-item stat-success">
        <span class="stat-label">Harmless</span>
        <span class="stat-value">${harmless}</span>
      </div>
      <div class="stat-item stat-neutral">
        <span class="stat-label">Undetected</span>
        <span class="stat-value">${undetected}</span>
      </div>
    </div>
    ${total > 0 ? `<div class="result-total">Total scans: ${total}</div>` : ''}
  `;
}

// Render URL analysis result
function renderUrlResult(data) {
  const vtHtml = formatVirusTotalSummary(data.virusTotal);
  urlResult.innerHTML = vtHtml;
  
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
    urlResult.innerHTML = '<div class="result-message" style="color: var(--danger); font-weight: 600;">⚠️ Please login to use this feature</div>';
    return;
  }
  
  urlResult.innerHTML = '<div class="result-loading" style="text-align: center; padding: 2rem;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div><p style="margin-top: 1rem; color: var(--text-secondary);">Scanning URL...</p></div>';
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
    urlResult.innerHTML = `<div class="result-error" style="color: var(--danger); font-weight: 600; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.2);">❌ Error: ${err.message}</div>`;
  }
});

// Render email analysis result
function renderEmailResult(data) {
  const { extractedUrls = [], analyses = [] } = data;
  let html = '';
  
  html += `<div class="result-header">
    <h3 style="margin: 0 0 1rem 0; font-size: 1.125rem; font-weight: 700; color: var(--text-primary);">Email Analysis</h3>
    <div class="extracted-count">Found ${extractedUrls.length} URL${extractedUrls.length !== 1 ? 's' : ''}</div>
  </div>`;
  
  if (extractedUrls.length === 0) {
    html += '<div class="result-message">No URLs found in email content.</div>';
  } else {
    html += '<div class="url-list">';
    extractedUrls.forEach((url, index) => {
      html += `<div class="url-item">
        <span class="url-number">${index + 1}</span>
        <span class="url-text">${url}</span>
      </div>`;
    });
    html += '</div>';
  }
  
  if (analyses.length > 0) {
    html += '<div class="analyses-section" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">';
    analyses.forEach((analysis, index) => {
      html += `<div class="analysis-item" style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(255, 255, 255, 0.5); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">`;
      html += `<div style="margin-bottom: 0.75rem; font-weight: 600; color: var(--text-primary);">URL ${index + 1}: <span style="color: var(--primary); word-break: break-all;">${analysis.url}</span></div>`;
      if (analysis.error) {
        html += `<div class="result-error">Error: ${analysis.error}</div>`;
      } else {
        html += formatVirusTotalSummary(analysis.virusTotal);
      }
      html += '</div>';
    });
    html += '</div>';
  }
  
  emailResult.innerHTML = html;
  
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
    emailResult.innerHTML = '<div class="result-message" style="color: var(--danger); font-weight: 600;">⚠️ Please login to use this feature</div>';
    return;
  }
  
  emailResult.innerHTML = '<div class="result-loading" style="text-align: center; padding: 2rem;"><div style="display: inline-block; width: 40px; height: 40px; border: 4px solid var(--gray-200); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite;"></div><p style="margin-top: 1rem; color: var(--text-secondary);">Analyzing email...</p></div>';
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
    emailResult.innerHTML = `<div class="result-error" style="color: var(--danger); font-weight: 600; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-radius: var(--radius-md); border: 1px solid rgba(239, 68, 68, 0.2);">❌ Error: ${err.message}</div>`;
  }
});

// Profile management
function editProfile() {
  // For now, just show a simple alert. You can expand this later
  alert('Profile editing feature coming soon!');
}

async function logout() {
  try {
    // Close mobile menu if it's open
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    if (mobileMenu && mobileMenu.classList.contains('open')) {
      mobileMenu.classList.remove('open');
      if (mobileMenuOverlay) {
        mobileMenuOverlay.classList.remove('active');
      }
      document.body.style.overflow = '';
    }
    
    // Show "Bye" popup first
    showByePopup();
    
    // Wait a moment for the popup to be visible
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Call logout API
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      // Update UI state
      showUnauthenticatedUser();
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } else {
      console.error('Logout failed');
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Show "Bye" popup
function showByePopup() {
  // Create popup element
  const popup = document.createElement('div');
  popup.className = 'bye-popup';
  popup.innerHTML = `
    <div class="bye-popup-content">
      <div class="bye-icon">👋</div>
      <h3>Bye!</h3>
      <p>You've been successfully logged out</p>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(popup);
  
  // Show popup
  setTimeout(() => {
    popup.classList.add('show');
  }, 10);
  
  // Remove popup after animation
  setTimeout(() => {
    popup.classList.remove('show');
    setTimeout(() => {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 300);
  }, 2000);
}

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


