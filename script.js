let currentUser = null;

async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Signing in...";
    btn.disabled = true;
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: document.getElementById('username').value, password: document.getElementById('password').value })
        });
        const data = await res.json();
        if (data.success) { 
            currentUser = data.user; 
            initApp(); 
        }
        else { alert('Invalid credentials'); btn.innerText = originalText; btn.disabled = false; }
    } catch (err) { alert('Server error'); btn.innerText = originalText; btn.disabled = false; }
}

function initApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'flex';
    document.getElementById('user-name-display').innerText = currentUser.name;
    document.getElementById('user-role-display').innerText = currentUser.role.toUpperCase();
    document.getElementById('user-avatar').innerText = currentUser.name.charAt(0);
    const menu = document.getElementById('nav-menu');
    
    if (currentUser.role === 'student') {
        menu.innerHTML = `
            <div class="nav-item active" onclick="navigate('dashboard', this)">📊 Dashboard</div>
            <div class="nav-item" onclick="navigate('timetable', this)">📅 Timetable</div>
            <div class="nav-item" onclick="navigate('attendance', this)">📈 Attendance</div>
        `;
        navigate('dashboard');
    } else if (currentUser.role === 'teacher') {
        // TEACHER MENU
        menu.innerHTML = `
            <div class="nav-item active" onclick="navigate('dashboard', this)">📅 My Schedule</div>
            <div class="nav-item" onclick="navigate('mark-attendance', this)">✏️ Mark Attendance</div>
            <div class="nav-item" onclick="navigate('students', this)">👥 Students</div>
            <div class="nav-item" onclick="navigate('shortage', this)">⚠️ Shortage List</div>
        `;
        navigate('dashboard');
    } else {
        // ADMIN MENU
        menu.innerHTML = `
            <div class="nav-item active" onclick="navigate('dashboard', this)">🏫 Overview</div>
            <div class="nav-item" onclick="navigate('mark-attendance', this)">✏️ Mark Attendance</div>
            <div class="nav-item" onclick="navigate('students', this)">👥 Students</div>
            <div class="nav-item" onclick="navigate('shortage', this)">⚠️ Shortage List</div>
        `;
        navigate('dashboard');
    }
}

function logout() { location.reload(); }

function navigate(page, el) {
    if(el) { document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); el.classList.add('active'); }
    const titles = { 
        'dashboard': 'Dashboard', 
        'timetable': 'Class Timetable', 
        'attendance': 'Attendance Report', 
        'mark-attendance': 'Mark Attendance', 
        'students': 'Student Directory', 
        'shortage': 'Attendance Shortage' 
    };
    document.getElementById('page-title').innerText = titles[page] || 'Dashboard';
    const content = document.getElementById('main-content'); 
    content.innerHTML = ''; 
    content.className = 'content-area fade-in'; 
    
    if (currentUser.role === 'student') loadStudentPage(page);
    else loadAdminPage(page);
}

window.switchTab = function(tabName, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById(`tab-${tabName}`).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
}

