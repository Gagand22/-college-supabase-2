/**
 * seedAttendance.js
 * 
 * Run this ONCE after your server has started and users are in the DB:
 *   node seedAttendance.js
 * 
 * It generates 30 days of realistic attendance data for all students.
 */

const mongoose = require('mongoose');

// ============================================================
// 1. CONNECTION — must match server.js
// ============================================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniportal_db';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB for Seeding...');
        seedAttendance();
    })
    .catch(err => {
        console.error('❌ Connection Error:', err.message);
        process.exit(1);
    });

// ============================================================
// 2. SCHEMAS — must exactly match server.js
// ============================================================
const userSchema = new mongoose.Schema({
    username:   String,
    password:   String,
    role:       String,
    name:       String,
    course:     String,
    rollNumber: String,
    email:      String,
    mobile:     String,
    semester:   Number,
    subjects:   [String]
});

const attendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date:      String,
    subject:   String,
    period:    Number,
    status:    { type: String, enum: ['present', 'absent'] }
});

attendanceSchema.index({ studentId: 1, date: 1, subject: 1, period: 1 }, { unique: true });

// Use existing models if already registered (avoids OverwriteModelError)
const User       = mongoose.models.User       || mongoose.model('User', userSchema);
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema);

// ============================================================
// 3. HELPERS
// ============================================================
function formatDate(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

const subjectsByCourse = {
    'BCA':  ['Java Programming', 'Data Structures', 'DBMS', 'Computer Networks', 'Operating Systems'],
    'BBA':  ['Business Studies', 'Marketing Mgmt', 'HR Management', 'Business Law', 'Business Ethics'],
    'BCOM': ['Accounting', 'Economics', 'Taxation', 'Business Stats', 'Banking']
};

// ============================================================
// 4. SEED FUNCTION
// ============================================================
async function seedAttendance() {
    try {
        const students = await User.find({ role: 'student' });

        if (students.length === 0) {
            console.error('❌ No students found in DB. Run server.js first to seed users.');
            process.exit(1);
        }

        console.log(`👥 Found ${students.length} students. Generating records...`);

        // Clear existing attendance data
        const deleted = await Attendance.deleteMany({});
        console.log(`🗑️  Cleared ${deleted.deletedCount} old attendance records.`);

        const today = new Date();
        const recordsToInsert = [];

        // Generate 1 record per student per working day for last 30 days
        for (let i = 0; i < 30; i++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() - i);

            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek === 0) continue; // Skip Sundays

            const dateString = formatDate(currentDate);

            for (const student of students) {
                const courseSubjects = subjectsByCourse[student.course] || ['General'];

                // Pick random subject and period for each day
                const subject = courseSubjects[Math.floor(Math.random() * courseSubjects.length)];
                const period  = Math.floor(Math.random() * 4) + 1; // 1–4

                // 80% present, 20% absent
                const status = Math.random() > 0.2 ? 'present' : 'absent';

                recordsToInsert.push({
                    studentId: student._id,
                    date:      dateString,
                    subject,
                    period,
                    status
                });
            }
        }

        // Use ordered:false so it skips duplicates and continues instead of stopping
        const result = await Attendance.insertMany(recordsToInsert, { ordered: false });
        console.log(`✅ Successfully inserted ${result.length} attendance records!`);

    } catch (err) {
        // If some records were duplicate, insertMany may throw but still insert the rest
        if (err.code === 11000) {
            console.warn('⚠️  Some duplicate records were skipped (this is normal on re-run).');
        } else {
            console.error('❌ Seeding failed:', err.message);
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB.');
        process.exit(0);
    }
}
