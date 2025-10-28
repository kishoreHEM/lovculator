// Enhanced Contact Form Functionality
class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.isSubmitting = false;
        this.init();
    }

    init() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            this.addInputAnimations();
            this.loadSavedFormData();
            this.setupAutoSave();
        }
        console.log('💌 Contact page loaded successfully!');
    }

    addInputAnimations() {
        const inputs = document.querySelectorAll('.form-group input, .form-group textarea, .form-group select');
        
        inputs.forEach(input => {
            // Add focus effect
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', () => {
                if (!input.value) {
                    input.parentElement.classList.remove('focused');
                }
            });

            // Add character counter for message
            if (input.id === 'message') {
                this.setupCharacterCounter(input);
            }
        });
    }

    setupCharacterCounter(textarea) {
        const counter = document.createElement('div');
        counter.className = 'char-counter';
        counter.style.cssText = `
            text-align: right;
            font-size: 0.8rem;
            color: #8e8e8e;
            margin-top: 5px;
        `;
        
        textarea.parentElement.appendChild(counter);
        
        const updateCounter = () => {
            const count = textarea.value.length;
            counter.textContent = `${count}/1000 characters`;
            
            if (count > 800) {
                counter.style.color = '#ff6b6b';
            } else if (count > 600) {
                counter.style.color = '#ffa500';
            } else {
                counter.style.color = '#8e8e8e';
            }
            
            if (count > 1000) {
                textarea.value = textarea.value.substring(0, 1000);
                counter.textContent = '1000/1000 characters (maximum reached)';
                counter.style.color = '#ff4757';
            }
        };
        
        textarea.addEventListener('input', updateCounter);
        updateCounter(); // Initialize counter
    }

    setupAutoSave() {
        const inputs = this.form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.saveFormData();
            });
        });

        // Auto-save every 30 seconds as backup
        setInterval(() => {
            this.saveFormData();
        }, 30000);
    }

    saveFormData() {
        const formData = {
            name: document.getElementById('name')?.value || '',
            email: document.getElementById('email')?.value || '',
            subject: document.getElementById('subject')?.value || '',
            message: document.getElementById('message')?.value || ''
        };
        
        localStorage.setItem('contactFormDraft', JSON.stringify(formData));
    }

    loadSavedFormData() {
        try {
            const savedData = localStorage.getItem('contactFormDraft');
            if (savedData) {
                const formData = JSON.parse(savedData);
                
                if (formData.name) document.getElementById('name').value = formData.name;
                if (formData.email) document.getElementById('email').value = formData.email;
                if (formData.subject) document.getElementById('subject').value = formData.subject;
                if (formData.message) document.getElementById('message').value = formData.message;
                
                // Trigger input events to update character counter and focused states
                this.form.querySelectorAll('input, textarea, select').forEach(input => {
                    if (input.value) {
                        input.dispatchEvent(new Event('input'));
                        input.parentElement.classList.add('focused');
                    }
                });

                this.showDraftNotification();
            }
        } catch (error) {
            console.log('No saved form data found or error loading draft');
        }
    }

    showDraftNotification() {
        const notification = document.createElement('div');
        notification.className = 'draft-notification';
        notification.style.cssText = `
            background: #fff3cd;
            color: #856404;
            padding: 10px 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            border: 1px solid #ffeaa7;
            font-size: 0.9rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        notification.innerHTML = `
            <span>📝 Draft restored from your last session</span>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: #856404;
                cursor: pointer;
                font-size: 1.2rem;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
        `;
        
        const formContainer = document.querySelector('.contact-form-container');
        formContainer.insertBefore(notification, formContainer.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isSubmitting) {
            return; // Prevent multiple submissions
        }

        const submitBtn = this.form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        if (this.validateForm(formData)) {
            this.isSubmitting = true;
            
            // Show loading state
            submitBtn.innerHTML = '⏳ Sending...';
            submitBtn.disabled = true;

            try {
                // Simulate API call - in a real app, you'd send to your backend
                await this.sendFormData(formData);
                
                this.showSuccessMessage();
                this.clearSavedFormData();
                this.form.reset();
                
                // Remove focused classes after reset
                document.querySelectorAll('.form-group').forEach(group => {
                    group.classList.remove('focused');
                });

                // Track successful submission
                this.trackSubmission('success');

            } catch (error) {
                this.showError('Sorry, there was an error sending your message. Please try again.');
                this.trackSubmission('error');
                console.error('Form submission error:', error);
            } finally {
                // Reset button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                this.isSubmitting = false;
            }
        }
    }

    async sendFormData(formData) {
        // Simulate API call delay
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate random success/failure for demo
                const isSuccess = Math.random() > 0.1; // 90% success rate for demo
                
                if (isSuccess) {
                    resolve({ success: true, message: 'Message sent successfully' });
                } else {
                    reject(new Error('Network error'));
                }
            }, 2000);
        });
    }

    validateForm(data) {
        // Remove any existing messages
        this.removeExistingMessages();

        const errors = [];

        if (!data.name.trim()) {
            errors.push('Please enter your name');
        } else if (data.name.trim().length < 2) {
            errors.push('Name must be at least 2 characters long');
        }

        if (!data.email.trim()) {
            errors.push('Please enter your email address');
        } else if (!this.isValidEmail(data.email)) {
            errors.push('Please enter a valid email address');
        }

        if (!data.subject) {
            errors.push('Please select a subject');
        }

        if (!data.message.trim()) {
            errors.push('Please enter your message');
        } else if (data.message.trim().length < 10) {
            errors.push('Message must be at least 10 characters long');
        } else if (data.message.trim().length > 1000) {
            errors.push('Message must be less than 1000 characters');
        }

        if (errors.length > 0) {
            this.showErrors(errors);
            return false;
        }

        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showErrors(errors) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.style.cssText = `
            background: #ff4757;
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            font-weight: 500;
        `;
        
        if (errors.length === 1) {
            errorDiv.textContent = errors[0];
        } else {
            errorDiv.innerHTML = `
                <strong>Please fix the following errors:</strong>
                <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            `;
        }
        
        const form = document.querySelector('.contact-form');
        form.insertBefore(errorDiv, form.firstChild);
        
        // Scroll to error message
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove error after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    showError(message) {
        this.removeExistingMessages();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.style.cssText = `
            background: #ff4757;
            color: white;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 15px;
            text-align: center;
            font-weight: 500;
        `;
        errorDiv.textContent = message;
        
        const form = document.querySelector('.contact-form');
        form.insertBefore(errorDiv, form.firstChild);
        
        // Remove error after 3 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 3000);
    }

    showSuccessMessage() {
        this.removeExistingMessages();
        
        const successDiv = document.createElement('div');
        successDiv.className = 'form-success';
        successDiv.style.cssText = `
            background: #2ed573;
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 500;
            font-size: 1.1rem;
            animation: slideInDown 0.5s ease-out;
        `;
        successDiv.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 10px;">💖</div>
            <div style="font-weight: 600; margin-bottom: 5px;">Thank you for your message!</div>
            <div>We'll get back to you within 24 hours.</div>
        `;
        
        const formContainer = document.querySelector('.contact-form-container');
        formContainer.insertBefore(successDiv, formContainer.firstChild);
        
        // Scroll to success message
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove success message after 6 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.style.animation = 'slideOutUp 0.5s ease-in';
                setTimeout(() => {
                    if (successDiv.parentElement) {
                        successDiv.remove();
                    }
                }, 500);
            }
        }, 6000);
    }

    removeExistingMessages() {
        const existingMessages = document.querySelectorAll('.form-error, .form-success, .draft-notification');
        existingMessages.forEach(message => message.remove());
    }

    clearSavedFormData() {
        localStorage.removeItem('contactFormDraft');
    }

    trackSubmission(status) {
        // Track form submission for analytics
        console.log(`Form submission: ${status}`);
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'contact_form_submission', {
                'event_category': 'engagement',
                'event_label': status
            });
        }
    }
}

