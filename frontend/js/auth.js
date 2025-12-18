// ✅ Correct Global API Base Definition
window.ROOT_API_BASE = window.location.hostname.includes("localhost")
  ? "http://localhost:3001/api"
  : "https://lovculator.com/api";

// API_BASE specific to this file uses the root path:
const AUTH_API_BASE = `${window.ROOT_API_BASE}/auth`;

console.log(`🌍 Using Auth API Base URL: ${AUTH_API_BASE}`);

// =======================================
// 🧩 Utility Functions
// =======================================
function showMessage(text, type = "info") {
  const msgBox = document.getElementById("error-message");
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.style.color =
    type === "error" ? "red" : type === "success" ? "green" : "#555";
  msgBox.style.opacity = "1";
  setTimeout(() => {
    msgBox.style.transition = "opacity 0.5s ease-out";
    msgBox.style.opacity = "0";
  }, 4000);
}

// Enhanced showMessage with HTML support
function showMessageHTML(html, type = "info") {
  const msgBox = document.getElementById("error-message");
  if (!msgBox) return;
  msgBox.innerHTML = html;
  msgBox.style.color = type === "error" ? "red" : type === "success" ? "green" : "#555";
  msgBox.style.opacity = "1";
  setTimeout(() => {
    msgBox.style.transition = "opacity 0.5s ease-out";
    msgBox.style.opacity = "0";
  }, 5000);
}

async function safeParseResponse(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: "Invalid server response" };
  }
}

