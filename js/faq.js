// FAQ functionality
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
            answer.style.display = 'block';
            item.classList.add('active');
            icon.style.transform = 'rotate(180deg)';
            
            // Smooth height animation
            this.slideDown(answer);
        } else {
            // Close
            this.slideUp(answer, () => {
                answer.style.display = 'none';
            });
            item.classList.remove('active');
            icon.style.transform = 'rotate(0deg)';
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
                    otherAnswer.style.display = 'none';
                });
                otherItem.classList.remove('active');
                otherIcon.style.transform = 'rotate(0deg)';
            }
        });
    }

    slideDown(element) {
        element.style.height = 'auto';
        const height = element.offsetHeight;
        element.style.height = '0px';
        element.offsetHeight; // Trigger reflow
        
        requestAnimationFrame(() => {
            element.style.height = height + 'px';
            
            const onTransitionEnd = () => {
                element.style.height = 'auto';
                element.removeEventListener('transitionend', onTransitionEnd);
            };
            
            element.addEventListener('transitionend', onTransitionEnd);
        });
    }

    slideUp(element, callback) {
        const height = element.offsetHeight;
        element.style.height = height + 'px';
        element.offsetHeight; // Trigger reflow
        
        requestAnimationFrame(() => {
            element.style.height = '0px';
            
            const onTransitionEnd = () => {
                if (callback) callback();
                element.removeEventListener('transitionend', onTransitionEnd);
            };
            
            element.addEventListener('transitionend', onTransitionEnd);
        });
    }
}

// Initialize FAQ when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.faqManager = new FAQManager();
});