async function loadStudentPage(page) {
    const attRes = await fetch(`/api/student/attendance/${currentUser.id}?t=${Date.now()}`);
    const attData = await attRes.json();

    if (page === 'dashboard') {
        const isLow = attData.overall.semesterPercentage < 75 && attData.overall.total > 0;
        document.getElementById('main-content').innerHTML = `
            ${isLow ? `<div class="card" style="background:#fee2e2; border-color:#fca5a5; margin-bottom:24px; display:flex; align-items:center; gap:15px;"><div style="font-size:2.5rem;">🚨</div><div><h3 style="color:#991b1b; margin-bottom:5px;">Low Attendance Warning</h3><p style="color:#b91c1c;">You are below 75%. You need to improve immediately.</p></div></div>` : ''}
            <div class="grid-dashboard">
                <div class="card stat-card"><div class="stat-icon" style="background:#e0f2fe; color:#0284c7">📅</div><div class="stat-info"><h3>${attData.overall.monthlyPercentage}%</h3><p>Monthly Attendance</p><small style="color:var(--text-muted)">${attData.overall.monthlyPresent}/${attData.overall.monthlyTotal} Classes</small></div></div>
                <div class="card stat-card"><div class="stat-icon">🎓</div><div class="stat-info"><h3>${attData.overall.semesterPercentage}%</h3><p>Semester Attendance</p><small style="color:var(--text-muted)">${attData.overall.present}/${attData.overall.total} Classes</small></div></div>
            </div>
            <div class="card"><h3 style="margin-bottom:15px; border-bottom:1px solid #f3f4f6; padding-bottom:10px;">My Profile</h3><div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;"><div><strong>Roll Number:</strong> ${currentUser.rollNumber}</div><div><strong>Course:</strong> ${currentUser.course}</div><div><strong>Email:</strong> ${currentUser.email}</div><div><strong>Semester:</strong> ${currentUser.semester}</div></div></div>
        `;
    } else if (page === 'attendance') {
        const total = attData.overall.total, present = attData.overall.present, absent = total - present;
        const dailyLogHtml = attData.history.map(h => `<tr><td><strong>${h.date}</strong></td><td>${h.subject}</td><td><span class="badge ${h.status === 'present' ? 'badge-green' : 'badge-red'}">${h.status.toUpperCase()}</span></td><td>Period ${h.period}</td></tr>`).join('');
        const subjectHtml = attData.subjects.map(s => `<tr><td><strong>${s.subject}</strong></td><td style="text-align:center">${s.total}</td><td style="text-align:center; color:#059669">${s.present}</td><td style="text-align:center; color:#dc2626">${s.total - s.present}</td><td style="text-align:center"><span class="badge ${s.isShortage ? 'badge-red' : 'badge-green'}">${s.percentage}%</span></td></tr>`).join('');
        document.getElementById('main-content').innerHTML = `
            <div class="tabs"><button class="tab-btn active" onclick="switchTab('overview', this)">📊 Overview</button><button class="tab-btn" onclick="switchTab('subjects', this)">📚 Class-wise</button><button class="tab-btn" onclick="switchTab('daily', this)">📅 Daily Log</button></div>
            <div id="tab-overview" class="tab-content"><div class="grid-dashboard"><div class="card stat-card"><div class="stat-icon" style="background:#f3f4f6; color:#4b5563">📚</div><div class="stat-info"><h3>${total}</h3><p>Total Classes</p></div></div><div class="card stat-card"><div class="stat-icon" style="background:#d1fae5; color:#059669">✅</div><div class="stat-info"><h3>${present}</h3><p>Present</p></div></div><div class="card stat-card"><div class="stat-icon" style="background:#fee2e2; color:#dc2626">❌</div><div class="stat-info"><h3>${absent}</h3><p>Absent</p></div></div></div></div>
            <div id="tab-subjects" class="tab-content" style="display:none;"><div class="card" style="padding:0; overflow:hidden;"><div class="table-container" style="border:none; border-radius:0;"><table><thead><tr><th>Subject</th><th style="text-align:center">Total</th><th style="text-align:center">Present</th><th style="text-align:center">Absent</th><th style="text-align:center">%</th></tr></thead><tbody>${subjectHtml}</tbody></table></div></div></div>
            <div id="tab-daily" class="tab-content" style="display:none;"><div class="card" style="padding:0; overflow:hidden;"><div class="table-container" style="border:none; border-radius:0;"><table><thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Period</th></tr></thead><tbody>${dailyLogHtml.length ? dailyLogHtml : '<tr><td colspan="4" style="text-align:center; padding:30px;">No records found.</td></tr>'}</tbody></table></div></div></div>
        `;
    } else if (page === 'timetable') {
        const res = await fetch(`/api/student/timetable/${currentUser.course}`); const schedule = await res.json();
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let html = `<div class="card">`;
        days.forEach(day => {
            const slots = schedule[day] || [];
            html += `<div style="margin-bottom:20px; padding-bottom:20px; border-bottom:1px solid #f3f4f6;"><h4 style="color:var(--primary); margin-bottom:12px; font-size:1.2rem;">${day}</h4>${slots.map(s => `<div style="background:#f9fafb; padding:15px; margin-bottom:10px; border-radius:12px; display:flex; justify-content:space-between; align-items:center; border-left:5px solid var(--primary); box-shadow: 0 1px 2px rgba(0,0,0,0.05);"><div><span style="font-weight:700; font-size:1.05rem; color:var(--text-main);">${s.subject}</span></div><div style="text-align:right;"><span style="font-size:0.9rem; color:var(--text-muted); display:block;">${s.time}</span><span style="font-size:0.85rem; color:var(--primary); font-weight:600;">${s.room}</span></div></div>`).join('')}</div>`;
        }); html += `</div>`; document.getElementById('main-content').innerHTML = html;
    }
}

