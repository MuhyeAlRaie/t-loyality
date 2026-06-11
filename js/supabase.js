if (!window._supabaseClientInitialized) {
    try {
        const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Set up Auth Listener
        client.auth.onAuthStateChange((event, session) => {
            // ONLY run this code if App.js has loaded successfully
            if (typeof window.App !== 'undefined') {
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
            }
        });

        window._supabaseClientInstance = client;
        window._supabaseClientInitialized = true;

    } catch (error) {
        console.error("Supabase Init Error:", error);
    }
}

const supabaseClient = window._supabaseClientInstance;