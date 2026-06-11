const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

supabase.auth.onAuthStateChange((event, session) => {
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