async function loadAdminPage(page) {
    if (page === 'dashboard') {
        if(currentUser.role === 'teacher') {
            const res = await fetch('/api/teacher/today', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ subjectsAssigned: currentUser.subjects }) });
            const data = await res.json();
            document.getElementById('main-content').innerHTML = `
                <div style="margin-bottom:20px;"><h2 style="margin-bottom:5px;">Good Day, ${currentUser.name}! 👋</h2><p style="color:var(--text-muted);">Here is your schedule for <strong>${data.day}</strong>.</p></div>
                <div class="card" style="margin-bottom:30px; background:linear-gradient(135deg, #0d9488, #0f766e); color:white;"><div style="display:flex; justify-content:space-between; align-items:center;"><div><h3 style="font-size:1.1rem; opacity:0.9; margin-bottom:5px;">Classes Scheduled Today</h3><div style="font-size:3rem; font-weight:800;">${data.classes.length}</div></div><div style="font-size:4rem; opacity:0.3;">📅</div></div></div>
                <h3 style="margin-bottom:20px;">Today's Classes</h3><div class="grid-dashboard">${data.classes.map(c => `<div class="card stat-card"><div class="stat-icon" style="background:#e0e7ff; color:#4338ca">🔔</div><div class="stat-info"><h3 style="font-size:1.2rem; line-height:1.3; margin-bottom:5px;">${c.subject}</h3><p style="margin-bottom:2px;">Period ${c.period} • ${c.room}</p><small style="color:var(--text-muted); font-weight:600;">${c.time}</small><div style="margin-top:8px;"><span class="badge badge-blue">${c.course}</span></div></div></div>`).join('')}${data.classes.length === 0 ? '<p>No classes scheduled for today. Enjoy your day!</p>' : ''}</div>
            `;
        } else { document.getElementById('main-content').innerHTML = `<div class="card" style="text-align:center; padding:50px;"><div style="font-size:3rem; margin-bottom:15px;">👨‍💻</div><h2>Welcome Admin</h2><p style="color:var(--text-muted);">System is running smoothly. Use the sidebar to manage records.</p></div>`; }
    } else if (page === 'mark-attendance') {
        document.getElementById('main-content').innerHTML = `
            <div class="card" style="max-width:800px; margin:0 auto;"><h3 style="margin-bottom:20px; border-bottom:1px solid #f3f4f6; padding-bottom:15px;">Mark Attendance</h3>
            <div class="form-grid"><div class="form-group"><label class="form-label">Course</label><select id="courseSelect" class="form-input" onchange="loadSubjects()"><option value="">Select Course</option><option>BCA</option><option>BBA</option><option>BCOM</option></select></div><div class="form-group"><label class="form-label">Subject</label><select id="subjectSelect" class="form-input"><option>Select Course First</option></select></div><div class="form-group"><label class="form-label">Date</label><input type="date" id="attDate" class="form-input" value="${new Date().toISOString().split('T')[0]}"></div><div class="form-group"><label class="form-label">Period</label><select id="periodSelect" class="form-input"><option value="1">Period 1</option><option value="2">Period 2</option><option value="3">Period 3</option><option value="4">Period 4</option></select></div></div>
            <div class="form-group"><label class="form-label" style="color:#dc2626">Absent Students (Serial Numbers)</label><textarea id="absentList" rows="3" placeholder="e.g. 1, 3, 5"></textarea><small style="color:var(--text-muted); font-size:0.85rem; margin-top:5px; display:block;">Enter the Serial Number (1, 2, 3...) from the class list.</small></div>
            <button class="btn-primary" onclick="submitAttendance()">Submit Attendance</button></div>
        `;
    } else if (page === 'students') {
        document.getElementById('main-content').innerHTML = `<div class="card"><div style="margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;"><h3 style="margin:0;">Student Directory</h3><select id="studentCourse" class="form-input" style="max-width:200px" onchange="loadStudents()"><option value="">All Courses</option><option>BCA</option><option>BBA</option><option>BCOM</option></select></div><div id="studentTable" class="table-container"></div></div>`;
    } else if (page === 'shortage') {
        document.getElementById('main-content').innerHTML = `<div class="card"><div style="margin-bottom:20px;"><h3 style="margin-bottom:10px;">Attendance Shortage</h3><select id="shortCourse" class="form-input" style="max-width:200px" onchange="loadShortage()"><option value="">Select Course</option><option>BCA</option><option>BBA</option><option>BCOM</option></select></div><div id="shortTable" class="table-container"></div></div>`;
    }
}

