/**
 * Landing page: show Sign in / Sign up vs "Open analyzer" when already logged in.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const guest = document.getElementById('landing-nav-guest');
  const user = document.getElementById('landing-nav-user');
  const mobileGuest = document.getElementById('landing-mobile-guest');
  const mobileUser = document.getElementById('landing-mobile-user');
  const landingName = document.getElementById('landing-header-name');
  const mobileUserName = document.getElementById('landing-mobile-user-name');
  const ctaGuest = document.getElementById('landing-cta-guest');
  const ctaUser = document.getElementById('landing-cta-user');

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('not auth');
    const data = await res.json();
    const name = data.user?.name || 'User';
    if (guest) guest.style.display = 'none';
    if (user) {
      user.style.display = 'flex';
      if (landingName) landingName.textContent = name;
    }
    if (mobileUserName) mobileUserName.textContent = name;
    if (mobileGuest) mobileGuest.style.display = 'none';
    if (mobileUser) mobileUser.style.display = 'block';
    if (ctaGuest) ctaGuest.hidden = true;
    if (ctaUser) ctaUser.hidden = false;
  } catch {
    if (guest) guest.style.display = 'flex';
    if (user) user.style.display = 'none';
    if (mobileGuest) mobileGuest.style.display = 'block';
    if (mobileUser) mobileUser.style.display = 'none';
    if (ctaGuest) ctaGuest.hidden = false;
    if (ctaUser) ctaUser.hidden = true;
  }
});
