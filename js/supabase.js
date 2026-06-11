// We use 'if (!window.supabaseClient)' to ensure we don't crash if this runs twice
if (!window.supabaseClient) {
    try {
        window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Set up Auth Listener
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                App.user = session.user;
                App.loadProfile();
            } else {
                App.user = null;
                document.getElementById('view-dashboard').classList.add('hidden');
                document.getElementById('view-admin').classList.add('hidden');
                document.getElementById('view-employee').classList.add('hidden');
                document.getElementById('view-login').classList.remove('hidden');
                App.updateNav(false);
            }
        });
    } catch (error) {
        console.error("Supabase Init Error:", error);
    }
}

// Assign global 'supabase' for easy access in other files
const supabase = window.supabaseClient;