// Add CSS animations for messages
const contactStyles = `
@keyframes slideInDown {
    from {
        transform: translateY(-20px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes slideOutUp {
    from {
        transform: translateY(0);
        opacity: 1;
    }
    to {
        transform: translateY(-20px);
        opacity: 0;
    }
}

.char-counter {
    text-align: right;
    font-size: 0.8rem;
    color: #8e8e8e;
    margin-top: 5px;
}

@media (max-width: 768px) {
    .char-counter {
        font-size: 0.7rem;
    }
}
`;

// Inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = contactStyles;
document.head.appendChild(styleSheet);

// Initialize contact form when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ContactForm();
});

// Handle page visibility changes to auto-save
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Auto-save when user leaves the page
        const contactForm = document.getElementById('contactForm');
        if (contactForm) {
            const formData = {
                name: document.getElementById('name')?.value || '',
                email: document.getElementById('email')?.value || '',
                subject: document.getElementById('subject')?.value || '',
                message: document.getElementById('message')?.value || ''
            };
            localStorage.setItem('contactFormDraft', JSON.stringify(formData));
        }
    }
});

// Handle page refresh/closing
window.addEventListener('beforeunload', (event) => {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        const formData = {
            name: document.getElementById('name')?.value || '',
            email: document.getElementById('email')?.value || '',
            subject: document.getElementById('subject')?.value || '',
            message: document.getElementById('message')?.value || ''
        };
        
        // Only prompt if there's unsaved data
        const hasData = Object.values(formData).some(value => value.trim().length > 0);
        if (hasData) {
            localStorage.setItem('contactFormDraft', JSON.stringify(formData));
        }
    }
});