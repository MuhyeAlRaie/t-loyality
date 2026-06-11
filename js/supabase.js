// We do NOT use 'const' here because the library already defines 'supabase' globally.
// We simply reassign it to our client instance.

if (!window.supabaseClient) {
    try {
        // Check if the library loaded successfully
        if (typeof supabase === 'undefined') {
            console.error("Supabase library not loaded!");
        } else {
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
        }
    } catch (error) {
        console.error("Supabase Init Error:", error);
    }
}

// Make the client accessible globally as 'supabase'
const supabase = window.supabaseClient;