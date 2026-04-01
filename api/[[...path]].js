const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config(); 

const app = express();

// --- 1. SUPABASE CONNECTION ---
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// --- 2. HELPERS ---
const subjects = {
    "BCA": ["Java Programming", "Data Structures", "DBMS", "Computer Networks", "Operating Systems"],
    "BBA": ["Business Studies", "Marketing Mgmt", "HR Management", "Business Law", "Business Ethics"],
    "BCOM": ["Accounting", "Economics", "Taxation", "Business Stats", "Banking"]
};

function generateTimetable(courseName) {
    const subs = subjects[courseName] || [];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let schedule = {};
    days.forEach((day, index) => {
        let isOddDay = ((index + 1) % 2 !== 0);
        if (isOddDay) {
            schedule[day] = [
                { time: "02:00 PM - 02:50 PM", subject: subs[0] || "General", room: "Room 101", period: 1 },
                { time: "02:50 PM - 03:40 PM", subject: subs[1] || "General", room: "Room 102", period: 2 },
                { time: "03:40 PM - 04:30 PM", subject: subs[2] || "General", room: "Lab A", period: 3 },
                { time: "04:30 PM - 05:20 PM", subject: subs[3] || "General", room: "Room B", period: 4 }
            ];
        } else {
            schedule[day] = [
                { time: "09:00 AM - 09:50 AM", subject: subs[4] || "General", room: "Room 201", period: 1 },
                { time: "09:50 AM - 10:40 AM", subject: subs[0] || "General", room: "Room 202", period: 2 },
                { time: "10:40 AM - 11:30 AM", subject: subs[1] || "General", room: "Room 203", period: 3 },
                { time: "11:30 AM - 12:20 PM", subject: subs[2] || "General", room: "Lab C", period: 4 }
            ];
        }
    });
    return schedule;
}

// --- 3. DATABASE HELPERS ---
async function calculateAttendance(studentId) {
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('studentId', studentId);
    if (error) throw error;
    const rows = data || [];
    const totalClasses = rows.length;
    const presentCount = rows.filter(r => r.status === 'present').length;
    const semesterPercentage = totalClasses === 0 ? 0 : ((presentCount / totalClasses) * 100).toFixed(1);
    const currentMonth = new Date().getMonth();
    const monthlyRecords = rows.filter(r => new Date(r.date).getMonth() === currentMonth);
    const monthlyTotal = monthlyRecords.length;
    const monthlyPresent = monthlyRecords.filter(r => r.status === 'present').length;
    const monthlyPercentage = monthlyTotal === 0 ? 0 : ((monthlyPresent / monthlyTotal) * 100).toFixed(1);
    return { semesterPercentage, total: totalClasses, present: presentCount, monthlyPercentage, monthlyTotal, monthlyPresent };
}

async function calculateSubjectAttendance(studentId) {
    const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('studentId', studentId);
    if (error) return [];
    const rows = data || [];
    let subjectStats = {};
    rows.forEach(record => {
        if (!subjectStats[record.subject]) subjectStats[record.subject] = { total: 0, present: 0 };
        subjectStats[record.subject].total++;
        if (record.status === 'present') subjectStats[record.subject].present++;
    });
    let result = [];
    for (let sub in subjectStats) {
        let stats = subjectStats[sub];
        let percent = ((stats.present / stats.total) * 100).toFixed(1);
        result.push({ subject: sub, present: stats.present, total: stats.total, percentage: percent, isShortage: percent < 75 });
    }
    return result;
}

// --- 4. ROUTES ---

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();
    if (error || !user) return res.status(401).json({ success: false, message: "Invalid Credentials" });
    const { password: pwd, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
});

app.get('/api/student/subjects/:course', (req, res) => res.json(subjects[req.params.course] || []));
app.get('/api/student/timetable/:course', (req, res) => res.json(generateTimetable(req.params.course)));

app.get('/api/student/attendance/:id', async (req, res) => {
    try {
        const overall = await calculateAttendance(req.params.id);
        const subjectWise = await calculateSubjectAttendance(req.params.id);
        const { data: history, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('studentId', req.params.id)
            .order('date', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        res.json({ overall, subjects: subjectWise, history: history || [] });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/teacher/today', (req, res) => {
    const { subjectsAssigned } = req.body;
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const today = dayNames[new Date().getDay()];
    let todayClasses = [];
    Object.keys(subjects).forEach(course => {
        const schedule = generateTimetable(course);
        (schedule[today] || []).forEach(slot => {
            if (subjectsAssigned.includes(slot.subject)) todayClasses.push({ ...slot, course });
        });
    });
    res.json({ day: today, classes: todayClasses });
});

app.get('/api/admin/students/:course', async (req, res) => {
    const { data: students, error } = await supabase
        .from('users')
        .select('*')
        .eq('course', req.params.course)
        .eq('role', 'student')
        .order('id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    const studentsWithStats = await Promise.all((students || []).map(async (s) => {
        const stats = await calculateAttendance(s.id);
        return { ...s, stats };
    }));
    res.json(studentsWithStats);
});

app.post('/api/admin/attendance', async (req, res) => {
    const { date, subject, courseId, period, absentRollNumbers } = req.body;
    const { data: students, error: studentError } = await supabase
        .from('users')
        .select('*')
        .eq('course', courseId)
        .eq('role', 'student')
        .order('id', { ascending: true });
    if (studentError) return res.status(500).json({ error: studentError.message });
    const absentIndices = absentRollNumbers.map(r => parseInt(r.trim()));
    const newRecords = students.map((student, index) => ({
        studentId: student.id, date: date, subject: subject, period: parseInt(period),
        status: absentIndices.includes(index + 1) ? 'absent' : 'present'
    }));
    try {
        await supabase.from('attendance').delete().eq('date', date).eq('subject', subject).eq('period', period);
        const { error: insertError } = await supabase.from('attendance').insert(newRecords);
        if (insertError) throw insertError;
        res.json({ success: true, message: "Attendance Updated Successfully" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/shortage/:course', async (req, res) => {
    const { data: students, error } = await supabase
        .from('users')
        .select('*')
        .eq('course', req.params.course)
        .eq('role', 'student');
    if (error) return res.status(500).json({ error: error.message });
    const shortageList = [];
    for (const s of (students || [])) {
        const stats = await calculateAttendance(s.id);
        if (stats.total > 0 && stats.semesterPercentage < 75) shortageList.push({ ...s, stats });
    }
    res.json(shortageList);
});

// --- 5. EXPORT ---
module.exports = app;