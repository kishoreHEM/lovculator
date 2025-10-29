// FAQ System - SIMPLE & RELIABLE VERSION
document.addEventListener('DOMContentLoaded', function() {
    console.log('💖 FAQ System Initialized');
    
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        const icon = item.querySelector('.faq-icon');
        
        // Set initial state
        question.setAttribute('aria-expanded', 'false');
        answer.setAttribute('aria-hidden', 'true');
        
        // Click event
        question.addEventListener('click', function() {
            toggleFAQ(item, question, answer, icon);
        });
        
        // Keyboard navigation
        question.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleFAQ(item, question, answer, icon);
            }
        });
    });
    
    function toggleFAQ(item, question, answer, icon) {
        const isExpanded = question.getAttribute('aria-expanded') === 'true';
        
        // Close all other FAQs when opening a new one
        if (!isExpanded) {
            closeAllFAQs();
        }
        
        // Toggle current FAQ
        if (!isExpanded) {
            // Open FAQ
            question.setAttribute('aria-expanded', 'true');
            answer.setAttribute('aria-hidden', 'false');
            item.classList.add('active');
            if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
            // Close FAQ
            question.setAttribute('aria-expanded', 'false');
            answer.setAttribute('aria-hidden', 'true');
            item.classList.remove('active');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    }
    
    function closeAllFAQs() {
        document.querySelectorAll('.faq-item').forEach(otherItem => {
            const otherQuestion = otherItem.querySelector('.faq-question');
            const otherAnswer = otherItem.querySelector('.faq-answer');
            const otherIcon = otherItem.querySelector('.faq-icon');
            
            otherQuestion.setAttribute('aria-expanded', 'false');
            otherAnswer.setAttribute('aria-hidden', 'true');
            otherItem.classList.remove('active');
            if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
        });
    }
});