const App = {
    user: null,
    profile: null,
    settings: {},

    toggleAuthView: (view) => {
        if(view === 'login') {
            document.getElementById('form-login').classList.remove('hidden');
            document.getElementById('form-signup').classList.add('hidden');
            document.getElementById('tab-login').classList.add('active');
            document.getElementById('tab-signup').classList.remove('active');
        } else {
            document.getElementById('form-login').classList.add('hidden');
            document.getElementById('form-signup').classList.remove('hidden');
            document.getElementById('tab-login').classList.remove('active');
            document.getElementById('tab-signup').classList.add('active');
        }
    },

    login: async () => {
        const phone = document.getElementById('loginPhone').value;
        const pass = document.getElementById('loginPass').value;
        if(!phone || !pass) return alert("Please fill all fields");
        const email = phone + '@loyalty.app'; 
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
        if(error) alert(error.message);
    },

    signup: async () => {
        const name = document.getElementById('regName').value;
        const phone = document.getElementById('regPhone').value;
        const pass = document.getElementById('regPass').value;
        if(!name || !phone || !pass) return alert("Please fill all fields");
        const email = phone + '@loyalty.app';
        const { data, error } = await supabaseClient.auth.signUp({ email, password: pass });
        if(error) alert(error.message);
        else if(data.user) {
            await supabaseClient.from('customers').insert([{ id: data.user.id, email, phone_number: phone, name }]);
            alert("Account Created! Please login.");
            App.toggleAuthView('login');
        }
    },

    logout: async () => { 
        await supabaseClient.auth.signOut(); 
        location.reload(); 
    },

    loadProfile: async () => {
        // We use .maybeSingle() to avoid 406/500 errors if profile missing
        const { data, error } = await supabaseClient.from('customers').select('*').eq('id', App.user.id).maybeSingle();
        if(data) {
            App.profile = data;
            document.getElementById('view-login').classList.add('hidden');
            App.updateNav(true, data.name);
            if(data.phone_number === '000000') {
                document.getElementById('view-admin').classList.remove('hidden');
                Admin.init(); // Load Admin Stats
            } else {
                document.getElementById('view-dashboard').classList.remove('hidden');
                App.loadCustomerData();
            }
        } else {
            // Profile missing? Create it or handle error
            alert("Profile setup error. Please logout and sign up again.");
        }
    },

    loadCustomerData: async () => {
        document.getElementById('dashPoints').innerText = App.profile.points_balance;
        document.getElementById('dashVisits').innerText = App.profile.total_visits;

        // 1. Load Menu
        const { data: menu } = await supabaseClient.from('menu_items').select('*');
        // We don't show menu in dashboard anymore to save space, but logic is here if needed.

        // 2. Load Rewards
        const { data: rewards } = await supabaseClient.from('rewards').select('*');
        const rContainer = document.getElementById('rewardsList');
        rContainer.innerHTML = '';
        if(rewards) {
            rewards.forEach(r => {
                const canAfford = App.profile.points_balance >= r.cost_points;
                rContainer.innerHTML += `<div class="col-md-4 col-6"><div class="card p-3 h-100"><h6>${r.title}</h6><div class="d-flex justify-content-between mt-2"><span class="badge bg-secondary">${r.cost_points} Pts</span><button class="btn btn-sm ${canAfford?'btn-primary':'btn-outline-secondary'}" onclick="App.redeem('${r.id}', ${r.cost_points})">Redeem</button></div></div></div>`;
            });
        }

        // 3. Load History (New Feature)
        const { data: visits } = await supabaseClient.from('visits').select('*').eq('customer_id', App.user.id).order('created_at', { ascending: false }).limit(5);
        const { data: games } = await supabaseClient.from('game_history').select('*').eq('customer_id', App.user.id).order('played_at', { ascending: false }).limit(5);
        
        const hList = document.getElementById('historyList');
        hList.innerHTML = '';
        
        // Combine Visits and Games into one timeline
        let timeline = [];
        if(visits) visits.forEach(v => timeline.push({ type: 'Visit', date: v.created_at, detail: `+${v.points_earned} Pts` }));
        if(games) games.forEach(g => timeline.push({ type: 'Game', date: g.played_at, detail: `Played ${g.game_type}` }));
        
        // Sort by date
        timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

        timeline.forEach(item => {
            const icon = item.type === 'Visit' ? 'fa-receipt' : 'fa-gamepad';
            const color = item.type === 'Visit' ? 'text-success' : 'text-warning';
            hList.innerHTML += `
                <li class="list-group-item bg-transparent text-white border-secondary d-flex justify-content-between align-items-center">
                    <span><i class="fas ${icon} ${color} me-2"></i> ${item.type}</span>
                    <span class="small text-muted">${new Date(item.date).toLocaleDateString()} - ${item.detail}</span>
                </li>`;
        });

        // 4. Render Missions (New Feature)
        App.renderMissions();

        // 5. Game Cooldowns
        Games.checkCooldowns();
    },

    renderMissions: () => {
        // Fetch settings to get mission target
        const target = App.settings['mission_target_visits'] || 5;
        document.getElementById('missionTarget').innerText = target;
        
        const current = App.profile.total_visits || 0;
        const percentage = Math.min((current / target) * 100, 100);
        
        const bar = document.getElementById('missionProgress');
        bar.style.width = percentage + '%';
        bar.innerText = percentage + '%';
        
        if(percentage >= 100) {
            bar.classList.remove('bg-success');
            bar.classList.add('bg-warning');
            bar.innerText = "Mission Complete!";
        }
    },

    redeem: async (rid, cost) => {
        if(!confirm("Redeem this reward?")) return;
        const newBal = App.profile.points_balance - cost;
        const { error } = await supabaseClient.from('customers').update({ points_balance: newBal }).eq('id', App.user.id);
        if(!error) { 
            alert("Reward Redeemed!"); 
            App.loadCustomerData(); 
        } else {
            alert("Error redeeming.");
        }
    },

    findCustomer: async () => {
        const phone = document.getElementById('empPhone').value;
        const { data } = await supabaseClient.from('customers').select('*').eq('phone_number', phone).maybeSingle();
        if(data) {
            document.getElementById('empResult').classList.remove('hidden');
            document.getElementById('empCustName').innerText = data.name;
            document.getElementById('empCustPoints').innerText = data.points_balance;
            App.empTarget = data;
        } else { 
            alert("Customer not found"); 
        }
    },

    addVisit: async () => {
        const amount = parseFloat(document.getElementById('empAmount').value);
        if(!amount) return;
        const rate = App.settings['points_per_jod'] || 1;
        const points = Math.floor(amount);
        await supabaseClient.from('customers').update({ 
            points_balance: App.empTarget.points_balance + points, 
            total_visits: App.empTarget.total_visits + 1 
        }).eq('id', App.empTarget.id);
        await supabaseClient.from('visits').insert([{ 
            customer_id: App.empTarget.id, 
            invoice_amount: amount, 
            points_earned: points 
        }]);
        alert(`Visit Added! +${points} Points`);
        App.findCustomer();
        document.getElementById('empAmount').value = '';
    },

    updateNav: (isLoggedIn, name) => {
        if(isLoggedIn) {
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('userSection').classList.remove('hidden');
            document.getElementById('userNameDisplay').innerText = name;
        } else {
            document.getElementById('authSection').classList.remove('hidden');
            document.getElementById('userSection').classList.add('hidden');
        }
    }
};

