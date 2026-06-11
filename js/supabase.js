// We use a different name 'supabaseClient' to avoid conflict with the library 'supabase'
if (!window._supabaseClientInitialized) {
    try {
        const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Set up Auth Listener
        client.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                window.App.user = session.user;
                window.App.loadProfile();
            } else {
                window.App.user = null;
                document.getElementById('view-dashboard').classList.add('hidden');
                document.getElementById('view-admin').classList.add('hidden');
                document.getElementById('view-employee').classList.add('hidden');
                document.getElementById('view-login').classList.remove('hidden');
                window.App.updateNav(false);
            }
        });

        // Save to window so it persists
        window._supabaseClientInstance = client;
        window._supabaseClientInitialized = true;

    } catch (error) {
        console.error("Supabase Init Error:", error);
    }
}

// Assign to local variable for use in other files
const supabaseClient = window._supabaseClientInstance;