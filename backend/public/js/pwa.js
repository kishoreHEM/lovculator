// js/pwa.js

let deferredInstallPrompt = null;

// Get the elements for the custom prompt
const installPrompt = document.getElementById('installPrompt');
const installBtn = document.getElementById('installBtn');
const cancelInstall = document.getElementById('cancelInstall');


/**
 * 1. Captures the browser's beforeinstallprompt event.
 * This event fires when the browser determines the app is installable.
 * It prevents the browser's default prompt and stores the event.
 */
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('beforeinstallprompt event fired.');
    // Prevent the default browser prompt from showing
    e.preventDefault(); 
    
    // Stash the event so we can trigger it later
    deferredInstallPrompt = e;
    
    // Show your custom install button/notification
    if (installPrompt) {
        installPrompt.classList.remove('hidden');
        installPrompt.setAttribute('aria-hidden', 'false');
    }
});


/**
 * 2. Handles the click on your custom 'Install' button.
 * Triggers the native browser install prompt using the deferred event.
 */
if (installBtn) {
    installBtn.addEventListener('click', () => {
        if (deferredInstallPrompt) {
            // 1. Hide your custom UI immediately
            if (installPrompt) {
                installPrompt.classList.add('hidden');
                installPrompt.setAttribute('aria-hidden', 'true');
            }
            
            // 2. Show the native browser prompt
            deferredInstallPrompt.prompt();
            
            // 3. Optional: Monitor the user's choice
            deferredInstallPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                }
                // Reset the deferred event so it can fire again later if needed
                deferredInstallPrompt = null;
            });
        }
    });
}


/**
 * 3. Handles the 'Not Now' button click.
 * Hides your custom prompt.
 */
if (cancelInstall) {
    cancelInstall.addEventListener('click', () => {
        if (installPrompt) {
            installPrompt.classList.add('hidden');
            installPrompt.setAttribute('aria-hidden', 'true');
        }
        // Optionally, set a cookie or localStorage item to hide the prompt for a few days
    });
}


/**
 * 4. Listens for the app being successfully installed.
 */
window.addEventListener('appinstalled', () => {
    // The app was successfully installed, ensure the prompt is hidden
    if (installPrompt) {
        installPrompt.classList.add('hidden');
        installPrompt.setAttribute('aria-hidden', 'true');
    }
    console.log('🎉 PWA installed successfully!');
});