const Games = {
    loop: null, score: 0,
    
    checkCooldowns: async () => {
        const types = [
            { id: 'burger', days: 7, cardId: 'card-weekly-1' },
            { id: 'coffee', days: 7, cardId: 'card-weekly-2' },
            { id: 'wheel', days: 30, cardId: 'card-monthly' }
        ];

        for(let t of types) {
            const { data } = await supabaseClient
                .from('game_history')
                .select('played_at')
                .eq('customer_id', App.user.id)
                .eq('game_type', t.id)
                .order('played_at', { ascending: false })
                .limit(1);

            const badge = document.getElementById(`timer-${t.id}`);
            const card = document.getElementById(t.cardId);
            
            if(data && data.length > 0) {
                const lastPlay = new Date(data[0].played_at);
                const now = new Date();
                const diffDays = Math.floor((now - lastPlay) / (1000 * 60 * 60 * 24));
                
                if(diffDays < t.days) {
                    const remaining = t.days - diffDays;
                    badge.innerText = `Wait ${remaining} Days`;
                    badge.className = "badge bg-danger";
                    card.classList.add('disabled');
                    const clone = card.cloneNode(true);
                    card.parentNode.replaceChild(clone, card);
                } else {
                    badge.innerText = "PLAY NOW";
                    badge.className = "badge bg-success";
                    card.classList.remove('disabled');
                    card.onclick = () => Games.play(t.id);
                }
            } else {
                badge.innerText = "PLAY NOW";
                badge.className = "badge bg-success";
            }
        }
    },

    play: async (type) => {
        const modal = new bootstrap.Modal(document.getElementById('gameModal'));
        modal.show();
        document.getElementById('gameTitle').innerText = type.toUpperCase();
        
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        let player = { x: 130, y: 350, w: 50, h: 50 };
        let items = [];
        let frame = 0;
        Games.score = 0;
        
        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            player.x = e.clientX - rect.left - 25;
        };
        
        const update = () => {
            ctx.clearRect(0,0,320,400);
            frame++;
            
            if(type === 'wheel') {
                ctx.save(); ctx.translate(160, 200); ctx.rotate(frame * 0.1);
                ctx.beginPath(); ctx.arc(0,0,100,0,2*Math.PI); ctx.fillStyle='#333'; ctx.fill();
                ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,100,0,1.57); ctx.fill();
                ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,100,1.57,3.14); ctx.fill();
                ctx.restore();
                if(frame > 150) { Games.score = Math.floor(Math.random() * 500) + 50; Games.endGame(modal, type); return; }
            } else {
                ctx.fillStyle = '#667eea'; ctx.fillRect(player.x, player.y, player.w, player.h);
                ctx.font="30px Arial"; ctx.fillText(type==='burger'?'🧺':'☕', player.x, player.y+40);
                if(frame % 40 === 0) items.push({ x: Math.random()*280, y: type==='burger'?-40:400, val: Math.random() > 0.3 ? 10 : -5 });
                for(let i=0; i<items.length; i++) {
                    let it = items[i];
                    it.y += type==='burger' ? 4 : -4;
                    ctx.font = "25px Arial"; ctx.fillText(it.val > 0 ? '🍔' : '💣', it.x, it.y);
                    if(type==='burger' && it.y > 350 && Math.abs(it.x - player.x) < 40) { Games.score += it.val; items.splice(i, 1); i--; }
                    else if((type==='burger' && it.y > 400) || (type==='coffee' && it.y < 0)) { items.splice(i, 1); i--; }
                }
                if(frame > 600) { Games.endGame(modal, type); return; }
            }
            document.getElementById('gameScore').innerText = 'Score: ' + Games.score;
            Games.loop = requestAnimationFrame(update);
        };
        Games.loop = requestAnimationFrame(update);
    },

    endGame: async (modal, type) => {
        Games.stop();
        modal.hide();
        if(Games.score > 0) {
            const winBal = App.profile.points_balance + Games.score;
            await supabaseClient.from('customers').update({points_balance: winBal}).eq('id', App.user.id);
            App.profile.points_balance = winBal;
            alert(`You Won ${Games.score} Points!`);
        } else alert("Better luck next time!");
        await supabaseClient.from('game_history').insert([{ customer_id: App.user.id, game_type: type }]);
        App.loadCustomerData();
    }, stop: () => { if(Games.loop) cancelAnimationFrame(Games.loop); }
};

