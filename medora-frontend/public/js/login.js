document.getElementById('loginButton').addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();
        if (data.success) {
            // Store user data in localStorage
            localStorage.setItem('user', JSON.stringify({ email, tenantId: data.tenantId, role: data.role }));
            // Redirect to index.html
            window.location.href = '/index.html';
        } else {
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Error during login:', error);
        errorMessage.style.display = 'block';
    }
});
