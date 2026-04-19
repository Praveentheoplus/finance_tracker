// Login page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const registerLink = document.getElementById('register-link');
    const modal = document.getElementById('register-modal');
    const closeBtn = document.querySelector('.close');
    const errorMessage = document.getElementById('error-message');

    // Modal controls
    registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'block';
    });

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        registerForm.reset();
        clearError();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            registerForm.reset();
            clearError();
        }
    });

    // Login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('.login-btn');
        const formData = new FormData(loginForm);

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Store session token
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Redirect to main app
                window.location.href = '/';
            } else {
                showError(data.message || 'Login failed');
            }
        } catch (error) {
            showError('Network error. Please try again.');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    // Register form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = registerForm.querySelector('.register-btn');
        const formData = new FormData(registerForm);

        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        submitBtn.classList.add('loading');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: formData.get('username'),
                    email: formData.get('email'),
                    password: formData.get('password')
                })
            });

            const data = await response.json();

            if (response.ok) {
                modal.style.display = 'none';
                registerForm.reset();
                showError('Account created successfully! Please log in.', 'success');
            } else {
                showError(data.message || 'Registration failed');
            }
        } catch (error) {
            showError('Network error. Please try again.');
        } finally {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    });

    function showError(message, type = 'error') {
        errorMessage.textContent = message;
        errorMessage.className = type === 'success' ? 'success-message' : 'error-message';
    }

    function clearError() {
        errorMessage.textContent = '';
        errorMessage.className = 'error-message';
    }

    // Check if user is already logged in
    const token = localStorage.getItem('authToken');
    if (token) {
        // Verify token and redirect if valid
        fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (response.ok) {
                window.location.href = '/';
            }
        })
        .catch(() => {
            // Token invalid, stay on login page
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
        });
    }
});