// Add to your routes
router.post('/test-emailjs', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }
    
    const testToken = 'test-' + Date.now();
    const sent = await sendVerificationEmail(email, testToken, 'TestUser');
    
    if (sent) {
      res.json({ 
        success: true, 
        message: 'Test email sent via EmailJS!',
        token: testToken // For testing
      });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});