// Enhanced Contact Form with EmailJS - READY TO USE
class ContactForm {
    constructor() {
        this.form = document.getElementById('contactForm');
        this.isSubmitting = false;
        
        // 🔥 REPLACE THESE WITH YOUR ACTUAL EMAILJS IDs 🔥
        this.EMAILJS_SERVICE_ID = 'service_2za2ik3'; // Your Service ID
        this.EMAILJS_TEMPLATE_ID = 'template_ad74h4v'; // Get from EmailJS Templates
        this.EMAILJS_PUBLIC_KEY = 'qayprrSygdVRx_yOH'; // Get from EmailJS Account
        
        this.init();
    }

    init() {
        if (this.form) {
            console.log('📧 Loading EmailJS...');
            
            this.loadEmailJSSDK().then(() => {
                console.log('✅ EmailJS loaded successfully');
                this.form.addEventListener('submit', (e) => this.handleSubmit(e));
                this.addInputAnimations();
                this.loadSavedFormData();
                this.setupAutoSave();
            }).catch(error => {
                console.error('❌ Failed to load EmailJS:', error);
                this.showError('Contact form temporarily unavailable. Please email us directly.');
            });
        }
    }

    loadEmailJSSDK() {
    return new Promise((resolve, reject) => {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(this.EMAILJS_PUBLIC_KEY);
            resolve();
            return;
        }

        // ✅ Load EmailJS from your own domain (no CSP violations)
        const script = document.createElement('script');
        script.src = '/js/email.min.js'; // Host this file locally in /frontend/js/
        script.onload = () => {
            console.log('🔥 EmailJS SDK loaded locally, initializing...');
            try {
                emailjs.init(this.EMAILJS_PUBLIC_KEY);
                resolve();
            } catch (err) {
                reject(err);
            }
        };
        script.onerror = () => reject(new Error('Failed to load local EmailJS SDK'));
        document.head.appendChild(script);
    });
}


    async handleSubmit(e) {
        e.preventDefault();
        
        if (this.isSubmitting) {
            console.log('⏳ Already submitting, please wait...');
            return;
        }

        const submitBtn = this.form.querySelector('.submit-btn');
        const originalText = submitBtn.innerHTML;
        
        const formData = {
            name: document.getElementById('name').value.trim(),
            email: document.getElementById('email').value.trim(),
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value.trim(),
            timestamp: new Date().toLocaleString(),
            page: window.location.href
        };

        console.log('📤 Form data prepared:', formData);

        if (this.validateForm(formData)) {
            this.isSubmitting = true;
            
            // Show loading state
            submitBtn.innerHTML = '⏳ Sending...';
            submitBtn.disabled = true;

            try {
                console.log('🚀 Sending email via EmailJS...');
                
                // Send email using EmailJS
                const response = await emailjs.send(
                    this.EMAILJS_SERVICE_ID,
                    this.EMAILJS_TEMPLATE_ID,
                    formData
                );
                
                console.log('✅ Email sent successfully! Response:', response);
                this.showSuccessMessage();
                this.clearSavedFormData();
                this.form.reset();
                
                // Remove focused classes
                document.querySelectorAll('.form-group').forEach(group => {
                    group.classList.remove('focused');
                });

            } catch (error) {
                console.error('❌ Email sending failed:', error);
                
                // Show appropriate error message
                if (error.text && error.text.includes('Invalid template ID')) {
                    this.showError('Configuration error. Please check template settings.');
                } else if (error.text && error.text.includes('Invalid service ID')) {
                    this.showError('Configuration error. Please check service settings.');
                } else {
                    this.showError('Sorry, there was an error sending your message. Please try again or email us directly at hello@lovculator.com');
                }
                
            } finally {
                // Reset button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                this.isSubmitting = false;
            }
        }
    }

    validateForm(data) {
        this.removeExistingMessages();

        const errors = [];

        if (!data.name) {
            errors.push('Please enter your name');
        } else if (data.name.length < 2) {
            errors.push('Name must be at least 2 characters long');
        }

        if (!data.email) {
            errors.push('Please enter your email address');
        } else if (!this.isValidEmail(data.email)) {
            errors.push('Please enter a valid email address');
        }

        if (!data.subject) {
            errors.push('Please select a subject');
        }

        if (!data.message) {
            errors.push('Please enter your message');
        } else if (data.message.length < 10) {
            errors.push('Message must be at least 10 characters long');
        } else if (data.message.length > 1000) {
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
        
        this.form.insertBefore(errorDiv, this.form.firstChild);
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
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
        
        this.form.insertBefore(errorDiv, this.form.firstChild);
        
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
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
        
        successDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
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

    addInputAnimations() {
        const inputs = document.querySelectorAll('.form-group input, .form-group textarea, .form-group select');
        
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                input.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', () => {
                if (!input.value) {
                    input.parentElement.classList.remove('focused');
                }
            });

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
            
            if (count > 800) counter.style.color = '#ff6b6b';
            else if (count > 600) counter.style.color = '#ffa500';
            else counter.style.color = '#8e8e8e';
            
            if (count > 1000) {
                textarea.value = textarea.value.substring(0, 1000);
                counter.textContent = '1000/1000 characters (maximum reached)';
                counter.style.color = '#ff4757';
            }
        };
        
        textarea.addEventListener('input', updateCounter);
        updateCounter();
    }

    setupAutoSave() {
        const inputs = this.form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('input', () => {
                this.saveFormData();
            });
        });

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
                
                this.form.querySelectorAll('input, textarea, select').forEach(input => {
                    if (input.value) {
                        input.dispatchEvent(new Event('input'));
                        input.parentElement.classList.add('focused');
                    }
                });

                this.showDraftNotification();
            }
        } catch (error) {
            console.log('No saved form data found');
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
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    clearSavedFormData() {
        localStorage.removeItem('contactFormDraft');
    }
}

// Initialize contact form when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    new ContactForm();
});