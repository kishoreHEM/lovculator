// js/auth.js (FINALIZED CLIENT-SIDE FORM HANDLER)

// NOTE: Ensure your AuthManager class definition is included
// This assumes the AuthManager class and authManager instance are available globally
// OR this file contains the AuthManager class definition (as shown in your prompt)
// For simplicity, we assume the definition is here.

class AuthManager {
    constructor(apiBase = '/api') {
        this.apiBase = apiBase;
        this.user = null; 
    }

    async signIn(username, password) {
        const response = await fetch(`${this.apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Sign-in failed. Check credentials.");
        }

        const userData = await response.json();
        this.user = userData;
        return userData;
    }

    async signUp(username, email, password) {
        const response = await fetch(`${this.apiBase}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Registration failed due to server error.' }));
            throw new Error(errorData.error || errorData.message || "Registration failed. Username/Email may be taken.");
        }

        const userData = await response.json();
        this.user = userData; // Auto-login after successful registration
        return userData;
    }

    async signOut() {
        try {
            // This is the route we need to implement on the server
            await fetch(`${this.apiBase}/auth/logout`, { method: 'POST' });
        } catch (error) {
            console.warn('Sign-Out API call failed, clearing local state anyway:', error);
        }
        this.user = null;
        // Redirect to a safe page after sign out
        window.location.href = '/'; 
    }

    async checkSession() {
        // This is the route we need to implement on the server
        try {
            const response = await fetch(`${this.apiBase}/auth/me`);
            
            if (!response.ok) {
                this.user = null;
                return null;
            }
            
            const userData = await response.json();
            this.user = userData;
            return userData;
        } catch (error) {
            console.error('Session Check Error:', error);
            this.user = null;
            return null;
        }
    }

    isAuthenticated() {
        return !!this.user;
    }

    getCurrentUser() {
        return this.user;
    }
}

const authManager = new AuthManager();

// --- Event Handlers using AuthManager ---

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    async function handleSignup(event) {
        event.preventDefault();
        errorMessage.textContent = ''; // Clear previous errors

        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (password.length < 6) {
             errorMessage.textContent = 'Password must be at least 6 characters.';
             return;
        }

        try {
            // Use the structured AuthManager class
            const user = await authManager.signUp(username, email, password);

            // Success: Registration automatically logs the user in (based on AuthManager logic)
            alert(`🎉 Success! Account created for ${user.username}. Redirecting to profile...`);
            window.location.href = '/profile'; 

        } catch (error) {
            console.error('Registration failed:', error);
            errorMessage.textContent = error.message;
        }
    }

    async function handleLogin(event) {
        event.preventDefault();
        errorMessage.textContent = ''; 
        
        // Login form typically uses 'username' field for either username or email
        const usernameOrEmail = document.getElementById('username-or-email').value.trim(); 
        const password = document.getElementById('password').value.trim();

        try {
            // Use the structured AuthManager class
            await authManager.signIn(usernameOrEmail, password);

            // Success: Redirect to profile
            alert(`👋 Welcome back!`);
            window.location.href = '/profile'; 

        } catch (error) {
            console.error('Login failed:', error);
            errorMessage.textContent = error.message;
        }
    }
});