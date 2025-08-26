// Menu functionality for login and signup pages
document.addEventListener('DOMContentLoaded', function() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const closeMenu = document.getElementById('close-menu');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const themeOptions = document.querySelectorAll('input[name="theme"]');

  // Initialize theme
  let currentTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  themeOptions.forEach(option => {
    if (option.value === currentTheme) option.checked = true;
  });

  // Menu functionality
  menuToggle.addEventListener('click', () => {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  closeMenu.addEventListener('click', closeSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Theme switching
  themeOptions.forEach(option => {
    option.addEventListener('change', (e) => {
      const theme = e.target.value;
      setTheme(theme);
    });
  });

  function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }
});
