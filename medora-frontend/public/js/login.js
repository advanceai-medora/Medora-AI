document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('loginButton');
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');

    loginButton.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('http://localhost:5000/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.message);

            sessionStorage.setItem('isAuthenticated', 'true');
            sessionStorage.setItem('email', email);
            sessionStorage.setItem('subscription', data.subscription);
            sessionStorage.setItem('trial_end', data.trial_end);
            sessionStorage.setItem('card_last4', data.card_last4);

            // Map email to tenantId (temporary hardcoded mapping)
            const tenantId = email === 'doctor@allergyaffiliates' ? 'clinic_123' : 'default_tenant';
            localStorage.setItem('tenantId', tenantId);

            window.location.href = '/index.html';
        } catch (error) {
            alert('Login failed: ' + error.message);
        }
    });
});
