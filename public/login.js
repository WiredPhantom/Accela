// public/login.js - Device Lock Login Handler
const form = document.getElementById('login-form');
const errorDiv = document.getElementById('error-message');
const submitBtn = document.getElementById('submit-btn');

function showError(message) {
  errorDiv.innerHTML = message;
  errorDiv.classList.add('show');
  
  errorDiv.style.animation = 'none';
  setTimeout(() => {
    errorDiv.style.animation = 'shake 0.3s';
  }, 10);
}

function showDeviceLocked(message, expiresAt, remainingDays) {
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  errorDiv.innerHTML = `
    <div class="device-locked">
      <div class="lock-icon">🔒</div>
      <div class="lock-title">Device Locked</div>
      <div class="lock-message">${message}</div>
      <div class="lock-expiry">Lock expires on: ${expiryDate}${remainingDays ? ` (${remainingDays} days remaining)` : ''}</div>
      <div class="lock-help" style="margin-top: 8px; font-size: 12px; color: #888;">
        Contact admin to transfer your account to a new device.
      </div>
    </div>
  `;
  errorDiv.classList.add('show');
}

function showSuccess(message) {
  errorDiv.innerHTML = message;
  errorDiv.style.backgroundColor = 'rgba(0, 255, 204, 0.1)';
  errorDiv.style.borderColor = '#00ffcc';
  errorDiv.style.color = '#00ffcc';
  errorDiv.classList.add('show');
}

function hideError() {
  errorDiv.classList.remove('show');
  errorDiv.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
  errorDiv.style.borderColor = '#ff4444';
  errorDiv.style.color = '#ff4444';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  hideError();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {
      window.location.href = '/';
    } else if (data.reason === 'DEVICE_LOCKED') {
      // Account is locked to a different device
      showDeviceLocked(data.message, data.expiresAt, data.remainingDays);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enter';
    } else {
      showError(data.message || 'Login failed');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enter';
    }
  } catch (error) {
    console.error('Login error:', error);
    showError('An error occurred. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enter';
  }
});

// Hide error when user starts typing
document.getElementById('username').addEventListener('input', hideError);
document.getElementById('password').addEventListener('input', hideError);
