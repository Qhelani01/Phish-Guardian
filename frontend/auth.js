// Authentication handling for login and signup pages

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Auth script loaded');
  
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  console.log('Login form found:', loginForm);
  console.log('Signup form found:', signupForm);

  // Check if user is already logged in
  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      if (response.ok) {
        // User is logged in, redirect to main app
        window.location.href = '/';
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  }

  // Handle login form submission
  if (loginForm) {
    console.log('Setting up login form listener');
    loginForm.addEventListener('submit', async (e) => {
      console.log('Login form submitted');
      e.preventDefault();
      
      const email = document.getElementById('email-input').value.trim();
      const password = document.getElementById('password-input').value;
      const resultDiv = document.getElementById('login-result');
      
      console.log('Login attempt for:', email);
      
      if (!email || !password) {
        resultDiv.textContent = 'Please fill in all fields';
        return;
      }
      
      resultDiv.textContent = 'Signing in...';
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        console.log('Login response:', data);
        
        if (response.ok) {
          resultDiv.textContent = 'Login successful! Redirecting...';
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } else {
          resultDiv.textContent = `Error: ${data.error}`;
        }
      } catch (error) {
        console.error('Login error:', error);
        resultDiv.textContent = 'Error: Network error occurred';
      }
    });
  }

  // Handle signup form submission
  if (signupForm) {
    console.log('Setting up signup form listener');
    signupForm.addEventListener('submit', async (e) => {
      console.log('Signup form submitted');
      e.preventDefault();
      
      const name = document.getElementById('name-input').value.trim();
      const email = document.getElementById('email-input').value.trim();
      const password = document.getElementById('password-input').value;
      const resultDiv = document.getElementById('signup-result');
      
      console.log('Signup attempt for:', email, 'name:', name);
      
      if (!name || !email || !password) {
        resultDiv.textContent = 'Please fill in all fields';
        return;
      }
      
      if (password.length < 6) {
        resultDiv.textContent = 'Password must be at least 6 characters';
        return;
      }
      
      resultDiv.textContent = 'Creating account...';
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        console.log('Signup response:', data);
        
        if (response.ok) {
          resultDiv.textContent = 'Account created successfully! Redirecting...';
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        } else {
          resultDiv.textContent = `Error: ${data.error}`;
        }
      } catch (error) {
        console.error('Signup error:', error);
        resultDiv.textContent = 'Error: Network error occurred';
      }
    });
  }

  // Check auth status when page loads
  checkAuthStatus();
});
