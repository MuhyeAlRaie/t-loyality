const App = {
    user: null,
    profile: null,

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
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if(error) alert(error.message);
    },

    signup: async () => {
        const name = document.getElementById('regName').value;
        const phone = document.getElementById('regPhone').value;
        const pass = document.getElementById('regPass').value;
        if(!name || !phone || !pass) return alert("Please fill all fields");
        const email = phone + '@loyalty.app';
        const { data, error } = await supabase.auth.signUp({ email, password: pass });
        if(error) alert(error.message);
        else if(data.user) {
            await supabase.from('customers').insert([{ id: data.user.id, email, phone_number: phone, name }]);
            alert("Account Created! Please login.");
            App.toggleAuthView('login');
        }
    },

    logout: async () => { 
        await supabase.auth.signOut(); 
        location.reload(); 
    },

    loadProfile: async () => {
        const { data, error } = await supabase.from('customers').select('*').eq('id', App.user.id).single();
        if(data) {
            App.profile = data;
            document.getElementById('view-login').classList.add('hidden');
            App.updateNav(true, data.name);
            // Admin Check
            if(data.phone_number === '000000') {
                document.getElementById('view-admin').classList.remove('hidden');
                Admin.init();
            } else {
                document.getElementById('view-dashboard').classList.remove('hidden');
                App.loadCustomerData();
            }
        }
    },

    loadCustomerData: async () => {
        document.getElementById('dashPoints').innerText = App.profile.points_balance;
        document.getElementById('dashVisits').innerText = App.profile.total_visits;

        // Menu
        const { data: menu } = await supabase.from('menu_items').select('*');
        const mContainer = document.getElementById('menuList');
        mContainer.innerHTML = '';
        if(menu) {
            menu.forEach(m => {
                mContainer.innerHTML += `<div class="col-md-4 col-6"><div class="card h-100"><img src="${m.image_url}" class="menu-img"><div class="card-body p-3"><h6 class="fw-bold">${m.name}</h6><p class="text-info mb-0">${m.price} JOD</p></div></div></div>`;
            });
        }

        // Rewards
        const { data: rewards } = await supabase.from('rewards').select('*');
        const rContainer = document.getElementById('rewardsList');
        rContainer.innerHTML = '';
        if(rewards) {
            rewards.forEach(r => {
                const canAfford = App.profile.points_balance >= r.cost_points;
                rContainer.innerHTML += `<div class="col-md-4 col-6"><div class="card p-3 h-100"><h6>${r.title}</h6><div class="d-flex justify-content-between mt-2"><span class="badge bg-secondary">${r.cost_points} Pts</span><button class="btn btn-sm ${canAfford?'btn-primary':'btn-outline-secondary'}" onclick="App.redeem('${r.id}', ${r.cost_points})">Redeem</button></div></div></div>`;
            });
        }

        Games.checkCooldowns();
    },

    redeem: async (rid, cost) => {
        if(!confirm("Redeem this reward?")) return;
        const newBal = App.profile.points_balance - cost;
        const { error } = await supabase.from('customers').update({ points_balance: newBal }).eq('id', App.user.id);
        if(!error) { 
            alert("Reward Redeemed!"); 
            App.loadCustomerData(); 
        } else {
            alert("Error redeeming.");
        }
    },

    findCustomer: async () => {
        const phone = document.getElementById('empPhone').value;
        const { data } = await supabase.from('customers').select('*').eq('phone_number', phone).single();
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
        const points = Math.floor(amount);
        await supabase.from('customers').update({ 
            points_balance: App.empTarget.points_balance + points, 
            total_visits: App.empTarget.total_visits + 1 
        }).eq('id', App.empTarget.id);
        await supabase.from('visits').insert([{ 
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
            const { data } = await supabase
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
                    // Disable click
                    const clone = card.cloneNode(true);
                    card.parentNode.replaceChild(clone, card);
                } else {
                    badge.innerText = "PLAY NOW";
                    badge.className = "badge bg-success";
                    card.classList.remove('disabled');
                    // Ensure click is bound
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
        
        // Mouse Control
        canvas.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            player.x = e.clientX - rect.left - 25;
        };
        
        const update = () => {
            ctx.clearRect(0,0,320,400);
            frame++;
            
            // --- WHEEL GAME ---
            if(type === 'wheel') {
                ctx.save();
                ctx.translate(160, 200);
                ctx.rotate(frame * 0.1);
                ctx.beginPath(); ctx.arc(0,0,100,0,2*Math.PI); ctx.fillStyle='#333'; ctx.fill();
                // Draw Segments
                ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,100,0,1.57); ctx.fill();
                ctx.fillStyle = '#3b82f6'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,100,1.57,3.14); ctx.fill();
                ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,100,3.14,4.71); ctx.fill();
                ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,100,4.71,6.28); ctx.fill();
                ctx.restore();

                if(frame > 150) { 
                    Games.score = Math.floor(Math.random() * 500) + 50;
                    Games.endGame(modal, type);
                    return;
                }
            }
            // --- ACTION GAMES ---
            else {
                // Player
                ctx.fillStyle = '#667eea';
                ctx.fillRect(player.x, player.y, player.w, player.h);
                ctx.font="30px Arial";
                ctx.fillText(type==='burger'?'🧺':'☕', player.x, player.y+40);

                // Spawner
                if(frame % 40 === 0) {
                    items.push({ x: Math.random()*280, y: type==='burger'?-40:400, val: Math.random() > 0.3 ? 10 : -5 });
                }
                
                // Items Logic
                for(let i=0; i<items.length; i++) {
                    let it = items[i];
                    it.y += type==='burger' ? 4 : -4;
                    ctx.font = "25px Arial";
                    ctx.fillText(it.val > 0 ? '🍔' : '💣', it.x, it.y);
                    
                    if(type==='burger' && it.y > 350 && Math.abs(it.x - player.x) < 40) {
                        Games.score += it.val;
                        items.splice(i, 1); i--;
                    }
                    else if((type==='burger' && it.y > 400) || (type==='coffee' && it.y < 0)) {
                        items.splice(i, 1); i--;
                    }
                }

                if(frame > 600) { 
                    Games.endGame(modal, type);
                    return;
                }
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
            await supabase.from('customers').update({points_balance: winBal}).eq('id', App.user.id);
            App.profile.points_balance = winBal;
            alert(`You Won ${Games.score} Points!`);
        } else {
            alert("Better luck next time!");
        }
        
        // Log to DB to enforce cooldown
        await supabase.from('game_history').insert([{
            customer_id: App.user.id,
            game_type: type
        }]);
        
        App.loadCustomerData();
    },
    
    stop: () => {
        if(Games.loop) cancelAnimationFrame(Games.loop);
    }
};