const Admin = {
    init: async () => {
        // 1. Load Analytics
        const { data: customers } = await supabaseClient.from('customers').select('points_balance, total_visits');
        const { data: visits } = await supabaseClient.from('visits').select('*');
        const { data: games } = await supabaseClient.from('game_history').select('*');
        
        if(customers) {
            const totalPoints = customers.reduce((sum, c) => sum + c.points_balance, 0);
            const totalVisits = customers.reduce((sum, c) => sum + c.total_visits, 0);
            document.getElementById('statUsers').innerText = customers.length;
            document.getElementById('statPoints').innerText = totalPoints;
            document.getElementById('statVisits').innerText = totalVisits;
            document.getElementById('statGames').innerText = (games || []).length;
        }

        // 2. Load Settings into Inputs
        const { data: sets } = await supabaseClient.from('app_settings').select('*');
        sets.forEach(s => App.settings[s.key] = s.value);
        document.getElementById('setPointsRate').value = App.settings['points_per_jod'] || 1;
        document.getElementById('setMissionTarget').value = App.settings['mission_target_visits'] || 5;
        document.getElementById('setCatchCost').value = App.settings['catch_cost'] || 20;
        document.getElementById('setShootCost').value = App.settings['shoot_cost'] || 30;

        // 3. Load Menu
        const { data: menu } = await supabaseClient.from('menu_items').select('*');
        const list = document.getElementById('adminMenuList');
        list.innerHTML = '';
        if(menu) menu.forEach(m => { list.innerHTML += `<div class="list-group-item text-white border-secondary bg-transparent d-flex justify-content-between align-items-center"><span>${m.name}</span><button class="btn btn-sm btn-danger" onclick="Admin.deleteItem('menu_items', '${m.id}')">Del</button></div>`; });
        
        // 4. Load Rewards
        const { data: rew } = await supabaseClient.from('rewards').select('*');
        const rList = document.getElementById('adminRewList');
        rList.innerHTML = '';
        if(rew) rew.forEach(r => { rList.innerHTML += `<div class="list-group-item text-white border-secondary bg-transparent d-flex justify-content-between align-items-center"><span>${r.title}</span><button class="btn btn-sm btn-danger" onclick="Admin.deleteItem('rewards', '${r.id}')">Del</button></div>`; });
    },

    saveSettings: async () => {
        const pRate = document.getElementById('setPointsRate').value;
        const mTarget = document.getElementById('setMissionTarget').value;
        const cCost = document.getElementById('setCatchCost').value;
        const sCost = document.getElementById('setShootCost').value;

        await supabaseClient.from('app_settings').upsert([
            { key: 'points_per_jod', value: pRate },
            { key: 'mission_target_visits', value: mTarget },
            { key: 'catch_cost', value: cCost },
            { key: 'shoot_cost', value: sCost }
        ]);
        alert("Settings Saved!");
        Admin.init(); // Refresh stats/logic
    },

    addMenuItem: async () => {
        const name = document.getElementById('newMenuName').value;
        const price = document.getElementById('newMenuPrice').value;
        const img = document.getElementById('newMenuImg').value || `https://picsum.photos/seed/${name}/300/200`;
        if(name && price) {
            await supabaseClient.from('menu_items').insert([{ name, price, image_url: img }]);
            alert('Item Added'); Admin.init(); 
            document.getElementById('newMenuName').value = ''; document.getElementById('newMenuPrice').value = '';
        }
    },
    addReward: async () => {
        const title = document.getElementById('newRewTitle').value;
        const cost = document.getElementById('newRewCost').value;
        if(title && cost) {
            await supabaseClient.from('rewards').insert([{ title, cost_points: cost }]);
            alert('Reward Added'); Admin.init(); 
            document.getElementById('newRewTitle').value = ''; document.getElementById('newRewCost').value = '';
        }
    },
    deleteItem: async (table, id) => {
        if(confirm('Delete?')) { await supabaseClient.from(table).delete().eq('id', id); Admin.init(); }
    }
};