async function loadSubjects() {
    const c = document.getElementById('courseSelect').value; if(!c) return;
    const res = await fetch(`/api/student/subjects/${c}`); const subs = await res.json();
    document.getElementById('subjectSelect').innerHTML = subs.map(s => `<option>${s}</option>`).join('');
}

async function submitAttendance() {
    const body = { courseId: document.getElementById('courseSelect').value, subject: document.getElementById('subjectSelect').value, date: document.getElementById('attDate').value, period: document.getElementById('periodSelect').value, absentRollNumbers: document.getElementById('absentList').value.split(',').map(s=>s.trim()) };
    if(!body.courseId || !body.subject) return alert('Please fill all fields');
    const res = await fetch('/api/admin/attendance', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
    alert((await res.json()).message); document.getElementById('absentList').value = '';
}

async function loadStudents() {
    const c = document.getElementById('studentCourse').value; if(!c) return;
    const res = await fetch(`/api/admin/students/${c}`); const s = await res.json();
    document.getElementById('studentTable').innerHTML = `<table><thead><tr><th>S.No</th><th>Name</th><th>Roll No</th><th>Course</th><th>Attendance %</th></tr></thead><tbody>${s.map((x, i) => `<tr><td><strong>${i+1}</strong></td><td>${x.name}</td><td>${x.rollNumber}</td><td>${x.course}</td><td><span class="badge ${x.stats.semesterPercentage<75?'badge-red':'badge-green'}">${x.stats.semesterPercentage}%</span></td></tr>`).join('')}</tbody></table>`;
}

async function loadShortage() {
    const c = document.getElementById('shortCourse').value; if(!c) return;
    const res = await fetch(`/api/admin/shortage/${c}`); const s = await res.json();
    document.getElementById('shortTable').innerHTML = s.length ? `<table><thead><tr><th>Name</th><th>Roll No</th><th>Attendance %</th></tr></thead><tbody>${s.map(x=>`<tr><td><strong>${x.name}</strong></td><td>${x.rollNumber}</td><td><span class="badge badge-red">${x.stats.semesterPercentage}%</span></td></tr>`).join('')}</tbody></table>` : '<div style="padding:40px; text-align:center; color:var(--text-muted);">Great! No shortage found in this course.</div>';
}