// anon-tracker.js
class AnonUserTracker {
    static init() {
        try {
            const storedId = localStorage.getItem("anonUserId");
            if (!storedId) {
                const newId = "anon_" + Math.random().toString(36).substr(2, 9);
                localStorage.setItem("anonUserId", newId);
            }
        } catch (error) {
            console.error("AnonUserTracker Error:", error);
        }
    }

    static getId() {
        return localStorage.getItem("anonUserId");
    }
}

window.AnonUserTracker = AnonUserTracker;
console.log("✔ AnonUserTracker Loaded");