const Admin = {
    init: async () => {
        const { data: menu } = await supabase.from('menu_items').select('*');
        const list = document.getElementById('adminMenuList');
        list.innerHTML = '';
        if(menu) menu.forEach(m => { list.innerHTML += `<div class="list-group-item text-white border-secondary bg-transparent d-flex justify-content-between align-items-center"><span>${m.name}</span><button class="btn btn-sm btn-danger" onclick="Admin.deleteItem('menu_items', '${m.id}')">Del</button></div>`; });
        
        const { data: rew } = await supabase.from('rewards').select('*');
        const rList = document.getElementById('adminRewList');
        rList.innerHTML = '';
        if(rew) rew.forEach(r => { rList.innerHTML += `<div class="list-group-item text-white border-secondary bg-transparent d-flex justify-content-between align-items-center"><span>${r.title}</span><button class="btn btn-sm btn-danger" onclick="Admin.deleteItem('rewards', '${r.id}')">Del</button></div>`; });
    },
    addMenuItem: async () => {
        const name = document.getElementById('newMenuName').value;
        const price = document.getElementById('newMenuPrice').value;
        const img = document.getElementById('newMenuImg').value || `https://picsum.photos/seed/${name}/300/200`;
        if(name && price) {
            await supabase.from('menu_items').insert([{ name, price, image_url: img }]);
            alert('Item Added'); Admin.init(); 
            document.getElementById('newMenuName').value = ''; document.getElementById('newMenuPrice').value = '';
        }
    },
    addReward: async () => {
        const title = document.getElementById('newRewTitle').value;
        const cost = document.getElementById('newRewCost').value;
        if(title && cost) {
            await supabase.from('rewards').insert([{ title, cost_points: cost }]);
            alert('Reward Added'); Admin.init(); 
            document.getElementById('newRewTitle').value = ''; document.getElementById('newRewCost').value = '';
        }
    },
    deleteItem: async (table, id) => {
        if(confirm('Delete?')) { await supabase.from(table).delete().eq('id', id); Admin.init(); }
    }
};