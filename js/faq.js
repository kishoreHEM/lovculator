// FAQ functionality - FIXED VERSION
class FAQManager {
    constructor() {
        this.faqItems = document.querySelectorAll('.faq-item');
        this.init();
    }

    init() {
        this.faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            const answer = item.querySelector('.faq-answer');
            const icon = item.querySelector('.faq-icon');

            // Set initial ARIA attributes
            question.setAttribute('aria-expanded', 'false');
            answer.style.display = 'none';

            // Add click event
            question.addEventListener('click', () => {
                this.toggleFAQ(item, question, answer, icon);
            });

            // Add keyboard support
            question.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleFAQ(item, question, answer, icon);
                }
            });
        });

        console.log('✅ FAQ system initialized');
    }

    toggleFAQ(item, question, answer, icon) {
        const isExpanded = question.getAttribute('aria-expanded') === 'true';
        
        // Close all other FAQs
        if (!isExpanded) {
            this.closeAllFAQs();
        }

        // Toggle current FAQ
        question.setAttribute('aria-expanded', !isExpanded);
        
        if (!isExpanded) {
            // Open
            this.slideDown(answer, () => {
                item.classList.add('active');
                icon.style.transform = 'rotate(180deg)';
            });
        } else {
            // Close
            this.slideUp(answer, () => {
                item.classList.remove('active');
                icon.style.transform = 'rotate(0deg)';
            });
        }
    }

    closeAllFAQs() {
        this.faqItems.forEach(otherItem => {
            const otherQuestion = otherItem.querySelector('.faq-question');
            const otherAnswer = otherItem.querySelector('.faq-answer');
            const otherIcon = otherItem.querySelector('.faq-icon');
            
            if (otherQuestion.getAttribute('aria-expanded') === 'true') {
                otherQuestion.setAttribute('aria-expanded', 'false');
                this.slideUp(otherAnswer, () => {
                    otherItem.classList.remove('active');
                    otherIcon.style.transform = 'rotate(0deg)';
                });
            }
        });
    }

    slideDown(element, callback) {
        // First show the element but make it invisible
        element.style.display = 'block';
        element.style.height = '0px';
        element.style.overflow = 'hidden';
        
        // Get the natural height
        const height = element.scrollHeight;
        
        // Use requestAnimationFrame for smooth animation
        requestAnimationFrame(() => {
            element.style.transition = 'height 0.3s ease';
            element.style.height = height + 'px';
            
            const onTransitionEnd = () => {
                element.style.height = 'auto';
                element.style.overflow = 'visible';
                element.style.transition = '';
                element.removeEventListener('transitionend', onTransitionEnd);
                if (callback) callback();
            };
            
            element.addEventListener('transitionend', onTransitionEnd);
        });
    }

    slideUp(element, callback) {
        // Get current height
        const height = element.scrollHeight;
        
        // Set fixed height before animation
        element.style.height = height + 'px';
        element.style.overflow = 'hidden';
        
        // Use requestAnimationFrame for smooth animation
        requestAnimationFrame(() => {
            element.style.transition = 'height 0.3s ease';
            element.style.height = '0px';
            
            const onTransitionEnd = () => {
                element.style.display = 'none';
                element.style.height = '';
                element.style.overflow = '';
                element.style.transition = '';
                element.removeEventListener('transitionend', onTransitionEnd);
                if (callback) callback();
            };
            
            element.addEventListener('transitionend', onTransitionEnd);
        });
    }
}

// Initialize FAQ when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.faqManager = new FAQManager();
});