function toggleLoading(btn, isLoading, text = "Please wait...") {
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = `<span class="spinner" style="
      display:inline-block;width:14px;height:14px;
      border:2px solid white;border-top:2px solid transparent;
      border-radius:50%;animation:spin 0.8s linear infinite;
      vertical-align:middle;margin-right:6px;"></span>${text}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || "Submit";
  }
}

const style = document.createElement("style");
style.textContent = `
@keyframes spin { from {transform:rotate(0deg);} to {transform:rotate(360deg);} }
`;
document.head.appendChild(style);

// =======================================
// 🚀 AUTH MANAGER CLASS (Enhanced with Email Verification)
// =======================================
class AuthManager {
  // All methods must now use AUTH_API_BASE
  static async signup(firstName, lastName, email, password) {
  const res = await fetch(`${AUTH_API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ firstName, lastName, email, password }),
  });

  return safeParseResponse(res).then((data) => ({ res, data }));
}


  static async login(email, password) {
    const res = await fetch(`${AUTH_API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async getProfile() {
    const res = await fetch(`${AUTH_API_BASE}/me`, {
      method: "GET",
      credentials: "include",
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async logout() {
    const res = await fetch(`${AUTH_API_BASE}/logout`, {
      method: "POST",
      credentials: "include",
    });
    return safeParseResponse(res);
  }
  
  static async forgotPassword(email) {
    const res = await fetch(`${AUTH_API_BASE}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async resetPassword(token, newPassword) {
    const res = await fetch(`${AUTH_API_BASE}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  // =======================================
  // 📧 EMAIL VERIFICATION METHODS
  // =======================================
  static async sendVerificationEmail() {
    const res = await fetch(`${AUTH_API_BASE}/send-verification`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async verifyEmail(token) {
    const res = await fetch(`${AUTH_API_BASE}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async checkVerificationStatus() {
    const res = await fetch(`${AUTH_API_BASE}/verification-status`, {
      method: "GET",
      credentials: "include",
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }

  static async resendVerificationEmail() {
    const res = await fetch(`${AUTH_API_BASE}/resend-verification`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return safeParseResponse(res).then((data) => ({ res, data }));
  }
}

window.AuthManager = AuthManager;

// =======================================
// 📧 EMAIL VERIFICATION UI FUNCTIONS
// =======================================
function showVerificationModal(userData) {
  // Remove any existing modal
  const existingModal = document.querySelector('.verification-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'verification-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <button class="modal-close">&times;</button>
      <div class="modal-icon">📧</div>
      <h3>📧 Verify Your Email</h3>
      <p>A verification link has been sent to <strong>${userData.email}</strong></p>
      <p>Please check your inbox and click the link to verify your account.</p>
      
      <div class="verification-actions">
        <button class="btn btn-primary" id="resend-verification-btn">
          Resend Verification Email
        </button>
        <button class="btn btn-secondary" id="close-verification-btn">
          I'll Verify Later
        </button>
      </div>
      
      <div class="verification-info">
        <p><small>Didn't receive the email? Check your spam folder or <a href="#" id="contact-support">contact support</a>.</small></p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  
  // Add styles if not already added
  addVerificationModalStyles();
  
  // Show modal with animation
  setTimeout(() => modal.classList.add('show'), 10);

  // Event listeners
  modal.querySelector('.modal-close').onclick = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('.modal-overlay').onclick = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  };

  modal.querySelector('#resend-verification-btn').onclick = async () => {
    const btn = modal.querySelector('#resend-verification-btn');
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span>Sending...';
    btn.disabled = true;

    try {
      const { res, data } = await AuthManager.resendVerificationEmail();
      if (res.ok) {
        showMessage('✅ Verification email resent! Check your inbox.', 'success');
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
      } else {
        showMessage(data.error || 'Failed to resend email', 'error');
        btn.textContent = originalText;
        btn.disabled = false;
      }
    } catch (error) {
      showMessage('🚫 Network error', 'error');
      btn.textContent = originalText;
      btn.disabled = false;
    }
  };

  modal.querySelector('#close-verification-btn').onclick = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
    showMessage('⚠️ Remember to verify your email soon for full access!', 'info');
  };

  modal.querySelector('#contact-support').onclick = (e) => {
    e.preventDefault();
    window.location.href = '/contact';
  };
}

function addVerificationModalStyles() {
  if (document.querySelector('#verification-modal-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'verification-modal-styles';
  styles.textContent = `
    .verification-modal {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0);
      opacity: 0;
      transition: background 0.3s ease, opacity 0.3s ease;
      z-index: 10000;
    }
    
    .verification-modal.show {
      background: rgba(0,0,0,0.5);
      opacity: 1;
    }
    
    .modal-overlay {
      position: absolute;
      inset: 0;
    }
    
    .modal-content {
      position: relative;
      background: white;
      padding: 30px;
      border-radius: 15px;
      text-align: center;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      transform: translateY(40px) scale(0.95);
      opacity: 0;
      transition: transform 0.4s ease-out, opacity 0.4s ease-out;
    }
    
    .verification-modal.show .modal-content {
      transform: translateY(0) scale(1);
      opacity: 1;
    }
    
    .modal-icon {
      font-size: 50px;
      margin-bottom: 20px;
    }
    
    .modal-close {
      position: absolute;
      top: 15px;
      right: 15px;
      border: none;
      background: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      transition: color 0.2s;
    }
    
    .modal-close:hover {
      color: #ff4b8d;
    }
    
    .verification-actions {
      display: flex;
      gap: 15px;
      justify-content: center;
      margin: 25px 0 15px;
    }
    
    .verification-actions .btn {
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, opacity 0.2s;
    }
    
    .verification-actions .btn:hover {
      transform: translateY(-2px);
    }
    
    .btn-primary {
      background: linear-gradient(135deg, #ff4b8d, #ff8e53);
      color: white;
    }
    
    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }
    
    .verification-info {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #eee;
      color: #666;
    }
    
    .verification-info a {
      color: #ff4b8d;
      text-decoration: none;
    }
    
    .verification-info a:hover {
      text-decoration: underline;
    }
  `;
  
  document.head.appendChild(styles);
}

// =======================================
// 🧠 EVENT HANDLERS (All Unified)
// =======================================
document.addEventListener("DOMContentLoaded", () => {
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const forgotPasswordForm = document.getElementById("forgot-password-form");
  const resetPasswordForm = document.getElementById("reset-password-form");
  const verifyEmailForm = document.getElementById("verify-email-form");

  // --- SIGNUP HANDLER (First/Last Name, DOB, Gender, Email, Password) ---
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = signupForm.querySelector(".btn-submit");

    const firstNameInput = document.getElementById("firstName");
    const lastNameInput = document.getElementById("lastName");
    const dobInput = document.getElementById("dob");
    const genderInput = document.getElementById("gender");

    if (!firstNameInput || !lastNameInput || !dobInput || !genderInput) {
      console.warn("⚠️ Signup page mismatch — fields missing");
      return;
    }

    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const dob = dobInput.value.trim();
    const gender = genderInput.value.trim();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!firstName || !lastName || !dob || !gender || !email || !password) {
      return showMessage("⚠️ All fields required!", "error");
    }

    if (password.length < 6) {
      return showMessage("⚠️ Password must be 6+ chars", "error");
    }

    if (!email.includes("@")) {
      return showMessage("⚠️ Valid email required", "error");
    }

    toggleLoading(btn, true, "Creating account...");

    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        dob,
        gender,
        email,
        password,
      };

      console.log("📌 Sending signup:", payload);

      const { res, data } = await fetch(`${AUTH_API_BASE}/signup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (res) => ({
        res,
        data: await safeParseResponse(res),
      }));

      if (res.ok) {
        if (data.needs_verification) {
          showVerificationModal({ email, username: data.user?.username });

          showMessageHTML(
            `🎉 Account created! <br> 📬 Please verify your email (${email})`,
            "success"
          );

          setTimeout(() => {
            // ✅ FIX: Use clean URL directly
            window.location.href =
              "/verify-pending?email=" + encodeURIComponent(email);
          }, 5000);
        } else {
          showMessage("🎉 Signup successful! Redirecting...", "success");
          setTimeout(() => (window.location.href = "/profile"), 1200);
        }
      } else {
        showMessage(data.error || "Signup failed", "error");
      }
    } catch (err) {
      console.error("Signup error:", err);
      showMessage("🚫 Cannot reach server.", "error");
    } finally {
      toggleLoading(btn, false);
    }
  });
}

  // --- LOGIN HANDLER (Updated with email verification check) ---
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector(".btn-submit");
      const identifier = document.getElementById("username-or-email").value.trim();
      const password = document.getElementById("password").value.trim();

      if (!identifier || !password)
        return showMessage("⚠️ Please enter both fields.", "error");

      toggleLoading(btn, true, "Logging In...");

      try {
        const { res, data } = await AuthManager.login(identifier, password);
        
        if (res.ok) {
          // Check if email needs verification
          if (data.needs_verification || data.verification_required) {
            // User exists but email not verified
            showVerificationModal({
              email: data.user?.email || identifier,
              username: data.user?.username || identifier
            });
            
            showMessageHTML(
              `⚠️ <strong>Email verification required.</strong> Please check your inbox for the verification link.`,
              "info"
            );
            
          } else if (data.email_verified === false) {
            // Email not verified but in grace period
            showMessage(
              `✅ Login successful! ⚠️ Please verify your email within ${data.days_left || 'a few'} days for full access.`,
              "success"
            );
            
            setTimeout(() => {
              window.location.href = "/profile";
            }, 1500);
            
          } else {
            // Fully verified - proceed normally
            showMessage("✅ Login successful! Redirecting...", "success");
            setTimeout(() => {
              window.location.href = "/profile";
            }, 1200);
          }
        } else {
          // Handle error responses
          if (res.status === 403 && data.needs_verification) {
            // Specific case: verification required
            showVerificationModal({
              email: identifier.includes('@') ? identifier : '',
              username: identifier.includes('@') ? '' : identifier
            });
            
            showMessageHTML(
              `<strong>Email verification required.</strong> Please verify your email to log in.`,
              "error"
            );
          } else {
            // General error
            const errorMessage = data.error || data.message || "❌ Invalid credentials.";
            showMessage(errorMessage, "error");
          }
        }
      } catch (err) {
        console.error("Login error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
      } finally {
        toggleLoading(btn, false);
      }
    });
  }

  // --- FORGOT PASSWORD HANDLER ---
  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = forgotPasswordForm.querySelector(".btn-submit");
      const email = document.getElementById("email").value.trim();

      if (!email || !email.includes('@')) {
        return showMessage("⚠️ Please enter a valid email address.", "error");
      }

      toggleLoading(btn, true, "Sending...");

      try {
        const { res, data } = await AuthManager.forgotPassword(email);
        
        if (res.ok) {
          showMessage(
            "✅ If that email exists, a password reset link has been sent!", 
            "success"
          );
          // Clear form
          document.getElementById("email").value = "";
        } else {
          // Still show success for security
          showMessage(
            "✅ If that email exists, a password reset link has been sent!", 
            "success"
          );
          document.getElementById("email").value = "";
        }
      } catch (err) {
        console.error("Forgot Password error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
      } finally {
        toggleLoading(btn, false);
      }
    });
  }

  // --- RESET PASSWORD HANDLER ---
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = resetPasswordForm.querySelector(".btn-submit");
      const token = document.getElementById("reset-token").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      if (newPassword.length < 6) return showMessage("⚠️ Password must be at least 6 characters.", "error");
      if (newPassword !== confirmPassword) return showMessage("⚠️ Passwords do not match.", "error");
      
      toggleLoading(btn, true, "Resetting...");

      try {
        const { res, data } = await AuthManager.resetPassword(token, newPassword);
        if (res.ok) {
          showMessage("✅ Password reset successful! Redirecting to login...", "success");
          setTimeout(() => (window.location.href = "/login"), 1500);
        } else {
          showMessage(data.error || "❌ Reset failed. The link may have expired.", "error");
        }
      } catch (err) {
        console.error("Reset Password error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
      } finally {
        toggleLoading(btn, false);
      }
    });
  }

  // --- VERIFY EMAIL HANDLER (for verify-email.html) ---
  if (verifyEmailForm) {
    // Check if token is in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // Auto-submit if token present
      document.getElementById("verification-token").value = token;
      verifyEmailForm.dispatchEvent(new Event('submit'));
    }
    
    verifyEmailForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = verifyEmailForm.querySelector(".btn-submit");
      const token = document.getElementById("verification-token").value;
      
      if (!token) {
        return showMessage("⚠️ No verification token provided.", "error");
      }
      
      toggleLoading(btn, true, "Verifying...");
      
      try {
        const { res, data } = await AuthManager.verifyEmail(token);
        if (res.ok) {
          showMessage("✅ Email verified successfully! Redirecting to login...", "success");
          setTimeout(() => {
            window.location.href = "/login?verified=true";
          }, 2000);
        } else {
          showMessage(data.error || "❌ Verification failed. The link may have expired.", "error");
          
          // Show resend option if token expired
          if (data.error && data.error.includes('expired')) {
            const resendBtn = document.createElement('button');
            resendBtn.textContent = 'Resend Verification Email';
            resendBtn.className = 'btn btn-secondary';
            resendBtn.style.marginTop = '10px';
            resendBtn.onclick = async () => {
              try {
                const { res: resendRes } = await AuthManager.resendVerificationEmail();
                if (resendRes.ok) {
                  showMessage('✅ New verification email sent!', 'success');
                }
              } catch (err) {
                showMessage('Failed to resend email', 'error');
              }
            };
            
            const messageBox = document.getElementById("error-message");
            if (messageBox) {
              messageBox.appendChild(document.createElement('br'));
              messageBox.appendChild(resendBtn);
            }
          }
        }
      } catch (err) {
        console.error("Verify Email error:", err);
        showMessage("🚫 Network error or server unreachable.", "error");
      } finally {
        toggleLoading(btn, false);
      }
    });
  }
});

// =======================================
// 📧 AUTO-CHECK VERIFICATION ON PROFILE PAGE
// =======================================
if (window.location.pathname.includes('/profile')) {
  document.addEventListener('DOMContentLoaded', async () => {
    // Wait a bit for session to load
    setTimeout(async () => {
      try {
        const { res, data } = await AuthManager.checkVerificationStatus();
        if (res.ok && !data.email_verified) {
          // Show gentle reminder on profile page
          const reminder = document.createElement('div');
          reminder.className = 'verification-reminder';
          reminder.innerHTML = `
            <div class="reminder-content">
              <span class="reminder-icon">📧</span>
              <span class="reminder-text">Please verify your email for full access</span>
              <button class="reminder-btn">Resend Email</button>
              <button class="reminder-close">&times;</button>
            </div>
          `;
          
          document.body.appendChild(reminder);
          
          // Add styles
          const reminderStyles = document.createElement('style');
          reminderStyles.textContent = `
            .verification-reminder {
              position: fixed;
              top: 20px;
              right: 20px;
              background: linear-gradient(135deg, #ff4b8d, #ff8e53);
              color: white;
              padding: 15px;
              border-radius: 10px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              z-index: 9999;
              animation: slideIn 0.3s ease-out;
            }
            
            @keyframes slideIn {
              from { transform: translateX(100%); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            
            .reminder-content {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            
            .reminder-icon { font-size: 20px; }
            .reminder-text { flex-grow: 1; font-size: 14px; }
            
            .reminder-btn {
              background: rgba(255,255,255,0.2);
              border: 1px solid rgba(255,255,255,0.3);
              color: white;
              padding: 5px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
            }
            
            .reminder-btn:hover {
              background: rgba(255,255,255,0.3);
            }
            
            .reminder-close {
              background: none;
              border: none;
              color: white;
              font-size: 18px;
              cursor: pointer;
              padding: 0;
              line-height: 1;
            }
          `;
          document.head.appendChild(reminderStyles);
          
          // Event listeners
          reminder.querySelector('.reminder-btn').onclick = async () => {
            try {
              const { res } = await AuthManager.resendVerificationEmail();
              if (res.ok) {
                alert('✅ New verification email sent!');
                reminder.remove();
              }
            } catch (err) {
              alert('Failed to resend email');
            }
          };
          
          reminder.querySelector('.reminder-close').onclick = () => {
            reminder.remove();
          };
          
          // Auto-hide after 30 seconds
          setTimeout(() => {
            if (reminder.parentNode) {
              reminder.style.opacity = '0';
              reminder.style.transition = 'opacity 0.3s';
              setTimeout(() => reminder.remove(), 300);
            }
          }, 30000);
        }
      } catch (err) {
        // Silent fail - verification check is optional
      }
    }, 2000);
  });
}