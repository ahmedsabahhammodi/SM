const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();
const multer = require('multer');
const path = require('path');
const JWT_SECRET = 'your-super-secret-key-that-is-long-and-secure';
const fs_sync = require('fs');
const fs_async = require('fs').promises; 
const { generateRealBarcode } = require("./barcodeGenerator"); 
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const puppeteer = require('puppeteer');
const { machineIdSync } = require('node-machine-id');
let SERVER_MACHINE_ID;
try {
    SERVER_MACHINE_ID = machineIdSync();
    console.log(`[server.js] Server Machine ID: ${SERVER_MACHINE_ID}`);
} catch (error) {
    console.error('[server.js] Critical Error: Could not get server machine ID.', error);
    process.exit(1); // إيقاف الخادم إذا لم يتمكن من الحصول على بصمته
}
const bwipjs = require('bwip-js'); 

const {
    Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, ImageRun,
    TextRun, AlignmentType, VerticalAlign, BorderStyle, TabStopType, Tab
} = require('docx');
  const ExcelJS = require('exceljs');
  const jwt = require('jsonwebtoken');
  const bcrypt = require('bcryptjs');

  app.use(express.static('public', {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));

  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
const logoStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/uploads/logos');
fs_sync.mkdirSync(uploadPath, { recursive: true }); 
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // اسم فريد للشعار لتجنب الكتابة فوق الملفات
        cb(null, 'school_logo_' + Date.now() + path.extname(file.originalname));
    }
});
const uploadLogo = multer({ storage: logoStorage });
  const storage = multer.diskStorage({
      destination: function (req, file, cb) {
          cb(null, path.join(__dirname, 'public/uploads'));
      },
      filename: function (req, file, cb) {
          cb(null, Date.now() + '-' + file.originalname);
      }
  });
  const upload = multer({ storage: storage });

const studentsStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/uploads/students'); 
        fs_sync.mkdirSync(uploadPath, { recursive: true }); 
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
  const uploadStudents = multer({ storage: studentsStorage });

const outgoingStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'public/outgoing_files');
fs_sync.mkdirSync(uploadPath, { recursive: true }); 
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const uploadOutgoing = multer({ storage: outgoingStorage });


  app.get('/', (req, res) => {
    res.redirect('/login.html');
  });

  app.use(express.json({ limit: '10mb' }));

  const excludedPaths = [
    '/api/generate-license',
    '/api/check-license',
    '/api/verify-license',
    '/api/licenses',
    '/api/login',
    '/licenses_dashboard.html',
    '/license_generator.html',
    '/server_status.html',
    '/verify_license.html',
    '/login.html',
   
  ];

  app.use((req, res, next) => {
    if (
      excludedPaths.includes(req.path) ||
      req.path.startsWith('/api/licenses/')
    ) return next();

    licenseMiddleware(req, res, next);
  });
  app.use(express.static('public')); // Serve static files from 'public' directory


const licensePool = new Pool({
    connectionString: 'postgresql://postgres.qpszaxwluhfbpqlufqlc:07822818032Dd@@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

const pool = new Pool({
    connectionString: 'postgresql://postgres.eswevtufxxliyluwlafd:07822818032Aa@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});



  const ALL_PERMISSIONS = {
      "الطلاب": [
          { key: "students:create", label: "إنشاء طالب" },
          { key: "students:read",   label: "عرض الطلاب" },
          { key: "students:update", label: "تعديل طالب" },
          { key: "students:delete", label: "حذف طالب" },
          { key: "students:import", label: "استيراد من Excel" }

      ],
      "المدرسون": [
          { key: "teachers:create", label: "إنشاء مدرس" },
          { key: "teachers:read",   label: "عرض المدرسين" },
          { key: "teachers:update", label: "تعديل مدرس" },
          { key: "teachers:delete", label: "حذف مدرس" }
      ],
      "الدرجات": [
          { key: "grades:create", label: "إدخال الدرجات" },
          { key: "grades:read",   label: "عرض الدرجات" },
          { key: "grades:update", label: "تعديل الدرجات" }
      ],
      "المالية": [
          { key: "finances:full_access", label: "وصول كامل للمالية" }
      ],
      "المستخدمون والصلاحيات": [
          { key: "users:create", label: "إنشاء مستخدم" },
          { key: "users:read",   label: "عرض المستخدمين" },
          { key: "users:update", label: "تعديل مستخدم (بما في ذلك الصلاحيات)" },
          { key: "users:delete", label: "حذف مستخدم" }
          ]
      ,"الشهادات والتأييدات": [
        { key: "certificates:create", label: "إنشاء وحفظ التأييدات" },
      ],
      "الإعدادات": [
          { key: "settings:update", label: "تحديث الإعدادات العامة" }
      ]
  };
  app.use(cors());
  app.use(express.json());
  app.use(express.static('public')); 
  app.get('/', (req, res) => res.redirect('/index.html'));

async function licenseMiddleware(req, res, next) {
    
    const clientMachineId = req.headers['x-device-fingerprint'];
    const clientIp = req.ip;

    
    if (clientMachineId) {
        console.log(`[CLIENT-INFO] Client Device Fingerprint: ${clientMachineId} from IP: ${clientIp}`);
    }

    console.log(`[AUTH-OK] Access granted for API route (server is licensed).`);
    next();
}
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'التوثيق مطلوب. لم يتم توفير توكن.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const userResult = await pool.query(
            `SELECT u.id, u.username, u.is_active, u.full_name,
                    u.permissions AS user_permissions, 
                    r.permissions AS role_permissions
             FROM users u 
             LEFT JOIN roles r ON u.role_id = r.id 
             WHERE u.id = $1`, 
            [decoded.userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
            return res.status(401).json({ error: 'المستخدم غير موجود أو غير نشط.' });
        }

        const user = userResult.rows[0];
        const rolePerms = user.role_permissions || {};
        const userPerms = user.user_permissions || {};
        const finalPermissionsSet = new Set();
        Object.values(rolePerms).flat().forEach(perm => finalPermissionsSet.add(perm));
        Object.values(userPerms).flat().forEach(perm => finalPermissionsSet.add(perm));
        
        req.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            permissions: Array.from(finalPermissionsSet) 
        };

        next();

    } catch (err) {
        console.error("❌ JWT Error:", err.message);
        let errorMessage = 'التوكن غير صالح أو منتهي الصلاحية.';
        if (err.name === 'JsonWebTokenError') {
            errorMessage = 'التوكن غير صالح.';
        } else if (err.name === 'TokenExpiredError') {
            errorMessage = 'انتهت صلاحية التوكن.';
        }
        return res.status(401).json({ error: errorMessage });
    }
};


const can = (action) => (req, res, next) => {
    console.log('\n--- PERMISSION CHECK ---');
    console.log(`- الإجراء المطلوب (Action Required): ${action}`);
    if (req.user) {
        console.log(`- المستخدم الحالي (User): ${req.user.username} (ID: ${req.user.id})`);
        console.log('- الصلاحيات المحسوبة للمستخدم (Permissions on User Object):');
        console.log(req.user.permissions);
    } else {
        console.log('- ⚠️ لم يتم العثور على بيانات المستخدم (req.user) في الطلب.');
    }

    if (req.user && Array.isArray(req.user.permissions) && req.user.permissions.includes(action)) {
        console.log('>>> ✅ النتيجة: تم منح الصلاحية (Permission GRANTED).');
        console.log('------------------------\n');
        return next(); 
    }

    console.log('>>> ❌ النتيجة: تم رفض الصلاحية (Permission DENIED).');
    console.log('------------------------\n');
    return res.status(403).json({ error: 'ليس لديك الصلاحية الكافية للقيام بهذا الإجراء.' });
};
 async function setupOutgoingTable() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.outgoing (
                id BIGSERIAL PRIMARY KEY,
                type TEXT NOT NULL,
                date DATE NOT NULL,
                book_number TEXT,
                quantity INTEGER,
                content TEXT,
                file_path TEXT,
                student_id BIGINT REFERENCES public.students(id) ON DELETE SET NULL,
                health_center TEXT,
                reason TEXT,
                endorsement_number TEXT,
                admin_name TEXT,
                academic_year TEXT,
                created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                modified_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL, 
                modification_notes TEXT 
            );
        `);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function setupDatabaseSchema() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const coreTableQueries = [
            `CREATE TABLE IF NOT EXISTS public.server_license (
                id SERIAL PRIMARY KEY,
                serial TEXT NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                verified BOOLEAN DEFAULT false
            );`,
            `CREATE TABLE IF NOT EXISTS public.roles (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                permissions JSONB NOT NULL,
                description TEXT
            );`,
            `CREATE TABLE IF NOT EXISTS public.users (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                full_name TEXT,
                role_id INTEGER REFERENCES public.roles(id) ON DELETE SET NULL,
                permissions JSONB,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.schools (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.classes (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                school_id BIGINT REFERENCES public.schools(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (name, school_id)
            );`,
            `CREATE TABLE IF NOT EXISTS public.divisions (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                class_id BIGINT REFERENCES public.classes(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (name, class_id)
            );`,
            `CREATE TABLE IF NOT EXISTS public.students (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                division_id BIGINT REFERENCES public.divisions(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.teachers (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                specialization TEXT,
                leave_quota INTEGER DEFAULT 0,
                fingerprints JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.lessons_list (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.referral_reasons (
                id SERIAL PRIMARY KEY,
                reason TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.health_centers (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.terms (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
        ];

        const dependentTableQueries = [
            `CREATE TABLE IF NOT EXISTS public.student_attendance_confirmations (
                id SERIAL PRIMARY KEY,
                student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE,
                academic_year TEXT NOT NULL,
                created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.class_subjects (
                id BIGSERIAL PRIMARY KEY,
                class_id BIGINT REFERENCES public.classes(id) ON DELETE CASCADE,
                subject TEXT NOT NULL,
                UNIQUE (class_id, subject)
            );`,
            `CREATE TABLE IF NOT EXISTS public.student_book_status (
                id BIGSERIAL PRIMARY KEY,
                student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
                subject_name TEXT NOT NULL,
                received BOOLEAN NOT NULL DEFAULT FALSE,
                received_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (student_id, subject_name)
            );`,
            `CREATE TABLE IF NOT EXISTS public.student_referrals (
                id SERIAL PRIMARY KEY,
                student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE,
                referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
                health_center TEXT NOT NULL,
                manager_name TEXT,
                reason TEXT,
                created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.teacher_subjects (
                id BIGSERIAL PRIMARY KEY,
                teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE CASCADE,
                subject TEXT NOT NULL
            );`,
            `CREATE TABLE IF NOT EXISTS public.student_grades (
                id BIGSERIAL PRIMARY KEY,
                student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE,
                teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE SET NULL,
                subject TEXT NOT NULL,
                month1_term1 NUMERIC(5,2),
                month2_term1 NUMERIC(5,2),
                mid_term NUMERIC(5,2),
                month1_term2 NUMERIC(5,2),
                month2_term2 NUMERIC(5,2),
                final_exam NUMERIC(5,2),
                makeup_exam NUMERIC(5,2),
                term TEXT NOT NULL DEFAULT '2024-2025',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, subject, term)
            );`,
            `CREATE TABLE IF NOT EXISTS public.teacher_attendance (
                id BIGSERIAL PRIMARY KEY,
                teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
                entry_timestamp TIMESTAMP,
                exit_timestamp TIMESTAMP,
                status TEXT NOT NULL,
                attendance_date DATE NOT NULL,
                notes TEXT,
                reason_for_leave TEXT,
                leave_approval_status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`,
            `CREATE TABLE IF NOT EXISTS public.teacher_regular_days_off (
                id BIGSERIAL PRIMARY KEY,
                teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
                day_of_week INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (teacher_id, day_of_week),
                CONSTRAINT valid_day_of_week CHECK (day_of_week >= 0 AND day_of_week <= 6)
            );`,
            `CREATE TABLE IF NOT EXISTS public.weekly_schedule (
                id BIGSERIAL PRIMARY KEY,
                division_id BIGINT REFERENCES public.divisions(id) ON DELETE CASCADE,
                day_of_week INTEGER NOT NULL,
                period INTEGER NOT NULL,
                subject TEXT NOT NULL,
                teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE SET NULL,
                is_emergency_fill BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(division_id, day_of_week, period)
            );`,
            `CREATE TABLE IF NOT EXISTS public.class_fees (
                id BIGSERIAL PRIMARY KEY,
                class_id BIGINT REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
                academic_year TEXT NOT NULL DEFAULT '2024-2025',
                total_fee NUMERIC(10, 2) NOT NULL,
                default_installments INTEGER DEFAULT 1,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (class_id, academic_year)
            );`,

               `CREATE TABLE IF NOT EXISTS public.student_payment_plans (
                id BIGSERIAL PRIMARY KEY,
                student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
                class_fee_id BIGINT REFERENCES public.class_fees(id) ON DELETE RESTRICT NOT NULL,
                payment_type TEXT NOT NULL,
                total_amount_due NUMERIC(10, 2) NOT NULL,
                number_of_installments INTEGER,
                down_payment_amount NUMERIC(10, 2) DEFAULT 0.00, 
                status TEXT DEFAULT 'pending_setup',
                notes TEXT,
                total_paid_so_far NUMERIC(10, 2) DEFAULT 0.00, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (student_id, class_fee_id)
            );`,
            `CREATE TABLE IF NOT EXISTS public.teacher_lessons (
                teacher_id BIGINT PRIMARY KEY REFERENCES public.teachers(id) ON DELETE CASCADE,
                total_lessons INTEGER NOT NULL
            );`,
            `CREATE TABLE IF NOT EXISTS public.student_installments (
                id BIGSERIAL PRIMARY KEY,
                payment_plan_id BIGINT REFERENCES public.student_payment_plans(id) ON DELETE CASCADE NOT NULL,
                installment_number INTEGER NOT NULL,
                due_date DATE NOT NULL,
                amount_due NUMERIC(10, 2) NOT NULL,
                amount_paid NUMERIC(10, 2) DEFAULT 0.00,
                payment_date DATE,
                status TEXT DEFAULT 'pending',
                payment_method TEXT,
                transaction_reference TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (payment_plan_id, installment_number)
            );`,
            `CREATE TABLE IF NOT EXISTS public.student_certificates (
                id BIGSERIAL PRIMARY KEY,
                student_id BIGINT REFERENCES public.students(id) ON DELETE CASCADE,
                certificate_number INTEGER NOT NULL,
                issue_date DATE NOT NULL,
                recipient TEXT,
                academic_year TEXT,
                director_full_name TEXT,
                school_name TEXT,
                student_name_at_issue TEXT,
                student_class_at_issue TEXT,
                created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );`
        ];

        for (const query of coreTableQueries) {
            await client.query(query);
        }

        for (const query of dependentTableQueries) {
            await client.query(query);
        }
        await client.query(`ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS director_name TEXT;`);

        await client.query(`ALTER TABLE public.outgoing ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;`);
        await client.query(`ALTER TABLE public.outgoing ADD COLUMN IF NOT EXISTS modified_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE public.outgoing ADD COLUMN IF NOT EXISTS modification_notes TEXT;`);
        await client.query(`ALTER TABLE public.student_certificates ADD COLUMN IF NOT EXISTS outgoing_id BIGINT REFERENCES public.outgoing(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE public.student_referrals ADD COLUMN IF NOT EXISTS outgoing_id BIGINT REFERENCES public.outgoing(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE public.student_installments ADD COLUMN IF NOT EXISTS receipt_code TEXT;`);
        await client.query(`ALTER TABLE public.student_payment_plans ADD COLUMN IF NOT EXISTS total_paid_so_far NUMERIC(10, 2) DEFAULT 0.00;`);
        await client.query(`ALTER TABLE public.student_referrals ADD COLUMN IF NOT EXISTS created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL;`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS parent_phone TEXT`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender TEXT`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS barcode TEXT`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS notes TEXT`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT`);
        await client.query(`ALTER TABLE public.students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS base_salary NUMERIC(10, 2) DEFAULT 0.00;`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS public.teacher_salaries (
            id BIGSERIAL PRIMARY KEY,
            teacher_id BIGINT REFERENCES public.teachers(id) ON DELETE CASCADE NOT NULL,
            payment_date DATE NOT NULL,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            base_salary NUMERIC(10, 2) NOT NULL,
            absences_count INTEGER DEFAULT 0,
            deduction_amount NUMERIC(10, 2) DEFAULT 0.00,
            final_amount_paid NUMERIC(10, 2) NOT NULL,
            receipt_number TEXT UNIQUE NOT NULL,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(teacher_id, month, year)
        );
    `);
await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'unique_outgoing_id_cert'
        ) THEN
            ALTER TABLE public.student_certificates ADD CONSTRAINT unique_outgoing_id_cert UNIQUE (outgoing_id);
        END IF;
    END$$;
`);

await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'unique_outgoing_id_ref'
        ) THEN
            ALTER TABLE public.student_referrals ADD CONSTRAINT unique_outgoing_id_ref UNIQUE (outgoing_id);
        END IF;
    END$$;
`);


      await client.query(`
        CREATE TABLE IF NOT EXISTS public.teacher_salary_reports (
            id BIGSERIAL PRIMARY KEY,
            report_date DATE NOT NULL,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL,
            total_paid NUMERIC(12, 2) NOT NULL,
            total_deductions NUMERIC(12, 2) NOT NULL,
            teacher_count INTEGER NOT NULL,
            report_number TEXT UNIQUE NOT NULL,
            report_data JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `);

        await client.query(`ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS fingerprints JSONB DEFAULT '[]'::jsonb;`);
        await client.query(`ALTER TABLE public.teacher_attendance ADD COLUMN IF NOT EXISTS leave_approval_status TEXT`);
        await client.query(`ALTER TABLE public.teacher_attendance ADD COLUMN IF NOT EXISTS reason_for_leave TEXT`);
        await client.query(`ALTER TABLE public.absences ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'غياب';`);
        await client.query(`ALTER TABLE public.absences ALTER COLUMN date TYPE TEXT USING date::TEXT;`);
        await client.query(`ALTER TABLE public.absences ADD COLUMN IF NOT EXISTS notes TEXT;`);
        await client.query(`ALTER TABLE public.absences ADD COLUMN IF NOT EXISTS subject TEXT;`);
        await client.query(`ALTER TABLE public.absences ADD COLUMN IF NOT EXISTS lesson TEXT;`);   
        await client.query(`ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS s3 NUMERIC(5,2);`);
        await client.query(`ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS final_grade NUMERIC(5,2);`);
        await client.query(`ALTER TABLE public.server_license ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;`);
        await client.query(`ALTER TABLE public.weekly_schedule ADD COLUMN IF NOT EXISTS is_emergency_fill BOOLEAN DEFAULT FALSE`);
        
        try {
            await client.query(`ALTER TABLE public.teacher_attendance DROP CONSTRAINT IF EXISTS teacher_attendance_teacher_id_attendance_date_key;`);
        } catch (e) {
        }
        
        const uniqueAttendanceConstraintExists = await client.query(`
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'teacher_attendance' AND constraint_type = 'UNIQUE' AND constraint_name = 'teacher_attendance_unique_per_day'
        `);
        if (uniqueAttendanceConstraintExists.rowCount === 0) {
            await client.query(`
                ALTER TABLE public.teacher_attendance
                ADD CONSTRAINT teacher_attendance_unique_per_day
                UNIQUE (teacher_id, attendance_date)
            `);
        }

        const uniqueBarcodeConstraintExists = await client.query(`
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'students' AND constraint_type = 'UNIQUE' AND constraint_name = 'unique_barcode'
        `);
        if (uniqueBarcodeConstraintExists.rowCount === 0) {
            try {
                await client.query(`ALTER TABLE public.students ADD CONSTRAINT unique_barcode UNIQUE (barcode)`);
            } catch (uniqueErr) {
            }
        }

        await client.query(`
            CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            SET search_path = pg_catalog, public;
        `);

        const tables_to_trigger = ['public.class_fees', 'public.student_payment_plans', 'public.student_installments', 'public.students'];
        for (const table_name of tables_to_trigger) {
            await client.query(`
                DROP TRIGGER IF EXISTS set_timestamp ON ${table_name};
                CREATE TRIGGER set_timestamp
                BEFORE UPDATE ON ${table_name}
                FOR EACH ROW
                EXECUTE PROCEDURE public.trigger_set_timestamp();
            `);
        }

        await client.query(`ALTER TABLE public.student_payment_plans ADD COLUMN IF NOT EXISTS down_payment_amount NUMERIC(10, 2) DEFAULT 0.00;`);
        await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'student_installments_receipt_code_key'
        ) THEN
            ALTER TABLE public.student_installments ADD CONSTRAINT student_installments_receipt_code_key UNIQUE (receipt_code);
        END IF;
    END$$;
`);

        await client.query(`
            CREATE OR REPLACE FUNCTION public.update_installment_status_on_data_change()
            RETURNS TRIGGER AS $$
            DECLARE
                v_payment_plan_id BIGINT;
                v_all_paid BOOLEAN;
                v_has_overdue BOOLEAN;
                v_today DATE := CURRENT_DATE;
            BEGIN
                IF TG_OP = 'DELETE' THEN
                    v_payment_plan_id := OLD.payment_plan_id;
                ELSE
                    v_payment_plan_id := NEW.payment_plan_id;
                END IF;

                IF v_payment_plan_id IS NULL THEN
                    RETURN NULL;
                END IF;

                SELECT
                    BOOL_AND(si.status IN ('paid', 'waived')),
                    BOOL_OR((si.status IN ('pending', 'partially_paid')) AND si.due_date < v_today AND si.amount_paid < si.amount_due)
                INTO
                    v_all_paid,
                    v_has_overdue
                FROM public.student_installments si
                WHERE si.payment_plan_id = v_payment_plan_id;

                IF v_all_paid THEN
                    UPDATE public.student_payment_plans
                    SET status = 'fully_paid',
                        total_amount_due = (SELECT SUM(amount_due) FROM public.student_installments WHERE payment_plan_id = v_payment_plan_id),
                        updated_at = NOW()
                    WHERE id = v_payment_plan_id;
                ELSIF v_has_overdue THEN
                    UPDATE public.student_payment_plans
                    SET status = 'overdue_installments',
                        total_amount_due = (SELECT SUM(amount_due) FROM public.student_installments WHERE payment_plan_id = v_payment_plan_id),
                        updated_at = NOW()
                    WHERE id = v_payment_plan_id;
                ELSE
                    UPDATE public.student_payment_plans
                    SET status = 'active',
                        total_amount_due = (SELECT SUM(amount_due) FROM public.student_installments WHERE payment_plan_id = v_payment_plan_id),
                        updated_at = NOW()
                    WHERE id = v_payment_plan_id;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
            SET search_path = pg_catalog, public;
        `);

        await client.query(`
           CREATE OR REPLACE FUNCTION public.update_plan_financials_and_status()
RETURNS TRIGGER AS $$
DECLARE
    v_plan_id BIGINT;
    v_all_paid BOOLEAN;
    v_has_overdue BOOLEAN;
    v_today DATE := CURRENT_DATE;
BEGIN
    IF TG_TABLE_NAME = 'student_installments' THEN
        v_plan_id := NEW.payment_plan_id;
    ELSIF TG_TABLE_NAME = 'student_payment_plans' THEN
        v_plan_id := NEW.id;
    ELSE
        RETURN NEW;
    END IF;


    SELECT
        BOOL_AND(status IN ('paid', 'waived')),
        BOOL_OR((status IN ('pending', 'partially_paid')) AND due_date < v_today AND amount_paid < amount_due)
    INTO
        v_all_paid,
        v_has_overdue
    FROM public.student_installments
    WHERE payment_plan_id = v_plan_id;

    IF v_all_paid THEN
        UPDATE public.student_payment_plans SET status = 'fully_paid', updated_at = NOW() WHERE id = v_plan_id;
    ELSIF v_has_overdue THEN
        UPDATE public.student_payment_plans SET status = 'overdue_installments', updated_at = NOW() WHERE id = v_plan_id;
    ELSE
        UPDATE public.student_payment_plans SET status = 'active', updated_at = NOW() WHERE id = v_plan_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = pg_catalog, public;
`);

        const rolesToCreate = [
            { name: 'Admin', description: 'صلاحيات كاملة على النظام', permissions: {
                "الطلاب":["students:create","students:read","students:update","students:delete","students:import"],
                "المدرسون":["teachers:create","teachers:read","teachers:update","teachers:delete"],
                "الدرجات":["grades:create","grades:read","grades:update"],
                "المالية":["finances:full_access"],
                "المستخدمون والصلاحيات":["users:create","users:read","users:update","users:delete"],
                "الإعدادات":["settings:update"],
                "الشهادات والتأييدات":["certificates:create"]
            }},
            { name: 'معاون المدير', description: 'صلاحيات إدارية', permissions: {"الطلاب":["students:create","students:read","students:update","students:delete"],"المدرسون":["teachers:create","teachers:read","teachers:update"],"الدرجات":["grades:read"]} },
            { name: 'مدرس', description: 'صلاحيات لإدارة الدرجات', permissions: {"الطلاب":["students:read"],"الدرجات":["grades:create","grades:read","grades:update"]} },
            { name: 'متخصص بالنظام', description: 'صلاحيات تقنية', permissions: {"المستخدمون والصلاحيات":["users:read","users:update"],"الإعدادات":["settings:update"]} }
        ];

        for (const role of rolesToCreate) {
            await client.query(
                `INSERT INTO public.roles (name, description, permissions)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (name) DO UPDATE SET
                     description = EXCLUDED.description,
                     permissions = EXCLUDED.permissions;`,
                [role.name, role.description, JSON.stringify(role.permissions)]
            );
        }
        
        const usersCheck = await client.query('SELECT 1 FROM public.users WHERE username = \'admin\'');
        if (usersCheck.rowCount === 0) {
            const adminRole = await client.query("SELECT id FROM public.roles WHERE name = 'Admin' LIMIT 1");
            if (adminRole.rowCount > 0) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);
                await client.query(`INSERT INTO public.users (username, password_hash, full_name, role_id, is_active, permissions) VALUES ($1, $2, $3, $4, $5, $6)`,['admin', hashedPassword, 'المدير العام', adminRole.rows[0].id, true, null]);
            }
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function checkLicense() {
    console.log("Performing startup license check for the server itself...");
    const client = await licensePool.connect();
    try {
        const deviceResult = await client.query(
            `SELECT id, machine_id, is_enabled FROM authorized_devices WHERE machine_id = $1 AND is_enabled = true`,
            [SERVER_MACHINE_ID]
        );

        if (deviceResult.rows.length === 0) {
            console.warn(`[STARTUP-WARN] Server Machine ID ${SERVER_MACHINE_ID} is NOT in authorized_devices. Attempting to log to unauthorized_attempts.`);
            await client.query(
                `INSERT INTO unauthorized_attempts (machine_id, server_ip) VALUES ($1, $2)`,
                [SERVER_MACHINE_ID, '127.0.0.1']
            );
            console.error(`[STARTUP-FAIL] 🚫 هذا الخادم (Machine ID: ${SERVER_MACHINE_ID}) غير مصرح له. تم تسجيل المحاولة. يرجى تفعيله من لوحة تحكم التراخيص.`);
            process.exit(1);
        }

        const serverDeviceId = deviceResult.rows[0].id; 

        const now = new Date().toISOString().slice(0, 10);
        const licenseResult = await client.query(
            `SELECT sl.id
            FROM server_license sl
            JOIN license_device_link ldl ON sl.id = ldl.license_id
            WHERE ldl.device_id = $1 -- Check for link to this specific server's device ID
            AND sl.verified = true
            AND sl.is_active = true
            AND sl.start_date <= $2
            AND sl.end_date >= $2
            LIMIT 1`,
            [serverDeviceId, now] 
        );

        if (licenseResult.rows.length === 0) {
            console.error('[STARTUP-FAIL] 🚫 لا يمكن تشغيل الخادم: لا يوجد ترخيص فعال، موثوق، وساري *ومربوط بهذا الجهاز* في قاعدة البيانات.');
            process.exit(1);
        }

        console.log('✅ (Startup Check) الخادم مصرح له والترخيص ساري المفعول ومربوط بالجهاز.');

    } catch (err) {
        console.error("❌ Startup License Check DB Error:", err.message);
        process.exit(1);
    } finally {
        client.release();
    }
}

async function generateUniqueReceiptCode(client) {
    let receiptCode;
    let isUnique = false;
    let attempts = 0; 

    while (!isUnique && attempts < 10) {
        receiptCode = Math.floor(10000000 + Math.random() * 90000000).toString();

        const checkResult = await client.query(
            'SELECT 1 FROM student_installments WHERE receipt_code = $1',
            [receiptCode]
        );

        if (checkResult.rowCount === 0) {
            isUnique = true; 
        } else {
            attempts++; 
        }
    }

    if (!isUnique) {
        return `ERR-${Date.now()}`;
    }

    return receiptCode;
}

async function retryOperation(operation, maxRetries = 5, delay = 2000) {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            await operation();
            return; 
        } catch (err) {
            if (err.code === '40P01') {
                console.warn(`⚠️ Deadlock detected. Retrying setup... (Attempt ${retries + 1}/${maxRetries})`);
                retries++;
                await new Promise(res => setTimeout(res, delay)); 
            } else {

                throw err;
            }
        }
    }
    throw new Error(`Failed after ${maxRetries} retries due to persistent deadlock or other error.`);
}

pool.connect()
    .then(async () => {
        console.log("✅ Connected to Supabase PostgreSQL");
        try {

            await retryOperation(async () => {
                await ensureScheduleTableExists();
                console.log("✅ ensureScheduleTableExists completed.");
            });
            
            await retryOperation(async () => {
                await setupDatabaseSchema();
                console.log("✅ setupDatabaseSchema completed.");
            });


             await retryOperation(async () => {
                await setupDynamicFieldsTables();
                console.log("✅ setupDynamicFieldsTables completed.");
            });
             await checkLicense();

            await retryOperation(async () => {
                await setupOutgoingTable();
                console.log("✅ setupOutgoingTable completed.");
            });

            console.log("✅ All database schema setup completed successfully.");

        } catch (setupError) {
            console.error("❌ Fatal error during database schema setup:", setupError.message, setupError.stack);

        }
    })
    .catch(err => console.error("❌ Initial PostgreSQL connection failed:", err.message, err.stack));



  app.post('/api/schools', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'School name is required' });
    try {
      const result = await pool.query('INSERT INTO schools (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/schools', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM schools ORDER BY id DESC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/next-referral-id', async (req, res) => {
    try {
      const result = await pool.query(`SELECT MAX(id) + 1 AS next_id FROM student_referrals`);
      const nextId = result.rows[0].next_id || 1;
      res.json({ next_id: nextId });
    } catch (err) {
      console.error('Error fetching next referral ID:', err.message);
      res.status(500).json({ error: 'Failed to get next referral ID' });
    }
  });

  app.post('/api/student-referrals', authMiddleware, async (req, res) => {
    const { student_id, referral_date, health_center, reason } = req.body;
    const created_by_user_id = req.user.id;
    const admin_full_name = req.user.full_name; 

    if (!student_id || !health_center) {
        return res.status(400).json({ error: 'student_id و health_center مطلوبة' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const studentRes = await client.query('SELECT name FROM students WHERE id = $1', [student_id]);
        const studentName = studentRes.rows[0]?.name || 'طالب غير معروف';

        const outgoingContent = `إحالة إلى ${health_center}: بخصوص الطالب/ة ${studentName}. السبب: ${reason || ''}`;
        const outgoingBookNumber = `إحالة/${Date.now()}`;
        const outgoingEndorsementNumber = health_center; 

        const outgoingResult = await client.query(
            `INSERT INTO outgoing (
                type, date, book_number, content,
                student_id, health_center, reason, endorsement_number,
                admin_name, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
            [
                'إحالة مركز صحي', 
                referral_date || new Date().toISOString().split('T')[0],
                outgoingBookNumber,
                outgoingContent,
                student_id,
                health_center,
                reason || null,
                outgoingEndorsementNumber,
                admin_full_name, 
                created_by_user_id
            ]
        );
        const newOutgoingId = outgoingResult.rows[0].id; 

        const referralResult = await client.query(
            `INSERT INTO student_referrals (student_id, referral_date, health_center, manager_name, reason, created_by, outgoing_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [student_id, referral_date || new Date().toISOString().split('T')[0], health_center, admin_full_name, reason, created_by_user_id, newOutgoingId]
        );

        await client.query('COMMIT');
        res.status(201).json(referralResult.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error saving referral and outgoing record:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to save referral: ' + err.message });
    } finally {
        client.release();
    }
});


  app.delete('/api/schools/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM schools WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'School not found' });
      }
      res.status(200).json({ message: 'School deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put('/api/schools/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'School name is required' });

    try {
      const result = await pool.query('UPDATE schools SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'School not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/classes', async (req, res) => {
    const { name, school_id } = req.body;
    if (!name || !school_id) return res.status(400).json({ error: 'Class name and school ID are required' });
    try {
      const result = await pool.query(
        'INSERT INTO classes (name, school_id) VALUES ($1, $2) RETURNING *',
        [name, school_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/schools/:school_id/classes', async (req, res) => {
    const { school_id } = req.params;
    try {
      const result = await pool.query('SELECT * FROM classes WHERE school_id = $1 ORDER BY id', [school_id]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Class name is required' });

    try {
      const result = await pool.query('UPDATE classes SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Class not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Class not found' });
      }
      res.status(200).json({ message: 'Class deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/classes', async (req, res) => {
    try {
      const result = await pool.query('SELECT c.*, s.name as school_name FROM classes c JOIN schools s ON c.school_id = s.id ORDER BY s.name, c.name ASC');
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching classes:', err.message);
      res.status(500).json({ error: 'Failed to fetch classes' });
    }
  });

  app.post('/api/divisions', async (req, res) => {
    const { name, class_id } = req.body;
    if (!name || !class_id) return res.status(400).json({ error: 'Division name and class ID are required' });
    try {
      const result = await pool.query(
        'INSERT INTO divisions (name, class_id) VALUES ($1, $2) RETURNING *',
        [name, class_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/classes/:class_id/divisions', async (req, res) => {
    const { class_id } = req.params;
    try {
      const result = await pool.query('SELECT * FROM divisions WHERE class_id = $1 ORDER BY name', [class_id]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/divisions/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Division name is required' });

    try {
      const result = await pool.query('UPDATE divisions SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Division not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/divisions/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM divisions WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Division not found' });
      }
      res.status(200).json({ message: 'Division deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/divisions', async (req, res) => {
    try {
      const result = await pool.query(`
          SELECT d.*, c.name as class_name, s.name as school_name
          FROM divisions d
          JOIN classes c ON d.class_id = c.id
          JOIN schools s ON c.school_id = s.id
          ORDER BY s.name, c.name, d.name ASC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching divisions:', err.message);
      res.status(500).json({ error: 'Failed to fetch divisions' });
    }
  });


  app.post('/api/students', upload.single('photo'), async (req, res) => {
    const { student_name, division_id, parent_phone, gender, barcode, notes, telegram_chat_id } = req.body;
    const photo_url = req.file ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}` : null;

    if (!student_name || !division_id)
      return res.status(400).json({ error: 'Name and division are required' });

    try {
      const result = await pool.query(
        `INSERT INTO students (name, division_id, parent_phone, gender, barcode, notes, photo_url, telegram_chat_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [student_name, division_id, parent_phone, gender, barcode, notes, photo_url, telegram_chat_id]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("❌ Error in POST /api/students:", err.message, err.stack);
      if (err.code === '23505' && err.constraint === 'unique_barcode') {
          return res.status(409).json({ error: 'Barcode already exists. Please use a unique barcode.' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/students', async (req, res) => {
    const { division_id, class_id, school_id } = req.query; 
    let query = `
      SELECT 
        s.id, 
        s.name, 
        s.barcode,
        s.parent_phone,
        s.gender, 
        s.telegram_chat_id, 
        s.division_id,
        d.name AS division_name, 
        d.class_id,
        c.name AS class_name, 
        c.school_id,
        sch.name AS school_name,
        s.photo_url
      FROM students s
      JOIN divisions d ON s.division_id = d.id
      JOIN classes c ON d.class_id = c.id
      JOIN schools sch ON c.school_id = sch.id
    `;
    const queryParams = [];
    const conditions = [];
    let paramIndex = 1;

    if (division_id) {
      conditions.push(`s.division_id = $${paramIndex++}`);
      queryParams.push(division_id);
    }
    if (class_id) {
      conditions.push(`d.class_id = $${paramIndex++}`);
      queryParams.push(class_id);
    }
    if (school_id) {
      conditions.push(`c.school_id = $${paramIndex++}`);
      queryParams.push(school_id);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY sch.name, c.name, d.name, s.name ASC`;

    try {
      const result = await pool.query(query, queryParams);
      res.json(result.rows);
    } catch (err) {
      console.error('❌ Error fetching students:', err.message);
      res.status(500).json({ error: err.message });
    }

  });

  app.put('/api/students/:id', upload.single('photo'), async (req, res) => {
    const { id } = req.params;

    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      const updates = [];
      const values = [];
      let placeholderIndex = 1;

      const fieldMappings = {
          student_name: 'name',
          parent_phone: 'parent_phone',
          barcode: 'barcode',
          gender: 'gender',
          notes: 'notes',
          division_id: 'division_id' 
      };
      
      for (const key in req.body) {
          if (Object.prototype.hasOwnProperty.call(req.body, key) && fieldMappings[key]) {
              updates.push(`${fieldMappings[key]} = $${placeholderIndex++}`);
              values.push(req.body[key]);
          }
      }

      if (updates.length === 0) {
          return res.status(400).json({ error: 'No valid fields provided for update.' });
      }

      values.push(id); 
      const queryText = `UPDATE students SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${placeholderIndex} RETURNING *`;

      try {
          const result = await pool.query(queryText, values);
          if (result.rows.length === 0) {
              return res.status(404).json({ error: 'Student not found' });
          }
          return res.json(result.rows[0]);
      } catch (err) {
          console.error("❌ Error in PUT /api/students (JSON):", err.message, err.stack);
          if (err.code === '23505' && err.constraint === 'unique_barcode') {
              return res.status(409).json({ error: 'Barcode already exists. Please use a unique barcode.' });
          }
          return res.status(500).json({ error: err.message });
      }
    } else {
      const { student_name, division_id, parent_phone, gender, barcode, notes, existing_photo_url , telegram_chat_id } = req.body;
      let photo_url = existing_photo_url;

      if (req.file) { 
          photo_url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
      }

      if (!student_name || !division_id) {
          return res.status(400).json({ error: 'Name and division are required for full update.' });
      }
      
      try {
          const result = await pool.query(
              `UPDATE students 
    SET name = $1, division_id = $2, parent_phone = $3, gender = $4, barcode = $5, notes = $6, photo_url = $7, telegram_chat_id = $8, updated_at = CURRENT_TIMESTAMP            WHERE id = $9 RETURNING *`,
              [student_name, division_id, parent_phone, gender, barcode, notes, photo_url, telegram_chat_id, id]
          );
          if (result.rows.length === 0) {
              return res.status(404).json({ error: 'Student not found' });
          }
          res.json(result.rows[0]);
      } catch (err) {
          console.error("❌ Error in PUT /api/students (form-data):", err.message, err.stack);
          if (err.code === '23505' && err.constraint === 'unique_barcode') {
              return res.status(409).json({ error: 'Barcode already exists. Please use a unique barcode.' });
          }
          res.status(500).json({ error: err.message });
      }
    }
  });

  app.delete('/api/students/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }
      res.status(200).json({ message: 'Student deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/students-details/:id', async (req, res) => {
    const studentId = req.params.id;
    try {
      const result = await pool.query(`
        SELECT
          s.id AS student_id, 
          s.name AS student_name, 
          s.parent_phone,
          s.gender,
          s.barcode,
          s.notes,
          s.photo_url,
          s.division_id, 
          d.name AS division_name,
          d.class_id, 
          c.name AS class_name,
          c.school_id,
          sch.name AS school_name 
        FROM students s
        LEFT JOIN divisions d ON s.division_id = d.id
        LEFT JOIN classes c ON d.class_id = c.id
        LEFT JOIN schools sch ON c.school_id = sch.id
        WHERE s.id = $1
      `, [studentId]);

      if (result.rows.length === 0)
        return res.status(404).json({ error: 'Student not found' });

      res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ Failed to fetch student details:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/absences', async (req, res) => {
    const absences = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];
    const errors = [];

    for (const item of absences) {
      const { student_id, type, date, notes, subject, lesson } = item;

      if (!student_id || !date) {
        errors.push({ student_id, error: 'Student ID and date are required' });
        continue;
      }

      const formattedDate = date.split('T')[0];

      try {
        const result = await pool.query(
          'INSERT INTO absences (student_id, type, date, notes, subject, lesson) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
          [student_id, type || 'غياب', formattedDate, notes || '', subject || null, lesson || null]
        );
        results.push(result.rows[0]);
      } catch (err) {
        errors.push({ student_id, error: err.message });
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({ message: 'تم تنفيذ بعض السجلات مع وجود أخطاء.', results, errors });
    } else {
      return res.status(201).json({ message: 'تم تسجيل جميع الغيابات بنجاح.', results });
    }
  });

  app.delete('/api/absences/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM absences WHERE id = $1', [id]);
      res.json({ message: 'Deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/students/:id/absences', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query(
        'SELECT id, date, type, notes, subject, lesson, created_at FROM absences WHERE student_id = $1 ORDER BY date DESC',
        [id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching absences:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

app.get('/api/students-with-absences', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          s.id,
          s.name,
          s.barcode, 
          s.division_id,
          d.class_id,
          d.name AS division_name,
          c.name AS class_name,
          sch.id AS school_id, 
          sch.name AS school_name,
          COUNT(CASE WHEN a.type = 'غياب' THEN 1 END) AS absence_count,
          COUNT(CASE WHEN a.type = 'درس' THEN 1 END) AS lesson_count,
          COUNT(CASE WHEN a.type = 'إجازة' THEN 1 END) AS leave_count
        FROM students s
        LEFT JOIN absences a ON s.id = a.student_id
        LEFT JOIN divisions d ON s.division_id = d.id
        LEFT JOIN classes c ON d.class_id = c.id
        LEFT JOIN schools sch ON c.school_id = sch.id
        GROUP BY s.id, s.name, s.barcode, s.division_id, d.class_id, d.name, c.name, sch.id, sch.name -- ✅ أضف sch.id هنا
        ORDER BY s.name;
      `);
      
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

  app.put('/api/absences/:id', async (req, res) => {
    const { id } = req.params;
    const { date, type, notes, subject, lesson } = req.body; 

    const formattedDate = date.split('T')[0]; 

    try {
      const result = await pool.query(
        'UPDATE absences SET date = $1, type = $2, notes = $3, subject = $4, lesson = $5 WHERE id = $6 RETURNING *',
        [formattedDate, type, notes || '', subject || null, lesson || null, id] 
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('❌ Error updating absence:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

app.get('/api/all-absences-detailed', async (req, res) => {
    const { date, school_id, class_id, division_id, subject, lesson } = req.query;
    let queryText = `
        SELECT 
          a.id AS absence_id,
          a.date,
          a.lesson,
          a.subject,
          a.type AS absence_type,
          a.notes AS absence_notes,
          s.id AS student_id,
          s.name AS student_name,
          s.barcode AS student_barcode,
          s.parent_phone,
          s.gender,
          d.name AS division_name,
          c.name AS class_name,
          sch.name AS school_name,
          t.name AS teacher_name
        FROM absences a
        JOIN students s ON a.student_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN classes c ON d.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        LEFT JOIN teacher_subjects ts ON a.subject = ts.subject 
        LEFT JOIN teachers t ON ts.teacher_id = t.id 
        WHERE 1=1
      `;
      const queryParams = [];
      let paramIndex = 1;

    // --- START: The Corrected Code Block ---
    // هذا هو الجزء الذي تم تعديله. الآن يتم الفلترة حسب التاريخ المحدد فقط.
    if (date) {
        queryText += ` AND a.date::DATE = $${paramIndex++}::DATE`;
        queryParams.push(date);
    }

    if (subject) {
        queryText += ` AND a.subject ILIKE $${paramIndex++}`;
        queryParams.push(`%${subject}%`);
    }
    if (lesson) {
        queryText += ` AND a.lesson ILIKE $${paramIndex++}`;
        queryParams.push(`%${lesson}%`);
    }
    if (division_id) {
        queryText += ` AND s.division_id = $${paramIndex++}`;
        queryParams.push(division_id);
    } else if (class_id) {
        queryText += ` AND d.class_id = $${paramIndex++}`;
        queryParams.push(class_id);
    } else if (school_id) {
        queryText += ` AND c.school_id = $${paramIndex++}`;
        queryParams.push(school_id);
    }

    queryText += ` ORDER BY a.date DESC, sch.name, c.name, d.name, s.name;`;

    try {
      const result = await pool.query(queryText, queryParams);
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching all absences detailed:", err.message, err.stack);
      res.status(500).json({ error: "فشل في جلب بيانات الغياب المفصلة" });
    }
});

  app.post('/api/teachers', async (req, res) => {
    const { name, phone, email, specialization, subjects, leave_quota } = req.body;
    if (!name) return res.status(400).json({ error: 'Teacher name is required' });
    try {
      const teacherResult = await pool.query(
        `INSERT INTO teachers (name, phone, email, specialization, leave_quota)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, phone, email, specialization, leave_quota || 0] 
      );
      const teacher = teacherResult.rows[0];
      
      if (subjects && Array.isArray(subjects)) {
        for (const subject of subjects) {
          await pool.query(
            `INSERT INTO teacher_subjects (teacher_id, subject) VALUES ($1, $2)`,
            [teacher.id, subject]
          );
        }
      }

      res.status(201).json(teacher);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/teachers/:id', async (req, res) => {
    const { id } = req.params;
    const fields = ['name', 'phone', 'email', 'specialization', 'subjects', 'leave_quota'];
    const updates = [];
    const values = [];
    let index = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined && field !== 'subjects') { 
        updates.push(`${field} = $${index++}`);
        values.push(req.body[field]);
      }
    }

    const client = await pool.connect(); 

    try {
      await client.query('BEGIN'); 

      if (updates.length > 0) {
        const queryText = `UPDATE teachers SET ${updates.join(', ')} WHERE id = $${index} RETURNING *`;
        values.push(id); 
        const updateResult = await client.query(queryText, values);
        if (updateResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Teacher not found' });
        }
      }

      if (req.body.subjects && Array.isArray(req.body.subjects)) {
        await client.query(`DELETE FROM teacher_subjects WHERE teacher_id = $1`, [id]);
        for (const subject of req.body.subjects) {
          if (subject) { 
              await client.query(`INSERT INTO teacher_subjects (teacher_id, subject) VALUES ($1, $2)`, [id, subject]);
          }
        }
      }
      
      await client.query('COMMIT'); 
      const updatedTeacherResult = await client.query(`
          SELECT t.*, COALESCE(json_agg(ts.subject) FILTER (WHERE ts.subject IS NOT NULL), '[]') AS subjects
          FROM teachers t
          LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id
          WHERE t.id = $1
          GROUP BY t.id
      `, [id]);

      res.json(updatedTeacherResult.rows[0] || { message: 'Updated successfully, but no teacher data returned (edge case).' });

    } catch (err) {
      await client.query('ROLLBACK'); 
      console.error("❌ Error updating teacher:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.put('/api/teachers/:id/quota', async (req, res) => {
    const { id } = req.params;
    const { quota } = req.body;

    if (quota === undefined || isNaN(parseInt(quota)) || parseInt(quota) < 0) {
      return res.status(400).json({ error: 'حصة الإجازات يجب أن تكون رقماً غير سالب.' });
    }

    try {
      const result = await pool.query(
        'UPDATE teachers SET leave_quota = $1 WHERE id = $2 RETURNING id, name, leave_quota',
        [parseInt(quota), id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'لم يتم العثور على الأستاذ.' });
      }
      res.json({ message: 'تم تحديث حصة الإجازات بنجاح.', teacher: result.rows[0] });
    } catch (err) {
      console.error("❌ Error updating teacher quota:", err.message);
      res.status(500).json({ error: 'فشل في تحديث حصة الإجازات: ' + err.message });
    }
  });


  app.delete('/api/teachers/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM teachers WHERE id = $1', [id]);
      res.json({ message: 'Teacher deleted' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  const globalTeacherAvailability = {};

  function calculatePlacementScore(lesson, division_id, day, period, scheduleGrids, teacherData, globalTeacherAvailability) {
    if (scheduleGrids[division_id][day][period] !== null) return -1;
    if (globalTeacherAvailability[lesson.teacher_id][day][period]) return -1;
    if (teacherData.day_off.includes(day)) return -1;

    const subjectTaughtToday = scheduleGrids[division_id][day].some(cell => cell?.subject === lesson.subject);
    if (subjectTaughtToday) return -1;

    let score = 100;
    score -= period * 5; 

    const lessonsTodayForTeacher = scheduleGrids[division_id][day].filter(cell => cell?.teacher_id === lesson.teacher_id).length;
    score -= lessonsTodayForTeacher * 20; 
    return score;
  }

  function calculateDistributionScore(scheduleGrids, teacherLessonsMap) {
      const teacherUsage = {};
      let totalLessonsAssigned = 0;
      let totalLessonsToAssign = 0;

      for (const teacher_id in teacherLessonsMap) {
          teacherUsage[teacher_id] = { used: 0, total: teacherLessonsMap[teacher_id].total };
          totalLessonsToAssign += teacherLessonsMap[teacher_id].total;
      }

      for (const division_id in scheduleGrids) {
          for (let day = 0; day < 5; day++) {
              for (let period = 0; period < 7; period++) {
                  const cell = scheduleGrids[division_id][day][period];
                  if (cell) {
                      totalLessonsAssigned++;
                      if (teacherUsage[cell.teacher_id]) {
                          teacherUsage[cell.teacher_id].used++;
                      }
                  }
              }
          }
      }
      
      if (totalLessonsToAssign === 0) return 100; 
      
      const coverageScore = (totalLessonsAssigned / totalLessonsToAssign) * 100;
      
      return coverageScore;
  }


  app.post('/api/generate-schedule', async (req, res) => {
    const { division_ids, teacher_lessons } = req.body;

    console.log('Received request:', { division_ids, teacher_lessons_count: teacher_lessons?.length });

    if (!Array.isArray(division_ids) || division_ids.length === 0) {
      return res.status(400).json({ error: 'معرفات الشعب مطلوبة' });
    }
    if (!Array.isArray(teacher_lessons) || teacher_lessons.length === 0) {
      return res.status(400).json({ error: 'يجب تحديد دروس المعلمين' });
    }

    const globalTeacherAvailability = {};

    try {
      const teacherLessonsMap = {};
      for (const entry of teacher_lessons) {
        const { teacher_id, total_lessons } = entry;
        const subjectResult = await pool.query('SELECT subject FROM teacher_subjects WHERE teacher_id = $1', [teacher_id]);
        const dayOffResult = await pool.query('SELECT day_of_week FROM teacher_regular_days_off WHERE teacher_id = $1', [teacher_id]);
        
        const subject = subjectResult.rows[0]?.subject;
        if (!subject) {
          const teacherNameRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacher_id]);
          return res.status(400).json({ error: `المعلم ${teacherNameRes.rows[0]?.name || teacher_id} ليس لديه مادة مسجلة.` });
        }

        teacherLessonsMap[teacher_id] = {
          total: total_lessons,
          subject: subject,
          day_off: dayOffResult.rows.map(r => r.day_of_week)
        };
        globalTeacherAvailability[teacher_id] = Array.from({ length: 5 }, () => Array(7).fill(false));
      }

      await pool.query('DELETE FROM weekly_schedule WHERE division_id = ANY($1)', [division_ids]);

      let bestSchedule = null;
      let minEmptyCells = Infinity;
      let finalLessonsPool = [];

      const maxSmartAttempts = 50;
      
      let lessonsPoolTemplate = [];
      for (const [teacher_id, data] of Object.entries(teacherLessonsMap)) {
          for (let i = 0; i < data.total; i++) {
              lessonsPoolTemplate.push({ teacher_id: parseInt(teacher_id), subject: data.subject });
          }
      }

      for (let attempt = 1; attempt <= maxSmartAttempts; attempt++) {
          let currentGrids = {};
          division_ids.forEach(id => {
              currentGrids[id] = Array.from({ length: 5 }, () => Array(7).fill(null));
          });
          
          let currentGlobalAvailability = JSON.parse(JSON.stringify(globalTeacherAvailability));
          let lessonsPool = [...lessonsPoolTemplate].sort(() => Math.random() - 0.5);

          for (const division_id of division_ids) {
              for (let day = 0; day < 5; day++) {
                  for (let period = 0; period < 7; period++) {
                      let bestLessonIndex = -1;
                      let maxScore = -Infinity;

                      for (let i = 0; i < lessonsPool.length; i++) {
                          const lesson = lessonsPool[i];
                          const teacherData = teacherLessonsMap[lesson.teacher_id];
                          
                          const isTeacherBusy = currentGlobalAvailability[lesson.teacher_id][day][period];
                          const isTeacherOff = teacherData.day_off.includes(day);
                          const isSubjectTaughtToday = currentGrids[division_id][day].some(cell => cell?.subject === lesson.subject);

                          if (isTeacherBusy || isTeacherOff || isSubjectTaughtToday) continue;

                          let score = 100 - (period * 5);
                          
                          if (score > maxScore) {
                              maxScore = score;
                              bestLessonIndex = i;
                          }
                      }

                      if (bestLessonIndex !== -1) {
                          const placedLesson = lessonsPool.splice(bestLessonIndex, 1)[0];
                          currentGrids[division_id][day][period] = { teacher_id: placedLesson.teacher_id, subject: placedLesson.subject };
                          currentGlobalAvailability[placedLesson.teacher_id][day][period] = true;
                      }
                  }
              }
          }
          
          const emptyCellsCount = Object.values(currentGrids).flat(2).filter(c => !c).length;

          if (emptyCellsCount < minEmptyCells) {
              minEmptyCells = emptyCellsCount;
              bestSchedule = JSON.parse(JSON.stringify(currentGrids));
              console.log(`[محاولة ذكية ${attempt}] وجدت جدولا أفضل بـ ${minEmptyCells} خانة فارغة.`);
          }

          if (minEmptyCells === 0) {
              console.log(`✅ تم العثور على جدول مثالي في المحاولة رقم ${attempt}!`);
              break; 
          }
      }

      const scheduledLessonsCount = {};
      for (const [teacher_id, data] of Object.entries(teacherLessonsMap)) {
          scheduledLessonsCount[teacher_id] = 0;
      }
      Object.values(bestSchedule).flat(2).forEach(cell => {
          if (cell) scheduledLessonsCount[cell.teacher_id]++;
      });
      
      for (const [teacher_id, data] of Object.entries(teacherLessonsMap)) {
          const remaining = data.total - (scheduledLessonsCount[teacher_id] || 0);
          for (let i = 0; i < remaining; i++) {
              finalLessonsPool.push({ teacher_id: parseInt(teacher_id), subject: data.subject });
          }
      }

      if (finalLessonsPool.length > 0) {
          console.log(`⚠️ ${finalLessonsPool.length} دروس متبقية. بدء الملء الإجباري النهائي.`);
          for (const division_id of division_ids) {
              for (let day = 0; day < 5; day++) {
                  for (let period = 0; period < 7; period++) {
                      if (bestSchedule[division_id][day][period] === null) {
                          if (finalLessonsPool.length === 0) break;

                          let suitableLessonIndex = -1;
                          for(let i = 0; i < finalLessonsPool.length; i++) {
                              const lesson = finalLessonsPool[i];
                              const teacherData = teacherLessonsMap[lesson.teacher_id];
                              const isTeacherBusy = globalTeacherAvailability[lesson.teacher_id][day][period];
                              const isTeacherOff = teacherData.day_off.includes(day);
                              
                              if (!isTeacherBusy && !isTeacherOff) {
                                  suitableLessonIndex = i;
                                  break;
                              }
                          }
                          
                          if (suitableLessonIndex !== -1) {
                              const placedLesson = finalLessonsPool.splice(suitableLessonIndex, 1)[0];
                              bestSchedule[division_id][day][period] = { 
                                  teacher_id: placedLesson.teacher_id, 
                                  subject: placedLesson.subject,
                                  is_emergency_fill: true
                              };
                              globalTeacherAvailability[placedLesson.teacher_id][day][period] = true;
                          }
                      }
                  }
                  if (finalLessonsPool.length === 0) break;
              }
              if (finalLessonsPool.length === 0) break;
          }
      }

      if (!bestSchedule) {
        throw new Error('فشلت الخوارزمية الجديدة في إنشاء جداول.');
      }
      const scheduleGrids = bestSchedule;

      const insertPromises = [];
      for (const division_id of division_ids) {
        for (let day = 0; day < 5; day++) {
          for (let period = 0; period < 7; period++) {
            const lesson = scheduleGrids[division_id][day][period];
            if (lesson) {
              insertPromises.push(
                pool.query(
                  'INSERT INTO weekly_schedule (division_id, day_of_week, period, teacher_id, subject, is_emergency_fill) VALUES ($1, $2, $3, $4, $5, $6)',
                  [division_id, day, period + 1, lesson.teacher_id, lesson.subject, lesson.is_emergency_fill || false]
                )
              );
            }
          }
        }
      }

      await Promise.all(insertPromises);

      console.log('🧮 تحليل بعد الجدولة:\n');
      const analysis = {};
      const teacherUsage = {};

      for (const teacher_id in teacherLessonsMap) {
          const teacherNameRes = await pool.query('SELECT name FROM teachers WHERE id = $1', [teacher_id]);
          teacherUsage[teacher_id] = {
              name: teacherNameRes.rows[0]?.name || `المعلم ${teacher_id}`,
              total: teacherLessonsMap[teacher_id].total,
              used: 0
          };
      }

      let totalEmptyCells = 0;
      const emptyCellsByDivision = {};

      for (const division_id of division_ids) {
          let divisionEmpty = 0;
          for (let day = 0; day < 5; day++) {
              for (let period = 0; period < 7; period++) {
                  const cell = scheduleGrids[division_id]?.[day]?.[period];
                  if (cell) {
                      if (teacherUsage[cell.teacher_id]) {
                          teacherUsage[cell.teacher_id].used++;
                      }
                  } else {
                      totalEmptyCells++;
                      divisionEmpty++;
                  }
              }
          }
          emptyCellsByDivision[division_id] = divisionEmpty;
          console.log(`الشعبة ${division_id}: ${divisionEmpty} مربعات فارغة`);
      }

      console.log(`\nإجمالي المربعات الفارغة: ${totalEmptyCells}`);
      console.log('\nتحليل استخدام المعلمين:');
      for(const teacher_id in teacherUsage) {
          const usage = teacherUsage[teacher_id];
          if (usage.used < usage.total) {
              console.log(`⚠️ المدرس ${usage.name} استُخدم له ${usage.used} من أصل ${usage.total} حصة`);
          } else {
              console.log(`✅ المدرس ${usage.name} استُخدم له ${usage.used} من أصل ${usage.total} حصة`);
          }
      }
      
      analysis.teacher_usage = Object.values(teacherUsage);
      analysis.empty_cells = {
          total: totalEmptyCells,
          by_division: emptyCellsByDivision
      };

      if (finalLessonsPool.length > 0) {
          console.log(`\n⚠️تحذير: ${finalLessonsPool.length} درس لم يتمكن من التعيين حتى في الملء الإجباري (قد يكون بسبب عدم توفر المدرسين تمامًا)`);
          analysis.unplaced_lessons = finalLessonsPool;
      }

      res.json({
        message: 'تم إنشاء الجدول بنجاح',
        schedules: scheduleGrids,
        analysis: analysis,
      });

    } catch (error) {
      console.error('❌ فشل إنشاء الجدول:', error);
      res.status(500).json({ 
        error: 'حدث خطأ أثناء توليد الجدول',
        details: error.message 
      });
    }
  });



  // 📅 API: Get schedule for specific division
  app.get('/api/schedule', async (req, res) => {
    const { division_id } = req.query;
    if (!division_id) return res.status(400).json({ error: 'division_id مطلوب' });

    try {
      const result = await pool.query(`
        SELECT * FROM weekly_schedule 
        WHERE division_id = $1 
        ORDER BY day_of_week, period
      `, [division_id]);

      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching schedule:", err.message);
      res.status(500).json({ error: 'فشل في جلب الجدول' });
    }
  });
  // 🔴 استبدل مسار GET /api/teachers الحالي بهذا المسار المحدث
app.get('/api/teachers', async (req, res) => {
  try {
    const result = await pool.query(`
        SELECT
            t.id,
            t.name,
            t.phone,
            t.email,
            t.specialization,
            t.leave_quota,
            t.base_salary, -- ✅ تمت إضافة هذا السطر لجلب الراتب الأساسي
            t.fingerprints,
            COALESCE(
                (SELECT json_agg(ts.subject) FROM teacher_subjects ts WHERE ts.teacher_id = t.id),
                '[]'::json
            ) AS subjects
        FROM teachers t
        ORDER BY t.name ASC
    `);
    // تحويل حقل البصمات من نص JSON إلى كائن JavaScript
    const teachers = result.rows.map(teacher => ({
        ...teacher,
        fingerprints: typeof teacher.fingerprints === 'string' ? JSON.parse(teacher.fingerprints) : (teacher.fingerprints || [])
    }));
    res.json(teachers);
  } catch (err) {
    console.error('❌ Error loading teachers with subjects:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});


  // 🔴 استبدل دالة POST /api/teachers الحالية بهذه
  app.post('/api/teachers', async (req, res) => {
    const { name, phone, email, specialization, subjects, leave_quota, fingerprints } = req.body;
    if (!name) return res.status(400).json({ error: 'Teacher name is required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const teacherResult = await client.query(
        `INSERT INTO teachers (name, phone, email, specialization, leave_quota, fingerprints)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, phone, email, specialization, leave_quota || 0, JSON.stringify(fingerprints || [])]
      );
      const teacher = teacherResult.rows[0];

      if (subjects && Array.isArray(subjects)) {
        for (const subject of subjects) {
          await client.query(
            `INSERT INTO teacher_subjects (teacher_id, subject) VALUES ($1, $2)`,
            [teacher.id, subject]
          );
        }
      }

      await client.query('COMMIT');
      
      // إرجاع الكائن الكامل للمدرس مع بياناته الجديدة
      const finalResult = {
          ...teacher,
          subjects: subjects || [],
          fingerprints: fingerprints || []
      };

      res.status(201).json(finalResult);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error("❌ Error creating teacher:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });


  // 🔴 استبدل دالة PUT /api/teachers/:id الحالية بهذه النسخة الأكثر قوة
  app.put('/api/teachers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, specialization, subjects, leave_quota, fingerprints } = req.body;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // تحديث البيانات الأساسية للمدرس بما في ذلك البصمات
      const teacherUpdateResult = await client.query(
        `UPDATE teachers SET
          name = $1,
          phone = $2,
          email = $3,
          specialization = $4,
          leave_quota = $5,
          fingerprints = $6
        WHERE id = $7 RETURNING *`,
        [name, phone, email, specialization, leave_quota || 0, JSON.stringify(fingerprints || '[]'), id]
      );

      if (teacherUpdateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Teacher not found' });
      }

      // تحديث المواد الدراسية (هذه الفقرة تبقى كما هي)
      if (subjects && Array.isArray(subjects)) {
        await client.query(`DELETE FROM teacher_subjects WHERE teacher_id = $1`, [id]);
        for (const subject of subjects) {
          if (subject) {
              await client.query(`INSERT INTO teacher_subjects (teacher_id, subject) VALUES ($1, $2)`, [id, subject]);
          }
        }
      }

      await client.query('COMMIT');

      // جلب البيانات المحدثة بالكامل لضمان تطابقها في الواجهة الأمامية
      const updatedTeacherResult = await client.query(`
          SELECT t.*, COALESCE(json_agg(ts.subject) FILTER (WHERE ts.subject IS NOT NULL), '[]') AS subjects
          FROM teachers t
          LEFT JOIN teacher_subjects ts ON t.id = ts.teacher_id
          WHERE t.id = $1
          GROUP BY t.id
      `, [id]);
      
      const teacher = updatedTeacherResult.rows[0];
      // التأكد من أن حقل البصمات هو مصفوفة وليس نص
      teacher.fingerprints = typeof teacher.fingerprints === 'string' ? JSON.parse(teacher.fingerprints) : teacher.fingerprints;

      res.json(teacher);

    } catch (err) {
      await client.query('ROLLBACK');
      console.error("❌ Error updating teacher:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
  // --- Teacher Regular Days Off APIs ---
  app.get('/api/teachers/:teacher_id/regular-days-off', async (req, res) => {
      const { teacher_id } = req.params;
      try {
          const result = await pool.query(
              'SELECT day_of_week FROM teacher_regular_days_off WHERE teacher_id = $1',
              [teacher_id]
          );
          res.json(result.rows);
      } catch (err) {
          console.error("Error fetching regular days off:", err.message);
          res.status(500).json({ error: 'فشل في جلب أيام الراحة: ' + err.message });
      }
  });

  app.post('/api/teachers/:teacher_id/regular-days-off', async (req, res) => {
      const { teacher_id } = req.params;
      const { days_of_week } = req.body; // Array of day indices (0-6)

      if (!Array.isArray(days_of_week)) {
          return res.status(400).json({ error: 'days_of_week يجب أن يكون مصفوفة' });
      }

      const client = await pool.connect();
      try {
          await client.query('BEGIN');
          // Clear existing days off for this teacher
          await client.query('DELETE FROM teacher_regular_days_off WHERE teacher_id = $1', [teacher_id]);
          // Insert new days off
          for (const day of days_of_week) {
              if (typeof day === 'number' && day >= 0 && day <= 6) {
                  await client.query(
                      'INSERT INTO teacher_regular_days_off (teacher_id, day_of_week) VALUES ($1, $2)',
                      [teacher_id, day]
                  );
              }
          }
          await client.query('COMMIT');
          res.json({ message: 'تم تحديث أيام الراحة الأسبوعية بنجاح.' });
      } catch (err) {
          await client.query('ROLLBACK');
          console.error("Error setting regular days off:", err.message);
          res.status(500).json({ error: 'فشل في تحديث أيام الراحة: ' + err.message });
      } finally {
          client.release();
      }
  });
  // --- Teacher Attendance APIs ---
  app.post('/api/attendance/check-in', async (req, res) => {
      const { teacher_id } = req.body;
      if (!teacher_id) {
          return res.status(400).json({ error: 'معرّف المدرس مطلوب' });
      }

      const today = new Date().toISOString().slice(0, 10);
      const todayDayOfWeek = new Date().getDay(); 

      try {
          const existingEntry = await pool.query(
              `SELECT * FROM teacher_attendance 
              WHERE teacher_id = $1 AND attendance_date = $2`,
              [teacher_id, today]
          );

          if (existingEntry.rows.length > 0) {
              const currentRecord = existingEntry.rows[0];
              if (['حاضر', 'منصرف', 'إجازة موافق عليها', 'مفرغ', 'غياب'].includes(currentRecord.status)) {
                  return res.status(400).json({ error: `لا يمكن تسجيل حضور. يوجد سجل (${currentRecord.status}) لهذا المدرس اليوم.` });
              }
          }
          
          const dayOffRecord = await pool.query(
              `SELECT 1 FROM teacher_regular_days_off 
              WHERE teacher_id = $1 AND day_of_week = $2`,
              [teacher_id, todayDayOfWeek]
          );
          if (dayOffRecord.rows.length > 0) {
              if (existingEntry.rows.length === 0) { 
                  return res.status(400).json({ error: 'لا يمكن تسجيل الحضور. هذا اليوم هو يوم راحة رسمي مقرر للمدرس.' });
              }
          }

          const result = await pool.query(
              `INSERT INTO teacher_attendance (teacher_id, entry_timestamp, status, attendance_date)
              VALUES ($1, NOW(), 'حاضر', $2) 
              ON CONFLICT (teacher_id, attendance_date) DO UPDATE SET
                  entry_timestamp = NOW(),
                  status = 'حاضر',
                  exit_timestamp = NULL, 
                  notes = COALESCE(teacher_attendance.notes, '') || ' (تم تحديث الحضور)',
                  reason_for_leave = NULL,
                  leave_approval_status = NULL
              RETURNING *`,
              [teacher_id, today]
          );
          res.status(201).json({ message: 'تم تسجيل الحضور بنجاح', data: result.rows[0] });
      } catch (err) {
          console.error("❌ Error in /api/attendance/check-in:", err.message);
          res.status(500).json({ error: 'فشل تسجيل الحضور: ' + err.message });
      }
  });

  app.post('/api/attendance/check-out', async (req, res) => {
      const { teacher_id } = req.body;
      if (!teacher_id) {
          return res.status(400).json({ error: 'معرّف المدرس مطلوب' });
      }
      const today = new Date().toISOString().slice(0, 10); 

      try {
          const entryToUpdateResult = await pool.query(
              `SELECT id FROM teacher_attendance 
              WHERE teacher_id = $1 AND attendance_date = $2 AND status = 'حاضر' AND exit_timestamp IS NULL 
              ORDER BY entry_timestamp DESC LIMIT 1`, 
              [teacher_id, today]
          );

          if (entryToUpdateResult.rows.length === 0) {
              return res.status(400).json({ error: 'لم يتم العثور على سجل حضور مفتوح لهذا المدرس اليوم لتسجيل الانصراف.' });
          }
          const attendanceIdToUpdate = entryToUpdateResult.rows[0].id;

          const result = await pool.query(
              `UPDATE teacher_attendance 
              SET exit_timestamp = NOW(), status = 'منصرف' 
              WHERE id = $1 RETURNING *`,
              [attendanceIdToUpdate]
          );
          res.status(200).json({ message: 'تم تسجيل الانصراف بنجاح', data: result.rows[0] });
      } catch (err) {
          console.error("❌ Error in /api/attendance/check-out:", err.message);
          res.status(500).json({ error: 'فشل تسجيل الانصراف: ' + err.message });
      }
  });

  app.post('/api/attendance/absent', async (req, res) => {
      const { teacher_id, absence_date, notes } = req.body;
      if (!teacher_id || !absence_date) {
          return res.status(400).json({ error: 'معرّف المدرس وتاريخ الغياب مطلوبان' });
      }
      const todayDayOfWeek = new Date(absence_date).getDay();

      try {
          const existingEntry = await pool.query(
              `SELECT status FROM teacher_attendance 
              WHERE teacher_id = $1 AND attendance_date = $2`,
              [teacher_id, absence_date]
          );

          if (existingEntry.rows.length > 0) {
              if (existingEntry.rows[0].status === 'يوم راحة رسمي') {
                  await pool.query(
                      `UPDATE teacher_attendance SET status = 'غياب', notes = COALESCE(notes, '') || ' (سُجّل غياب في يوم راحة رسمي)' 
                      WHERE teacher_id = $1 AND attendance_date = $2 RETURNING *`,
                      [teacher_id, absence_date]
                  );
                  return res.status(200).json({ message: 'تم تحديث حالة يوم الراحة إلى غياب.', data: existingEntry.rows[0] });
              }
              return res.status(400).json({ error: `يوجد سجل (${existingEntry.rows[0].status}) بالفعل للمدرس في تاريخ ${absence_date}` });
          }
          
          const dayOffRecord = await pool.query(
              `SELECT 1 FROM teacher_regular_days_off 
              WHERE teacher_id = $1 AND day_of_week = $2`,
              [teacher_id, todayDayOfWeek]
          );
          if (dayOffRecord.rows.length > 0) {
              const result = await pool.query(
                  `INSERT INTO teacher_attendance (teacher_id, status, attendance_date, notes, entry_timestamp, exit_timestamp, leave_approval_status)
                  VALUES ($1, 'غياب', $2, $3, NULL, NULL, NULL) RETURNING *`, 
                  [teacher_id, absence_date, (notes || '') + ' (سُجّل غياب في يوم راحة رسمي مقرر)']
              );
              return res.status(201).json({ message: 'تم تسجيل الغياب في يوم راحة رسمي.', data: result.rows[0] });
          }
          
          const result = await pool.query(
              `INSERT INTO teacher_attendance (teacher_id, status, attendance_date, notes, entry_timestamp, exit_timestamp, leave_approval_status)
              VALUES ($1, 'غياب', $2, $3, NULL, NULL, NULL) RETURNING *`,
              [teacher_id, absence_date, notes]
          );
          res.status(201).json({ message: 'تم تسجيل الغياب بنجاح', data: result.rows[0] });
      } catch (err) {
          console.error("❌ Error in /api/attendance/absent:", err.message);
          res.status(500).json({ error: 'فشل تسجيل الغياب: ' + err.message });
      }
  });


  app.post('/api/attendance/leave', async (req, res) => {
      const { teacher_id, leave_date, reason_for_leave, notes } = req.body;
      if (!teacher_id || !leave_date || !reason_for_leave) {
          return res.status(400).json({ error: 'معرّف المدرس وتاريخ الإجازة وسبب الإجازة مطلوبون' });
      }
      const leaveDayOfWeek = new Date(leave_date).getDay();

      try {
          const existingEntry = await pool.query(
              `SELECT status FROM teacher_attendance WHERE teacher_id = $1 AND attendance_date = $2`,
              [teacher_id, leave_date]
          );

          if (existingEntry.rows.length > 0) {
              return res.status(400).json({ error: `يوجد سجل (${existingEntry.rows[0].status}) بالفعل للمدرس في تاريخ ${leave_date}` });
          }

          const dayOffRecord = await pool.query(
              `SELECT 1 FROM teacher_regular_days_off 
              WHERE teacher_id = $1 AND day_of_week = $2`,
              [teacher_id, leaveDayOfWeek]
          );
          if (dayOffRecord.rows.length > 0) {
              return res.status(400).json({ error: `لا يمكن طلب إجازة في يوم (${new Date(leave_date).toLocaleDateString('ar-EG', { weekday: 'long' })}) لأنه يوم راحة رسمي مقرر للمدرس.` });
          }
          
          const result = await pool.query(
              `INSERT INTO teacher_attendance (teacher_id, status, attendance_date, reason_for_leave, notes, leave_approval_status, entry_timestamp, exit_timestamp)
              VALUES ($1, 'إجازة قيد المراجعة', $2, $3, $4, 'pending_approval', NULL, NULL) RETURNING *`,
              [teacher_id, leave_date, reason_for_leave, notes]
          );
          res.status(201).json({ message: 'تم تقديم طلب الإجازة بنجاح وهو قيد المراجعة.', data: result.rows[0] });
      } catch (err) {
          console.error("❌ Error in /api/attendance/leave:", err.message);
          res.status(500).json({ error: 'فشل تقديم طلب الإجازة: ' + err.message });
      }
  });

  app.put('/api/attendance/leave/:id/approve', async (req, res) => {
      const { id } = req.params;
      const { manager_notes } = req.body; 

      try {
          const currentRecordResult = await pool.query('SELECT * FROM teacher_attendance WHERE id = $1', [id]);
          if (currentRecordResult.rows.length === 0) {
              return res.status(404).json({ error: 'سجل الإجازة غير موجود' });
          }
          const currentRecord = currentRecordResult.rows[0];

          if (currentRecord.status !== 'إجازة قيد المراجعة') {
              return res.status(400).json({ error: `لا يمكن الموافقة على هذا الطلب لأنه بحالة (${currentRecord.status}) وليس قيد المراجعة.`});
          }

          let updatedNotes = currentRecord.notes || '';
          if (manager_notes) {
              updatedNotes = updatedNotes ? `${updatedNotes} | ملاحظة المدير: ${manager_notes}` : `ملاحظة المدير: ${manager_notes}`;
          }

          const result = await pool.query(
              `UPDATE teacher_attendance 
              SET status = 'إجازة موافق عليها', leave_approval_status = 'approved', notes = $2
              WHERE id = $1 RETURNING *`,
              [id, updatedNotes]
          );
          res.status(200).json({ message: 'تمت الموافقة على الإجازة بنجاح.', data: result.rows[0] });
      } catch (err) {
          console.error("❌ Error in /api/attendance/leave/:id/approve:", err.message);
          res.status(500).json({ error: 'فشل الموافقة على الإجازة: ' + err.message });
      }
  });


  app.put('/api/attendance/leave/:id/reject', async (req, res) => {
      const { id } = req.params;
      const { manager_notes } = req.body; 

      try {
          const currentRecordResult = await pool.query('SELECT * FROM teacher_attendance WHERE id = $1', [id]);
          if (currentRecordResult.rows.length === 0) {
              return res.status(404).json({ error: 'سجل الإجازة غير موجود' });
          }
          const currentRecord = currentRecordResult.rows[0];

          if (currentRecord.status !== 'إجازة قيد المراجعة') {
              return res.status(400).json({ error: `لا يمكن رفض هذا الطلب لأنه بحالة (${currentRecord.status}) وليس قيد المراجعة.`});
          }
          
          let updatedNotes = currentRecord.notes || '';
          if (manager_notes) {
              updatedNotes = updatedNotes ? `${updatedNotes} | ملاحظة المدير عند الرفض: ${manager_notes}` : `ملاحظة المدير عند الرفض: ${manager_notes}`;
          }
          
          const result = await pool.query(
              `UPDATE teacher_attendance 
              SET status = 'غياب بسبب إجازة مرفوضة', leave_approval_status = 'rejected', notes = $2
              WHERE id = $1 RETURNING *`,
              [id, updatedNotes]
          );
          res.status(200).json({ message: 'تم رفض الإجازة وتحويلها إلى غياب.', data: result.rows[0] });
      } catch (err) {
          console.error("❌ Error in /api/attendance/leave/:id/reject:", err.message);
          res.status(500).json({ error: 'فشل رفض الإجازة: ' + err.message });
      }
  });

  // Updated endpoint to set a teacher as "Assigned" (Mufarragh) for a date range
  app.post('/api/attendance/set-assigned', async (req, res) => {
      const { teacher_id, start_date, end_date, notes } = req.body; // Expect start_date and end_date

      if (!teacher_id || !start_date || !end_date || !notes) {
          return res.status(400).json({ error: 'معرف المدرس، تاريخ بداية ونهاية التفريغ، والملاحظات مطلوبة' });
      }
      if (new Date(end_date) < new Date(start_date)) {
          return res.status(400).json({ error: 'تاريخ نهاية التفريغ يجب أن يكون بعد أو نفس تاريخ البداية.' });
      }

      const client = await pool.connect();
      try {
          await client.query('BEGIN');
          const results = [];
          const errors = [];

          let currentDate = new Date(start_date);
          const finalEndDate = new Date(end_date);

          while (currentDate <= finalEndDate) {
              const attendanceDate = currentDate.toISOString().slice(0, 10);
              const assignedDayOfWeek = currentDate.getDay();

              try {
                  const existingEntry = await client.query(
                      `SELECT status FROM teacher_attendance 
                      WHERE teacher_id = $1 AND attendance_date = $2`,
                      [teacher_id, attendanceDate]
                  );

                  let operationPerformed = false;
                  if (existingEntry.rows.length > 0) {
                      // If already 'مفرغ', perhaps update notes or skip. For now, update.
                      // If other status, this will override it to 'مفرغ'.
                      // Consider more complex conflict resolution if needed.
                      const updateResult = await client.query(
                          `UPDATE teacher_attendance 
                          SET status = 'مفرغ', notes = $3, entry_timestamp = NULL, exit_timestamp = NULL, reason_for_leave = NULL, leave_approval_status = NULL
                          WHERE teacher_id = $1 AND attendance_date = $2 RETURNING *`,
                          [teacher_id, attendanceDate, notes]
                      );
                      results.push({ date: attendanceDate, data: updateResult.rows[0], operation: 'updated' });
                      operationPerformed = true;
                  } else {
                      // Check if it's an official day off - allow 'mufarragh' to override.
                      const dayOffRecord = await client.query(
                          `SELECT 1 FROM teacher_regular_days_off 
                          WHERE teacher_id = $1 AND day_of_week = $2`,
                          [teacher_id, assignedDayOfWeek]
                      );
                      if (dayOffRecord.rows.length > 0) {
                          console.log(`INFO: Teacher ${teacher_id} is being set as 'mufarragh' on a regular day off (${attendanceDate}).`);
                      }

                      const insertResult = await client.query(
                          `INSERT INTO teacher_attendance (teacher_id, status, attendance_date, notes, entry_timestamp, exit_timestamp, leave_approval_status)
                          VALUES ($1, 'مفرغ', $2, $3, NULL, NULL, NULL) RETURNING *`,
                          [teacher_id, attendanceDate, notes]
                      );
                      results.push({ date: attendanceDate, data: insertResult.rows[0], operation: 'inserted' });
                      operationPerformed = true;
                  }
                  if (!operationPerformed) { // Should not happen with current logic but as a safeguard
                      errors.push({ date: attendanceDate, error: 'No operation performed for this date.' });
                  }

              } catch (loopError) {
                  errors.push({ date: attendanceDate, error: loopError.message });
              }
              currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
          }

          if (errors.length > 0) {
              await client.query('ROLLBACK');
              // Provide a more detailed error message if some days succeeded and others failed.
              const successCount = results.length;
              const failureCount = errors.length;
              return res.status(207).json({ 
                  message: `تمت معالجة التفريغ جزئياً. ${successCount} يوم/أيام تم تسجيلها بنجاح، وفشل تسجيل ${failureCount} يوم/أيام.`, 
                  successful_days: results,
                  failed_days: errors 
              });
          }

          await client.query('COMMIT');
          res.status(201).json({ message: 'تم تسجيل التفريغ الرسمي لجميع الأيام المحددة بنجاح.', data: results.map(r => r.data) });

      } catch (err) {
          await client.query('ROLLBACK');
          console.error("Error in /api/attendance/set-assigned (range):", err.message, err.stack);
          res.status(500).json({ error: 'فشل تسجيل التفريغ: ' + err.message });
      } finally {
          client.release();
      }
  });


  // Endpoint to get status for all teachers for today
  app.get('/api/attendance/today-status-all', async (req, res) => {
      const today = new Date().toISOString().slice(0, 10);
      const todayDayOfWeek = new Date().getDay(); 

      try {
          const teachersResult = await pool.query('SELECT id, name FROM teachers ORDER BY name');
          const teachers = teachersResult.rows;
          
          const teacherStatuses = [];

          for (const teacher of teachers) {
              let status = 'متوفر'; 
              let details = '';

              const attendanceRecordResult = await pool.query(
                  `SELECT status, notes, reason_for_leave FROM teacher_attendance 
                  WHERE teacher_id = $1 AND attendance_date = $2 
                  ORDER BY created_at DESC LIMIT 1`, // Ensure we get the latest state for the day
                  [teacher.id, today]
              );

              if (attendanceRecordResult.rows.length > 0) {
                  const record = attendanceRecordResult.rows[0];
                  status = record.status; 
                  if (status === 'إجازة قيد المراجعة' || status === 'إجازة موافق عليها') {
                      details = record.reason_for_leave || '';
                  } else if (status === 'مفرغ' || status === 'غياب' || status === 'غياب بسبب إجازة مرفوضة') { 
                      details = record.notes || '';
                  }
              } else {
                  const dayOffRecordResult = await pool.query(
                      `SELECT 1 FROM teacher_regular_days_off 
                      WHERE teacher_id = $1 AND day_of_week = $2`,
                      [teacher.id, todayDayOfWeek]
                  );
                  if (dayOffRecordResult.rows.length > 0) {
                      status = 'يوم راحة رسمي';
                      details = 'يوم راحة أسبوعي مقرر';
                  }
              }
              teacherStatuses.push({ teacher_id: teacher.id, name: teacher.name, status, details });
          }
          res.json(teacherStatuses);
      } catch (err) {
          console.error("Error fetching today's status for all teachers:", err.message, err.stack);
          res.status(500).json({ error: 'فشل في جلب حالة المدرسين لليوم: ' + err.message });
      }
  });


  app.get('/api/attendance/report', async (req, res) => {
      const { start_date, end_date, teacher_name, status } = req.query; 

      let queryText = `
          SELECT ta.id, ta.teacher_id, t.name AS teacher_name, 
                  ta.entry_timestamp, ta.exit_timestamp, ta.status, 
                  ta.attendance_date, ta.notes, ta.reason_for_leave, ta.leave_approval_status
          FROM teacher_attendance ta
          JOIN teachers t ON ta.teacher_id = t.id
          WHERE 1=1`; 
      
      const queryParams = [];
      let paramIndex = 1;

      if (start_date) {
          queryText += ` AND ta.attendance_date >= $${paramIndex++}`;
          queryParams.push(start_date);
      }
      if (end_date) {
          queryText += ` AND ta.attendance_date <= $${paramIndex++}`;
          queryParams.push(end_date);
      }

      if (teacher_name && teacher_name.toLowerCase() !== 'all' && teacher_name.trim() !== '') {
          queryText += ` AND t.name ILIKE $${paramIndex++}`; 
          queryParams.push(`%${teacher_name}%`); 
      }

      if (status) {
          queryText += ` AND ta.status = $${paramIndex++}`;
          queryParams.push(status);
      }

      queryText += ` ORDER BY ta.attendance_date DESC, t.name, ta.entry_timestamp DESC`;
      
      try {
          const result = await pool.query(queryText, queryParams);
          res.status(200).json(result.rows);
      } catch (err) {
          console.error("❌ Error in /api/attendance/report:", err.message, err.stack);
          res.status(500).json({ error: 'فشل في جلب تقرير الحضور: ' + err.message });
      }
  });



// استبدل الدالة الحالية بهذه الدالة المعدلة بالكامل
app.post('/api/import-grades-excel', upload.single('excel'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'لم يتم رفع أي ملف.' });
        }

        // --- ✨ تم حذف دالة cleanAndNormalize بالكامل حسب الطلب ---

        const { division_id, teacher_id } = req.body;
        // سيتم الآن استخدام القيم كما هي مع إزالة المسافات الزائدة فقط
        const subjectFromRequest = req.body.subject ? req.body.subject.toString().trim() : null;
        const termNameFromRequest = req.body.term ? req.body.term.toString().trim() : null;

        if (!division_id || !teacher_id || !subjectFromRequest || !termNameFromRequest) {
             return res.status(400).json({ error: "جميع الحقول (الشعبة, المدرس, المادة, الفصل) مطلوبة." });
        }
        
        // البحث عن الفصل الدراسي سيتم بناءً على الاسم بعد إزالة المسافات فقط
        const termResult = await pool.query('SELECT id FROM terms WHERE name = $1', [termNameFromRequest]);
        if (termResult.rows.length === 0) {
            return res.status(404).json({ error: `الفصل الدراسي '${termNameFromRequest}' غير موجود في قاعدة البيانات.` });
        }
        const termIdToUse = termResult.rows[0].id;
        console.log(`💡 Converted Term Name '${termNameFromRequest}' to Term ID '${termIdToUse}' for all database operations.`);


        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0];
        
        const headerRow = worksheet.getRow(1);
        if (!headerRow.values || headerRow.values.length === 0) {
            return res.status(400).json({ error: 'ملف الإكسل فارغ أو لا يحتوي على صف الرؤوس (Header).' });
        }

        // --- ✨ تم حذف .map(cleanAndNormalize) من كل الأسماء المستعارة ---
        // المطابقة الآن يجب أن تكون دقيقة 100% مع هذه النصوص
        const columnAliases = {
            student_name: ['اسم الطالب', 'الاسم الكامل', 'الاسم'],
            month1_term1: ['شهر اول الفصل الأول', 'شهر أول - ف1', 'شهر1 ف1', 'الشهر الاول ف1'],
            month2_term1: ['شهر الثاني الفصل الأول', 'شهر ثاني - ف1', 'شهر2 ف1', 'الشهر الثاني ف1'],
            mid_term: ['نصف السنه', 'امتحان نصف السنه', 'نصف السنة', 'امتحان نصف السنة'],
            month1_term2: ['شهر اول الفصل الثاني', 'شهر أول - ف2', 'شهر1 ف2', 'الشهر الاول ف2'],
            month2_term2: ['شهر ثاني الفصل الثاني', 'شهر ثاني - ف2', 'شهر2 ف2', 'الشهر الثاني ف2'],
            final_exam: ['درجة الامتحان النهائي', 'آخر السنه', 'اخر السنه', 'الامتحان النهائي', 'الدور الاول'],
            makeup_exam: ['امتحان الاكمال', 'امتحان تكميلي', 'درجه الاكمال', 'الدور الثاني', 'الاكمال', 'امتحان الدور الثاني'],
            dummy_avg1: ['معدل الفصل الاول'],
            dummy_avg2: ['معدل الفصل الثاني'],
            dummy_s3: ['السعي النهائي', 'السعي السنوي'],
            dummy_final_after_makeup: ['الدرجة النهائية بعد الاكمال']
        };
        
        console.log('\n--- 📋 Raw Alias Lists for Matching ---');
        console.log(columnAliases);
        console.log('-------------------------------------------\n');


        const columnIndexMap = {};
        console.log('\n--- 🔍 Mapping Excel Headers ---');
        headerRow.eachCell((cell, colNumber) => {
            // --- ✨ سيتم الآن مطابقة رأس العمود بعد إزالة المسافات فقط ---
            const excelHeaderText = cell.value ? cell.value.toString().trim() : null; 
            if (!excelHeaderText) return;

            let isMapped = false;
            for (const key in columnAliases) {
                if (columnAliases[key].includes(excelHeaderText)) {
                    if (!key.startsWith('dummy_')) {
                       columnIndexMap[key] = colNumber;
                    }
                    console.log(`  [OK] Mapped Excel header '${cell.value}' directly to -> '${key}'`);
                    isMapped = true;
                    break; 
                }
            }
            if (!isMapped) {
                 console.log(`  [WARN] Could not map Excel header '${cell.value}' (raw value: '${excelHeaderText}')`);
            }
        });
        console.log('--- Finished Mapping. Final Map:', columnIndexMap, ' ---\n');


        if (!columnIndexMap.student_name) {
            return res.status(400).json({ error: 'لم يتم العثور على عمود "اسم الطالب" في ملف الإكسل. يرجى التأكد من وجوده.' });
        }
        
        let insertedCount = 0;
        let errors = [];

        for (let i = 2; i <= worksheet.rowCount; i++) {
            const currentRow = worksheet.getRow(i);
            const getCellValue = (key) => {
                const colIndex = columnIndexMap[key];
                return colIndex ? currentRow.getCell(colIndex).value : null;
            };

            const student_name = getCellValue('student_name')?.toString().trim();
            if (!student_name) continue;

            const studentResult = await pool.query('SELECT id FROM students WHERE name = $1 AND division_id = $2', [student_name, division_id]);
            if (studentResult.rows.length === 0) {
                errors.push(`لم يتم العثور على الطالب: ${student_name} في الشعبة المحددة.`);
                continue;
            }
            const student_id = studentResult.rows[0].id;

            const num = (val) => (val == null || val === '' ? null : Number(val));
            const gradesData = {
                month1_term1: num(getCellValue('month1_term1')),
                month2_term1: num(getCellValue('month2_term1')),
                mid_term: num(getCellValue('mid_term')),
                month1_term2: num(getCellValue('month1_term2')),
                month2_term2: num(getCellValue('month2_term2')),
                final_exam: num(getCellValue('final_exam')),
                makeup_exam: num(getCellValue('makeup_exam'))
            };
            
            console.log(`[Row ${i} - ${student_name}] Grades Read From Excel:`, gradesData);


            const s3 = (gradesData.month1_term1 !== null && gradesData.month2_term1 !== null && gradesData.mid_term !== null && gradesData.month1_term2 !== null && gradesData.month2_term2 !== null) ?
                (((gradesData.month1_term1 + gradesData.month2_term1) / 2) + gradesData.mid_term + ((gradesData.month1_term2 + gradesData.month2_term2) / 2)) / 3 : null;

            let final_grade = null;
            if (s3 !== null) {
                if (gradesData.makeup_exam !== null) {
                    final_grade = (s3 + gradesData.makeup_exam) / 2;
                } else if (gradesData.final_exam !== null) {
                    final_grade = (s3 + gradesData.final_exam) / 2;
                }
            }

            try {
                // عند الحفظ في قاعدة البيانات، سنحفظ اسم المادة كما هو بدون تنظيف
                await pool.query(`
                    INSERT INTO student_grades (
                        student_id, teacher_id, subject, term,
                        month1_term1, month2_term1, mid_term,
                        month1_term2, month2_term2, final_exam,
                        makeup_exam, s3, final_grade
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (student_id, subject, term) DO UPDATE SET
                        teacher_id = EXCLUDED.teacher_id, month1_term1 = EXCLUDED.month1_term1,
                        month2_term1 = EXCLUDED.month2_term1, mid_term = EXCLUDED.mid_term,
                        month1_term2 = EXCLUDED.month1_term2, month2_term2 = EXCLUDED.month2_term2,
                        final_exam = EXCLUDED.final_exam, makeup_exam = EXCLUDED.makeup_exam,
                        s3 = EXCLUDED.s3, final_grade = EXCLUDED.final_grade;
                `, [
                    student_id, teacher_id, subjectFromRequest, termIdToUse,
                    gradesData.month1_term1, gradesData.month2_term1, gradesData.mid_term,
                    gradesData.month1_term2, gradesData.month2_term2, gradesData.final_exam,
                    gradesData.makeup_exam,
                    s3 ? parseFloat(s3.toFixed(2)) : null,
                    final_grade ? parseFloat(final_grade.toFixed(2)) : null
                ]);
                insertedCount++;
            } catch (dbError) {
                errors.push(`خطأ في قاعدة البيانات للطالب ${student_name}: ${dbError.message}`);
                 console.error(`DB Error for ${student_name}:`, dbError);
            }
        }

        if (errors.length > 0) {
            return res.status(207).json({ message: "اكتمل الاستيراد مع وجود أخطاء.", insertedCount, errors });
        }
        res.json({ message: "تم استيراد الدرجات بنجاح.", insertedCount });

    } catch (err) {
        console.error("❌ Error importing grades:", err.message, err.stack);
        res.status(500).json({ error: "حدث خطأ في الخادم أثناء معالجة الملف", details: err.message });
    }
});

  
// استبدل هذه الدالة بالكامل
app.post('/api/grades', async (req, res) => {
    console.log("🚨 Received data for /api/grades:", req.body);

    const {
      student_id, teacher_id, subject, term,
      month1_term1, month2_term1, mid_term,
      month1_term2, month2_term2, final_exam, makeup_exam
    } = req.body;

    // ✅ التصحيح: تنظيف حقل الفصل الدراسي والمادة من أي مسافات زائدة
    const cleanSubject = subject ? subject.trim() : null;
    const cleanTerm = term ? term.trim() : null;

    if (!student_id || !teacher_id || !cleanSubject || !cleanTerm)
      return res.status(400).json({ error: "All basic fields are required (student_id, teacher_id, subject, term)" });

    const num = (val) => (val == null || val === '' ? 0 : Number(val));

    const m1t1_val = num(month1_term1);
    const m2t1_val = num(month2_term1);
    const mt_val = num(mid_term);
    const m1t2_val = num(month1_term2);
    const m2t2_val = num(month2_term2);
    const fe_val = num(final_exam);
    const mue_val = (makeup_exam == null || makeup_exam === '') ? null : Number(makeup_exam);

    const avg1 = (m1t1_val + m2t1_val) / 2;
    const avg2 = (m1t2_val + m2t2_val) / 2;
    const s3_calc = ((avg1 + mt_val + avg2) / 3);
    const s3 = parseFloat(s3_calc.toFixed(2));

    let final_grade_calc;
    if (req.body.final_grade !== undefined && req.body.final_grade !== null && req.body.final_grade !== '') {
      final_grade_calc = num(req.body.final_grade);
    } else if (mue_val !== null) {
      final_grade_calc = (s3 + mue_val) / 2;
    } else {
      final_grade_calc = ((s3 + fe_val) / 2);
    }
    const final_grade = parseFloat(final_grade_calc.toFixed(2));

    try {
      const result = await pool.query(`
        INSERT INTO student_grades (
          student_id, teacher_id, subject, term,
          month1_term1, month2_term1, mid_term,
          month1_term2, month2_term2, final_exam,
          makeup_exam, s3, final_grade
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
        )
        ON CONFLICT (student_id, subject, term)
        DO UPDATE SET
          teacher_id = EXCLUDED.teacher_id,
          month1_term1 = EXCLUDED.month1_term1,
          month2_term1 = EXCLUDED.month2_term1,
          mid_term = EXCLUDED.mid_term,
          month1_term2 = EXCLUDED.month1_term2,
          month2_term2 = EXCLUDED.month2_term2,
          final_exam = EXCLUDED.final_exam,
          makeup_exam = EXCLUDED.makeup_exam,
          s3 = EXCLUDED.s3,
          final_grade = EXCLUDED.final_grade
        RETURNING *;
      `, [
        student_id,
        teacher_id,
        cleanSubject,   // ✅ استخدام المتغير النظيف
        cleanTerm,      // ✅ استخدام المتغير النظيف
        m1t1_val, m2t1_val, mt_val,
        m1t2_val, m2t2_val,
        fe_val, mue_val,
        s3, final_grade
      ]);

      res.json(result.rows[0]);
    } catch (err) {
      console.error("❌ Error in POST /api/grades:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    }
});

app.get('/api/divisions/:division_id/grades', async (req, res) => {
    const { division_id } = req.params;
    const { subject, term } = req.query; 

    // ✅ التصحيح: تنظيف حقل الفصل الدراسي والمادة من أي مسافات زائدة قبل الاستعلام
    const cleanSubject = subject ? subject.trim() : null;
    const cleanTerm = term ? term.trim() : null;

    if (!cleanSubject || !cleanTerm) {
      return res.status(400).json({ error: "Subject and term are required query parameters." });
    }

    try {
      const result = await pool.query(`
        SELECT
          s.id AS student_id,
          s.name AS student_name,
          g.id AS grade_id, 
          g.teacher_id,
          g.subject,
          g.term,
          g.month1_term1, g.month2_term1, g.mid_term,
          g.month1_term2, g.month2_term2, g.final_exam, g.makeup_exam,
          g.s3, g.final_grade
        FROM students s
        LEFT JOIN student_grades g ON s.id = g.student_id AND g.subject = $2 AND g.term = $3
        WHERE s.division_id = $1
        ORDER BY s.name;
      `, [division_id, cleanSubject, cleanTerm]); // ✅ استخدام المتغيرات النظيفة
      res.json(result.rows);
    } catch (err) {
      console.error('❌ Error loading grades for division:', err.message, err.stack);
      res.status(500).json({ error: err.message });
    }
});


  app.get('/api/grades/calculate/:student_id/:subject', async (req, res) => {
    const { student_id, subject } = req.params;
    const { term } = req.query; 

    if (!term) {
      return res.status(400).json({ error: "Term is a required query parameter." });
    }

    try {
      const result = await pool.query(`
        SELECT * FROM student_grades
        WHERE student_id = $1 AND subject = $2 AND term = $3
      `, [student_id, subject, term]);

      if (result.rows.length === 0) {
        return res.json({
            month1_term1: 0, month2_term1: 0, mid_term: 0,
            month1_term2: 0, month2_term2: 0, final_exam: 0,
            makeup_exam: null,
            avg_term1: 0, avg_term2: 0, s3: 0, final_grade: 0
        });
      }

      const g = result.rows[0];
      const num = (val) => (val == null ? 0 : Number(val));

      const avg1 = (num(g.month1_term1) + num(g.month2_term1)) / 2;
      const avg2 = (num(g.month1_term2) + num(g.month2_term2)) / 2;
      const s3_calc = ((avg1 + num(g.mid_term) + avg2) / 3);
      
      let final_grade_calc;
      if (g.makeup_exam != null) { 
          final_grade_calc = num(g.makeup_exam);
      } else {
          final_grade_calc = (s3_calc + num(g.final_exam)) / 2;
      }


      res.json({
        month1_term1: num(g.month1_term1),
        month2_term1: num(g.month2_term1),
        mid_term: num(g.mid_term),
        month1_term2: num(g.month1_term2),
        month2_term2: num(g.month2_term2),
        final_exam: num(g.final_exam),
        makeup_exam: g.makeup_exam, 
        avg_term1: parseFloat(avg1.toFixed(2)),
        avg_term2: parseFloat(avg2.toFixed(2)),
        s3: parseFloat(s3_calc.toFixed(2)),
        final_grade: parseFloat(final_grade_calc.toFixed(2))
      });
    } catch (err) {
      console.error("❌ Error in /api/grades/calculate:", err.message, err.stack);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/subjects", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT subject AS name FROM teacher_subjects
        UNION
        SELECT DISTINCT subject AS name FROM absences WHERE subject IS NOT NULL
        ORDER BY name
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Failed to load subjects:", err.message);
      res.status(500).json({ error: "Failed to load subjects" });
    }
  });

  app.get("/api/lessons", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT lesson AS name FROM absences WHERE lesson IS NOT NULL
        ORDER BY name
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Failed to load lessons:", err.message);
      res.status(500).json({ error: "Failed to load lessons" });
    }
  });

  app.post('/api/lessons_list', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Lesson name is required' });
    try {
      const result = await pool.query('INSERT INTO lessons_list (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') { 
        return res.status(409).json({ error: 'Lesson with this name already exists.' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/lessons_list', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM lessons_list ORDER BY name ASC');
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error fetching lessons list:", err.message);
      res.status(500).json({ error: 'Failed to fetch lessons list' });
    }
  });

  app.put('/api/lessons_list/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Lesson name is required' });

    try {
      const result = await pool.query('UPDATE lessons_list SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') { 
        return res.status(409).json({ error: 'Lesson with this name already exists.' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/lessons_list/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM lessons_list WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      res.status(200).json({ message: 'Lesson deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



// --- API Endpoint for Student Public Grade Announcement ---
// This endpoint is designed to be read-only for students to check their results.
// It is intentionally separate from other internal APIs to enhance security.
app.get('/api/student-announcement-data', async (req, res) => {
    const { query, term } = req.query;

    console.log(`[Public API] Received request. Query: "${query}", Term: "${term}"`);

    if (!query || !term) {
        return res.status(400).json({ error: 'الرجاء إدخال بيانات البحث واختيار الفصل الدراسي.' });
    }

    try {
        // Step 1: Find the student ID using their name or barcode.
        // This is a necessary first step as the main data-fetching function requires an ID.
        const studentLookupQuery = `
            SELECT id FROM students WHERE name ILIKE $1 OR barcode = $1 LIMIT 1;
        `;
        const studentLookupResult = await pool.query(studentLookupQuery, [query]);

        if (studentLookupResult.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على الطالب. يرجى التأكد من صحة الاسم أو الباركود.' });
        }
        const studentId = studentLookupResult.rows[0].id;

        // Step 2: Use the existing, powerful 'getStudentCertificateData' function.
        // This function already handles the complex logic of fetching student details,
        // class subjects, grades, and performing all necessary calculations.
        const certificateData = await getStudentCertificateData(studentId, term);

        if (!certificateData) {
            return res.status(404).json({ error: 'لم يتم العثور على بيانات شهادة للطالب المختار في هذا الفصل الدراسي.' });
        }
        
        // Step 3: Extract the necessary information from the result.
        const studentInfo = {
            id: certificateData.student_id,
            student_name: certificateData.student_name,
            school_name: certificateData.school_name,
            class_name: certificateData.class_name,
            division_name: certificateData.division_name,
            photo_url: certificateData.photo_url, // Assuming photo_url is part of studentData
        };
        const grades = certificateData.grades;

        // Step 4: Fetch the student's detailed attendance record separately.
        const attendanceQuery = `
            SELECT date, type, notes, subject, lesson
            FROM absences
            WHERE student_id = $1
            ORDER BY date DESC;
        `;
        const attendanceResult = await pool.query(attendanceQuery, [studentId]);
        const detailed_attendance = attendanceResult.rows;
        
        // --- NEW ---
        // Step 5: Calculate the final average if all final grades are available.
        // --- جديد ---
        // الخطوة ٥: حساب المعدل النهائي فقط في حال توفر جميع الدرجات النهائية.
        let finalAverage = null;
        if (grades && grades.length > 0) {
            let finalGradesSum = 0;
            let areAllGradesAvailable = true;
            
            grades.forEach(grade => {
                const finalOverallGrade = grade.final_with_makeup !== null && grade.final_with_makeup !== undefined 
                    ? grade.final_with_makeup 
                    : grade.final_grade;
                
                if (finalOverallGrade === null || finalOverallGrade === undefined) {
                    areAllGradesAvailable = false; // إذا كانت درجة واحدة غير متوفرة، لا يمكن حساب المعدل
                } else {
                    finalGradesSum += finalOverallGrade;
                }
            });

            if (areAllGradesAvailable) {
                // يتم حساب المعدل وتنسيقه إلى منزلتين عشريتين
                finalAverage = (finalGradesSum / grades.length).toFixed(2);
            }
        }

        // Step 6: Combine all data into a single response object.
        // الخطوة ٦: تجميع كل البيانات في كائن استجابة واحد.
        res.json({
            studentInfo,
            grades,
            detailed_attendance,
            finalAverage, // سيحتوي هذا الحقل على قيمة المعدل أو null
        });

    } catch (err) {
        console.error("❌ Error fetching student public data:", err.message, err.stack);
        res.status(500).json({ error: 'حدث خطأ في الخادم أثناء جلب بيانات الطالب.' });
    }
});



  app.post('/api/import-students-excel', upload.single('excel'), async (req, res) => {
    try {
      if (!req.file) {
          return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف.' });
      }
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      const worksheet = workbook.worksheets[0];
      const client = await pool.connect();

      let errors = [];
      let successCount = 0;

      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const name = row.getCell(1).value?.toString().trim();
        const schoolName = row.getCell(2).value?.toString().trim();
        const className = row.getCell(3).value?.toString().trim();
        const divisionName = row.getCell(4).value?.toString().trim();
        const parentPhone = row.getCell(5).value?.toString().trim(); 
        const gender = row.getCell(6).value?.toString().trim();       
        const barcode = row.getCell(7).value?.toString().trim();      
        const notes = row.getCell(8).value?.toString().trim();        

        try {
          if (!name || !schoolName || !className || !divisionName) {
            errors.push(`❌ الصف ${i}: بيانات أساسية ناقصة (الاسم، المدرسة، الصف، الشعبة)`);
            continue;
          }

          await client.query('BEGIN'); 

          let schoolResult = await client.query('SELECT id FROM schools WHERE name = $1', [schoolName]);
          let schoolId;
          if (schoolResult.rowCount === 0) {
            const insertSchool = await client.query('INSERT INTO schools (name) VALUES ($1) RETURNING id', [schoolName]);
            schoolId = insertSchool.rows[0].id;
          } else {
            schoolId = schoolResult.rows[0].id;
          }

          let classResult = await client.query('SELECT id FROM classes WHERE name = $1 AND school_id = $2', [className, schoolId]);
          let classId;
          if (classResult.rowCount === 0) {
            const insertClass = await client.query('INSERT INTO classes (name, school_id) VALUES ($1, $2) RETURNING id', [className, schoolId]);
            classId = insertClass.rows[0].id;
          } else {
            classId = classResult.rows[0].id;
          }

          let divisionResult = await client.query('SELECT id FROM divisions WHERE name = $1 AND class_id = $2', [divisionName, classId]);
          let divisionId;
          if (divisionResult.rowCount === 0) {
            const insertDivision = await client.query('INSERT INTO divisions (name, class_id) VALUES ($1, $2) RETURNING id', [divisionName, classId]);
            divisionId = insertDivision.rows[0].id;
          } else {
            divisionId = divisionResult.rows[0].id;
          }
          
          if (barcode) {
              const barcodeCheck = await client.query('SELECT id FROM students WHERE barcode = $1', [barcode]);
              if (barcodeCheck.rowCount > 0) {
                  errors.push(`❌ الصف ${i}: الطالب ${name} - الباركود ${barcode} موجود مسبقًا.`);
                  await client.query('ROLLBACK');
                  continue;
              }
          }

          await client.query(
              `INSERT INTO students (name, division_id, parent_phone, gender, barcode, notes) 
              VALUES ($1, $2, $3, $4, $5, $6)`,
              [name, divisionId, parentPhone, gender, barcode, notes]
          );
          
          await client.query('COMMIT'); 
          successCount++;

        } catch (err) {
          await client.query('ROLLBACK'); 
          errors.push(`❌ خطأ في الصف ${i}: الطالب ${name} - ${err.message} (التفاصيل: ${err.detail || ''})`);
        }
      }

      client.release();
      if (errors.length > 0) {
          res.status(207).json({ success: false, message: `📥 تم استيراد ${successCount} طالب بنجاح مع وجود ${errors.length} أخطاء.`, errors, successCount });
      } else {
          res.json({ success: true, message: `📥 تم استيراد ${successCount} طالب بنجاح.`, errors: [], successCount });
      }
    } catch (err) {
      console.error("❌ خطأ عام في استيراد الطلاب:", err.stack);
      res.status(500).json({ success: false, message: '❌ خطأ في استيراد الطلاب', error: err.message });
    }
  });
  app.put('/api/students/update-gender-bulk', async (req, res) => {
    const { gender } = req.body;
    if (!gender || (gender !== 'ذكر' && gender !== 'أنثى')) {
      return res.status(400).json({ error: 'قيمة الجنس غير صالحة' });
    }

    try {
      const result = await pool.query('UPDATE students SET gender = $1', [gender]);
      res.json({ message: `تم تحديث الجنس إلى "${gender}" لجميع الطلاب.`, updated: result.rowCount });
    } catch (err) {
      console.error("❌ فشل في تحديث الجنس الجماعي:", err.message);
      res.status(500).json({ error: 'حدث خطأ أثناء التحديث الجماعي' });
    }
  });
  // 🔴 مفقود
  app.post('/api/referral-reasons', async (req, res) => {
    const { reason } = req.body;
    if (!reason || reason.trim() === "") {
      return res.status(400).json({ error: "السبب مطلوب" });
    }

    try {
      const result = await pool.query(
        'INSERT INTO referral_reasons (reason) VALUES ($1) RETURNING *',
        [reason]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error("❌ فشل في إضافة السبب:", err.message);
      res.status(500).json({ error: "فشل في إضافة السبب إلى قاعدة البيانات" });
    }
  });

  app.get('/api/referral-reasons', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM referral_reasons ORDER BY id');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put('/api/referral-reasons/:id', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'السبب مطلوب' });

    try {
      const result = await pool.query(
        'UPDATE referral_reasons SET reason = $1 WHERE id = $2 RETURNING *',
        [reason, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete('/api/referral-reasons/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM referral_reasons WHERE id = $1', [id]);
      res.json({ message: 'تم الحذف' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
// ابحث عن هذا المسار في server.js واستبدل قسم SELECT بما يلي:
app.get('/api/student-referrals', authMiddleware, async (req, res) => { // تأكد أن authMiddleware مضافة هنا
  try {
    const result = await pool.query(`
      SELECT
        sr.id AS referral_id,
        sr.referral_date,
        sr.health_center,
        sr.reason,
        COALESCE(u.full_name, sr.manager_name) AS admin_name, -- ✅ التعديل هنا: جلب اسم المستخدم من جدول users كمنفذ، أو استخدام manager_name كحل احتياطي
        s.id AS student_id,
        s.name AS student_name,
        d.name AS division_name,
        c.name AS class_name,
        sch.name AS school_name
      FROM student_referrals sr
      LEFT JOIN students s ON sr.student_id = s.id
      LEFT JOIN divisions d ON s.division_id = d.id
      LEFT JOIN classes c ON d.class_id = c.id
      LEFT JOIN schools sch ON c.school_id = sch.id
      LEFT JOIN users u ON sr.created_by = u.id -- ✅ الربط بجدول المستخدمين
      ORDER BY s.name, sr.referral_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching all student referrals:', err.message);
    res.status(500).json({ error: 'Failed to fetch student referrals' });
  }
});

  app.get('/api/student-referrals/:id/export', async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        SELECT sr.*, s.name as student_name, c.name as class_name, sch.name as school_name
        FROM student_referrals sr
        JOIN students s ON sr.student_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN classes c ON d.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        WHERE sr.id = $1
      `, [id]);

      if (result.rows.length === 0)
        return res.status(404).json({ error: 'الإحالة غير موجودة' });

      const referral = result.rows[0];

      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('إحالة', {
        views: [{ rightToLeft: true }]
      });

      ws.pageSetup = {
        orientation: 'portrait',
        paperSize: 9,
        margins: { top: 0.5, left: 0.5, right: 0.5, bottom: 0.5 }
      };

      // عرض الأعمدة
      ws.columns = [
        { width: 35 },
        { width: 35 },
        { width: 35 },
        { width: 35 }
      ];

      const boldCenter = { bold: true, size: 14, horizontal: 'center' };
      const border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };

      // 🔷 مرفق رقم (١٧)
      ws.mergeCells('A1:D1');
  ws.getCell('A1').value = `مرفق رقم (${id})`;
      ws.getCell('A1').alignment = { horizontal: 'center' };
      ws.getCell('A1').font = { bold: true, size: 14 };

      // 🟠 عنوان الاستمارة
      ws.mergeCells('A2:D2');
      ws.getCell('A2').value = 'استمارة إحالة التلاميذ المرضى من قبل المدرسة إلى مركز الرعاية الصحية الأولية';
      ws.getCell('A2').alignment = { horizontal: 'center' };
      ws.getCell('A2').font = { italic: true, size: 13 };

      ws.addRow([]);

      // 🔹 صف البيانات الرئيسي
      ws.addRow([
        `اسم المدرسة: ${referral.school_name}`,
        `تاريخ الإحالة: ${referral.referral_date}`,
        `اسم وتوقيع مديرة المدرسة: ${referral.manager_name}`,
        `ختم المدرسة /`
      ]);

      ws.addRow([
        `اسم المركز الصحي المحال إليه: ${referral.health_center}`,
        `اسم الطالبة الثلاثي: ${referral.student_name}`,
        `العمر (  ${referral.student_age || ''}  )`,
        `المرحلة الدراسية (  ${referral.class_name || ''}  )`
      ]);

      ws.addRow([]);

      // 🟡 جدول السبب والتشخيص
      const header = ws.addRow([
        'سبب الإحالة يثبت من قبل ادارة المدرسة',
        'التشخيص',
        'العلاج',
        'التوصيات ( إجازة مدة الإجازة ) إحالة إلى مستشفى أو لجنة طبية متخصصة'
      ]);
      header.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF000' } };
        cell.border = border;
      });

      const content = ws.addRow([
        referral.reason || '',
        '',
        '',
        ''
      ]);
      content.height = 60;
      content.eachCell(cell => {
        cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'center' };
        cell.border = border;
      });

      ws.addRow([]);

      // 🖊️ التوقيع والمراجعة
      ws.addRow([
        'تاريخ المراجعة:       /       / 20',
        '',
        'اسم وتوقيع الطبيب المعالج:',
        'ختم المركز الصحي (   )'
      ]);

      ws.addRow([]);

      // 📄 الملاحظة
      const note = 'ملاحظة: تُنظم الاستمارة من قبل إدارة المدرسة بثلاثة نسخ، تُحفظ في سجل الصحة المدرسية، وسجل الإجازات والثانية في صيدلية المركز الصحي لاستلام العلاج، والثالثة تُعاد إلى إدارة المدرسة.';
      const noteRow = ws.addRow([note]);
      ws.mergeCells(`A${noteRow.number}:D${noteRow.number}`);
      noteRow.getCell(1).alignment = { horizontal: 'right', wrapText: true };
      noteRow.getCell(1).font = { italic: true, size: 11 };

      // 📦 اسم الملف
      const safeName = (referral.student_name || 'طالب')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\u0600-\u06FF]+/g, '_')
        .replace(/^_+|_+$/g, '').slice(0, 50);

      const fileName = `احالة_${safeName}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('❌ فشل في تصدير ملف الإحالة:', err.message);
      res.status(500).json({ error: 'فشل في توليد ملف الإحالة: ' + err.message });
    }
  });

  // --- NEW APIS FOR STUDENT FINANCIALS ---

  // --- Class Fees APIs ---
  app.post('/api/class-fees', async (req, res) => {
      const { class_id, academic_year, total_fee, default_installments, notes } = req.body;
      if (!class_id || !total_fee) {
          return res.status(400).json({ error: 'معرّف الصف والمبلغ الإجمالي للرسوم مطلوبان.' });
      }
      try {
          const result = await pool.query(
              `INSERT INTO class_fees (class_id, academic_year, total_fee, default_installments, notes)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (class_id, academic_year) DO UPDATE SET
                total_fee = EXCLUDED.total_fee,
                default_installments = EXCLUDED.default_installments,
                notes = EXCLUDED.notes,
                updated_at = CURRENT_TIMESTAMP
              RETURNING *`,
              [class_id, academic_year || '2024-2025', total_fee, default_installments || 1, notes]
          );
          res.status(201).json(result.rows[0]);
      } catch (err) {
          console.error("❌ Error creating/updating class fee:", err.message, err.stack);
          res.status(500).json({ error: 'فشل في إنشاء/تحديث رسوم الصف: ' + err.message });
      }
  });


app.get('/api/class-fees', async (req, res) => {
    const { school_id, class_id, academic_year } = req.query; // ✅ تم إضافة فلاتر جديدة
    try {
        let queryText = `
            SELECT cf.*, c.name as class_name, s.name as school_name
            FROM class_fees cf
            JOIN classes c ON cf.class_id = c.id
            JOIN schools s ON c.school_id = s.id
            WHERE 1=1
        `;
        const queryParams = [];
        let paramIndex = 1;

        if (school_id) {
            queryText += ` AND s.id = $${paramIndex++}`;
            queryParams.push(school_id);
        }
        if (class_id) {
            queryText += ` AND c.id = $${paramIndex++}`;
            queryParams.push(class_id);
        }
        if (academic_year) {
            queryText += ` AND cf.academic_year = $${paramIndex++}`;
            queryParams.push(academic_year);
        }

        queryText += ` ORDER BY s.name, c.name, cf.academic_year DESC`;

        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching class fees with filters:", err.message);
        res.status(500).json({ error: 'فشل في جلب رسوم الصفوف: ' + err.message });
    }
});



// ✅ نقطة نهاية جديدة: جلب الطلاب الذين لا يملكون خطة دفع
app.get('/api/students-without-plan', async (req, res) => {
    const { school_id, class_id, academic_year } = req.query;

    if (!academic_year) {
        return res.status(400).json({ error: 'السنة الدراسية مطلوبة.' });
    }

    try {
        let queryText = `
            SELECT 
                s.id as student_id,
                s.name as student_name,
                d.name as division_name,
                c.name as class_name,
                sch.name as school_name
            FROM students s
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            JOIN schools sch ON c.school_id = sch.id
            WHERE NOT EXISTS (
                SELECT 1 FROM student_payment_plans spp
                JOIN class_fees cf ON spp.class_fee_id = cf.id
                WHERE spp.student_id = s.id AND cf.academic_year = $1
            )
        `;
        const queryParams = [academic_year];
        let paramIndex = 2;

        if (school_id) {
            queryText += ` AND sch.id = $${paramIndex++}`;
            queryParams.push(school_id);
        }
        if (class_id) {
            queryText += ` AND c.id = $${paramIndex++}`;
            queryParams.push(class_id);
        }

        queryText += ` ORDER BY sch.name, c.name, d.name, s.name ASC`;

        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching students without plan:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في جلب قائمة الطلاب بدون خطة دفع: ' + err.message });
    }
});





// ✅ نقطة نهاية جديدة: تطبيق خطة دفع موحدة على مجموعة من الطلاب
app.post('/api/unified-payment-plan', async (req, res) => {
    const { school_id, class_id, academic_year, class_fee_id, down_payment_amount, installments } = req.body;

    if (!class_fee_id || !academic_year || !Array.isArray(installments) || installments.length === 0) {
        return res.status(400).json({ error: 'البيانات الأساسية للخطة الموحدة غير مكتملة.' });
    }

    const client = await pool.connect();
    let appliedCount = 0;
    let skippedCount = 0; // هذا سيتم حسابه في النهاية
    const errors = [];

    try {
        await client.query('BEGIN'); // بدء المعاملة الرئيسية للدُفعة بأكملها

        // 1. جلب رسوم الصف المستهدفة للحصول على total_fee
        const classFeeRes = await client.query('SELECT total_fee FROM class_fees WHERE id = $1', [class_fee_id]);
        if (classFeeRes.rows.length === 0) {
            await client.query('ROLLBACK'); // تراجع إذا لم يتم العثور على رسوم الصف
            return res.status(404).json({ error: 'رسوم الصف المحددة غير موجودة.' });
        }
        const totalClassFee = parseFloat(classFeeRes.rows[0].total_fee);
        const newDownPayment = parseFloat(down_payment_amount || 0);

        // 2. جلب قائمة الطلاب المؤهلين (الذين لا يملكون خطة دفع للسنة الدراسية المحددة)
        let studentsQueryText = `
            SELECT s.id, s.name
            FROM students s
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            JOIN schools sch ON c.school_id = sch.id
            WHERE NOT EXISTS (
                SELECT 1 FROM student_payment_plans spp
                JOIN class_fees cf_inner ON spp.class_fee_id = cf_inner.id
                WHERE spp.student_id = s.id AND cf_inner.academic_year = $1
            )
        `;
        const studentsQueryParams = [academic_year];
        let paramIndex = 2;

        if (school_id) {
            studentsQueryText += ` AND sch.id = $${paramIndex++}`;
            studentsQueryParams.push(school_id);
        }
        if (class_id) {
            studentsQueryText += ` AND c.id = $${paramIndex++}`;
            studentsQueryParams.push(class_id);
        }

        const studentsRes = await client.query(studentsQueryText, studentsQueryParams);
        const targetStudents = studentsRes.rows;

        // حساب عدد الطلاب الذين تم تجاوزهم مبدئياً (الذين لديهم خطة موجودة)
        let totalStudentsInFilteredScopeQuery = `
            SELECT COUNT(s.id)
            FROM students s
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            JOIN schools sch ON c.school_id = sch.id
            WHERE 1=1
        `;
        const totalStudentsParams = [];
        let totalStudentsParamIndex = 1;
        if (school_id) {
            totalStudentsInFilteredScopeQuery += ` AND sch.id = $${totalStudentsParamIndex++}`;
            totalStudentsParams.push(school_id);
        }
        if (class_id) {
            totalStudentsInFilteredScopeQuery += ` AND c.id = $${totalStudentsParamIndex++}`;
            totalStudentsParams.push(class_id);
        }

        const totalStudentsResult = await client.query(totalStudentsInFilteredScopeQuery, totalStudentsParams);
        const totalStudentsInScope = parseInt(totalStudentsResult.rows[0].count);
        skippedCount = totalStudentsInScope - targetStudents.length; // الطلاب الذين لديهم خطط موجودة يتم تخطيهم ضمنياً هنا.

        // 3. تطبيق الخطة على كل طالب مؤهل باستخدام نقاط الحفظ (SAVEPOINTS)
        for (const student of targetStudents) {
            try {
                // تعيين نقطة حفظ لكل عملية طالب
                await client.query(`SAVEPOINT student_${student.id}_savepoint`); // اسم نقطة حفظ فريد

                // Upsert خطة الدفع للطالب الحالي
                const planRes = await client.query(
                    `INSERT INTO student_payment_plans (student_id, class_fee_id, payment_type, total_amount_due, number_of_installments, down_payment_amount, status, notes)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (student_id, class_fee_id) DO UPDATE SET
                      payment_type = EXCLUDED.payment_type,
                      total_amount_due = EXCLUDED.total_amount_due,
                      number_of_installments = EXCLUDED.number_of_installments,
                      down_payment_amount = EXCLUDED.down_payment_amount, 
                      status = 'active', 
                      notes = EXCLUDED.notes,
                      updated_at = CURRENT_TIMESTAMP
                    RETURNING id`,
                    [student.id, class_fee_id, 'installments', totalClassFee, installments.length, newDownPayment, 'active', 'خطة دفع موحدة'] 
                );
                const paymentPlanId = planRes.rows[0].id;

                // حذف الأقساط الموجودة مسبقاً (مهم لسلوك ON CONFLICT DO UPDATE، يضمن بداية نظيفة للأقساط)
                await client.query('DELETE FROM student_installments WHERE payment_plan_id = $1', [paymentPlanId]);

                // 3.1. إنشاء قسط الدفعة المقدمة إذا كان هناك مبلغ مقدم
                if (newDownPayment > 0) {
                    const firstInstallmentDate = installments[0]?.due_date || new Date().toISOString().split('T')[0];
                    await client.query(
                        `INSERT INTO student_installments (payment_plan_id, installment_number, due_date, amount_due, amount_paid, payment_date, status, notes)
                        VALUES ($1, 0, $2, $3, $3, $2, 'paid', 'دفعة مقدمة من خطة موحدة')`, 
                        [paymentPlanId, firstInstallmentDate, newDownPayment]
                    );
                }

                // 3.2. إنشاء الأقساط العادية
                for (const inst of installments) {
                    await client.query(
                        `INSERT INTO student_installments (payment_plan_id, installment_number, due_date, amount_due, amount_paid, payment_date, status)
                        VALUES ($1, $2, $3, $4, 0.00, NULL, 'pending')`, 
                        [paymentPlanId, inst.installment_number, inst.due_date, inst.amount_due]
                    );
                }

                // إصدار نقطة الحفظ إذا كانت العمليات لهذا الطالب ناجحة
                await client.query(`RELEASE SAVEPOINT student_${student.id}_savepoint`);
                appliedCount++;

            } catch (studentError) {
                // التراجع إلى نقطة الحفظ إذا حدث خطأ لهذا الطالب
                await client.query(`ROLLBACK TO SAVEPOINT student_${student.id}_savepoint`);
                console.error(`❌ Error applying unified plan for student ${student.name} (ID: ${student.id}):`, studentError.message);
                errors.push(`فشل تطبيق الخطة للطالب ${student.name}: ${studentError.message}`);
                // appliedCount لا يتم زيادته، وskippedCount يزداد ضمنياً
            }
        }

        await client.query('COMMIT'); // تأكيد المعاملة الرئيسية لجميع الطلاب الذين تمت معالجتهم بنجاح
        res.status(200).json({
            message: 'تمت معالجة الخطة الموحدة.',
            applied_count: appliedCount,
            skipped_count: skippedCount,
            errors: errors
        });

    } catch (err) {
        await client.query('ROLLBACK'); // تراجع عن المعاملة الرئيسية بأكملها إذا حدث خطأ فادح
        console.error("❌ Critical Error applying unified payment plan (full rollback):", err.message, err.stack);
        res.status(500).json({ error: 'فشل في تطبيق الخطة الموحدة: ' + err.message });
    } finally {
        client.release();
    }
});

  app.get('/api/classes/:class_id/fees', async (req, res) => {
      const { class_id } = req.params;
      const { academic_year } = req.query; // Optional filter
      try {
          let queryText = 'SELECT * FROM class_fees WHERE class_id = $1';
          const queryParams = [class_id];
          if (academic_year) {
              queryText += ' AND academic_year = $2';
              queryParams.push(academic_year);
          }
          queryText += ' ORDER BY academic_year DESC';
          const result = await pool.query(queryText, queryParams);
          res.json(result.rows);
      } catch (err) {
          console.error("❌ Error fetching fees for class:", err.message);
          res.status(500).json({ error: 'فشل في جلب رسوم الصف: ' + err.message });
      }
  });

app.post('/api/students/:student_id/payment-plan', async (req, res) => {
    const { student_id } = req.params;
    const {
        class_fee_id,
        payment_type,
        number_of_installments,
        down_payment_amount,
        notes: plan_notes,
        start_date,
        installment_interval_days
    } = req.body;

    console.log(`[Backend] Received request to setup/update payment plan for student ${student_id}.`);

    if (!class_fee_id || !payment_type || !start_date) {
        return res.status(400).json({ error: 'معرّف رسوم الصف، نوع الدفع، وتاريخ البدء مطلوبون.' });
    }
    if (payment_type === 'installments' && (!number_of_installments || number_of_installments <= 0)) {
        return res.status(400).json({ error: 'عدد الأقساط يجب أن يكون رقمًا موجبًا.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Fetch details of the new class fee being applied
        const classFeeRes = await client.query('SELECT total_fee FROM class_fees WHERE id = $1', [class_fee_id]);
        if (classFeeRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'رسوم الصف المحددة غير موجودة.' });
        }
        const newTotalClassFee = parseFloat(classFeeRes.rows[0].total_fee);

        // Step 2: Check for an existing plan and prepare for update if found
        const existingPlanRes = await client.query(
            `SELECT id FROM student_payment_plans WHERE student_id = $1 AND class_fee_id = $2`,
            [student_id, class_fee_id]
        );
        
        let fixedAmountSum = 0;
        let paymentPlanId;
        let maxExistingInstallmentNumber = 0; // To track the last used installment number
        let hasExistingDownPayment = false;

        if (existingPlanRes.rows.length > 0) {
            // --- UPDATE LOGIC ---
            console.log("[Backend] Updating existing payment plan.");
            paymentPlanId = existingPlanRes.rows[0].id;

            const existingInstallmentsRes = await client.query(
                `SELECT id, status, amount_due, installment_number FROM student_installments WHERE payment_plan_id = $1`,
                [paymentPlanId]
            );

            const pendingInstallmentIds = [];
            for (const inst of existingInstallmentsRes.rows) {
                if (inst.status === 'paid' || inst.status === 'partially_paid' || inst.status === 'waived') {
                    fixedAmountSum += parseFloat(inst.amount_due);
                    if (inst.installment_number > maxExistingInstallmentNumber) {
                        maxExistingInstallmentNumber = inst.installment_number;
                    }
                    if (inst.installment_number === 0) {
                        hasExistingDownPayment = true;
                    }
                } else {
                    pendingInstallmentIds.push(inst.id);
                }
            }
            console.log(`[Backend] Sum of fixed installments: ${fixedAmountSum}. Max existing number: ${maxExistingInstallmentNumber}`);

            if (newTotalClassFee < fixedAmountSum) {
                await client.query('ROLLBACK');
                return res.status(400).json({
                    error: `لا يمكن تحديث الخطة. إجمالي الرسوم الجديد (${newTotalClassFee.toFixed(2)}) أقل من مجموع الأقساط المدفوعة أو المحفوظة (${fixedAmountSum.toFixed(2)}).`
                });
            }

            if (pendingInstallmentIds.length > 0) {
                await client.query(`DELETE FROM student_installments WHERE id = ANY($1::bigint[])`, [pendingInstallmentIds]);
                console.log(`[Backend] Deleted ${pendingInstallmentIds.length} pending installments.`);
            }
        }
        
        // Step 3: Upsert the payment plan
        const actualNumberOfInstallments = payment_type === 'cash' ? 1 : parseInt(number_of_installments);
        const planUpsertRes = await client.query(
            `INSERT INTO student_payment_plans (student_id, class_fee_id, payment_type, total_amount_due, number_of_installments, down_payment_amount, status, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (student_id, class_fee_id) DO UPDATE SET
              payment_type = EXCLUDED.payment_type, total_amount_due = EXCLUDED.total_amount_due,
              number_of_installments = EXCLUDED.number_of_installments, down_payment_amount = EXCLUDED.down_payment_amount,
              status = 'active', notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
            RETURNING id`,
            [student_id, class_fee_id, payment_type, newTotalClassFee, actualNumberOfInstallments, parseFloat(down_payment_amount || 0), 'active', plan_notes]
        );
        paymentPlanId = planUpsertRes.rows[0].id;

        // Step 4: Generate new installments for the remaining amount
        let currentDueDate = new Date(start_date);
        const interval = installment_interval_days ? parseInt(installment_interval_days) : 30;

        // Create a down payment installment ONLY if it doesn't already exist and is specified
        const newDownPayment = parseFloat(down_payment_amount || 0);
        if (!hasExistingDownPayment && payment_type === 'installments' && newDownPayment > 0) {
            await client.query(
                `INSERT INTO student_installments (payment_plan_id, installment_number, due_date, amount_due, amount_paid, payment_date, status, notes)
                VALUES ($1, 0, $2, $3, $3, $2, 'paid', 'دفعة مقدمة')`,
                [paymentPlanId, currentDueDate.toISOString().split('T')[0], newDownPayment]
            );
            fixedAmountSum += newDownPayment;
        }

        const amountForRegularInstallments = Math.max(0, newTotalClassFee - fixedAmountSum);
        console.log(`[Backend] Amount to redistribute over new installments: ${amountForRegularInstallments}`);

        if (payment_type === 'installments' && actualNumberOfInstallments > 0) {
            const installmentAmount = parseFloat((amountForRegularInstallments / actualNumberOfInstallments).toFixed(2));
            let sumOfNewInstallments = 0;

            for (let i = 0; i < actualNumberOfInstallments; i++) {
                // --- ✅ CORE FIX: Start numbering from the next available number ---
                const newInstallmentNumber = maxExistingInstallmentNumber + 1 + i;
                
                let currentInstallmentAmount = installmentAmount;
                if (i === actualNumberOfInstallments - 1) { // Adjust last installment for rounding
                    currentInstallmentAmount = parseFloat((amountForRegularInstallments - sumOfNewInstallments).toFixed(2));
                }
                sumOfNewInstallments += currentInstallmentAmount;

                await client.query(
                    `INSERT INTO student_installments (payment_plan_id, installment_number, due_date, amount_due, status)
                    VALUES ($1, $2, $3, $4, 'pending')`,
                    [paymentPlanId, newInstallmentNumber, currentDueDate.toISOString().split('T')[0], currentInstallmentAmount]
                );
                currentDueDate.setDate(currentDueDate.getDate() + interval);
            }
        } else if (payment_type === 'cash' && maxExistingInstallmentNumber === 0) { // Only create if no other installments exist
             await client.query(
                `INSERT INTO student_installments (payment_plan_id, installment_number, due_date, amount_due, status)
                VALUES ($1, 1, $2, $3, 'pending')`,
                [paymentPlanId, currentDueDate.toISOString().split('T')[0], amountForRegularInstallments]
            );
        }

        await client.query('COMMIT');
        console.log(`[Backend] Payment plan and installments committed successfully for student ${student_id}.`);
        res.status(201).json({ message: 'تم إعداد خطة الدفع بنجاح.', payment_plan_id: paymentPlanId });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error setting up student payment plan:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في إعداد خطة الدفع: ' + err.message });
    } finally {
        client.release();
    }
});


app.get('/api/financial-summary', async (req, res) => {
    console.log(`[Backend] GET /api/financial-summary received.`);
    const client = await pool.connect();
    try {
        // Query 1: Get main summary stats including new counts
        const summaryQuery = `
            SELECT
                (SELECT COUNT(*) FROM students) AS total_students,
                (SELECT SUM(total_amount_due) FROM student_payment_plans) AS total_expected_revenue,
                (SELECT SUM(amount_paid) FROM student_installments) AS total_paid_amount,
                (SELECT COUNT(*) FROM student_payment_plans WHERE status = 'fully_paid') AS fully_paid_students_count,
                (SELECT COUNT(*) FROM student_payment_plans WHERE status IN ('active', 'overdue_installments')) AS students_with_balance_count,
                (SELECT COUNT(DISTINCT payment_plan_id) FROM student_installments WHERE installment_number <= 0 AND status = 'paid') AS students_with_down_payment_count;
        `;

        // Query 2: Get monthly expected income from pending installments
        const monthlyQuery = `
            SELECT
                to_char(due_date, 'YYYY-MM') AS month,
                SUM(amount_due - COALESCE(amount_paid, 0)) AS expected_in_month
            FROM student_installments
            WHERE status IN ('pending', 'partially_paid', 'overdue')
            GROUP BY to_char(due_date, 'YYYY-MM')
            ORDER BY month;
        `;

        const [summaryResult, monthlyResult] = await Promise.all([
            client.query(summaryQuery),
            client.query(monthlyQuery)
        ]);

        const summaryData = summaryResult.rows[0];
        const monthlyData = monthlyResult.rows;

        res.json({
            total_students: parseInt(summaryData.total_students || 0),
            total_expected_revenue: parseFloat(summaryData.total_expected_revenue || 0),
            total_paid_amount: parseFloat(summaryData.total_paid_amount || 0),
            fully_paid_students_count: parseInt(summaryData.fully_paid_students_count || 0),
            students_with_balance_count: parseInt(summaryData.students_with_balance_count || 0),
            students_with_down_payment_count: parseInt(summaryData.students_with_down_payment_count || 0),
            monthly_expected_income: monthlyData.map(row => ({
                month: row.month,
                amount: parseFloat(row.expected_in_month)
            }))
        });

    } catch (err) {
        console.error("❌ Error fetching financial summary:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في جلب الملخص المالي: ' + err.message });
    } finally {
        client.release();
    }
});




app.get('/api/students/:student_id/payment-details', async (req, res) => {
      const { student_id } = req.params;
      const { academic_year } = req.query;

      console.log(`[Backend] Fetching payment details for student ID: ${student_id}, academic year: ${academic_year || 'any'}`);

      try {
          let planQueryText = `
              SELECT spp.*, cf.academic_year, cf.total_fee as class_total_fee
              FROM student_payment_plans spp
              JOIN class_fees cf ON spp.class_fee_id = cf.id
              WHERE spp.student_id = $1
          `;
          const planQueryParams = [student_id];
          if (academic_year) {
              planQueryText += ` AND cf.academic_year = $2`;
              planQueryParams.push(academic_year);
          }
          planQueryText += ` ORDER BY cf.academic_year DESC LIMIT 1`;

          const planRes = await pool.query(planQueryText, planQueryParams);

          if (planRes.rows.length === 0) {
              console.log(`[Backend] No payment plan found for student ${student_id}.`);
              return res.status(404).json({ message: 'لم يتم العثور على خطة دفع لهذا الطالب.' });
          }
          const paymentPlan = planRes.rows[0];
          console.log(`[Backend] Found payment plan (ID: ${paymentPlan.id}) for student ${student_id}.`);

          const installmentsRes = await pool.query(
              'SELECT * FROM student_installments WHERE payment_plan_id = $1 ORDER BY installment_number ASC',
              [paymentPlan.id]
          );
          paymentPlan.installments = installmentsRes.rows;
          console.log(`[Backend] Fetched ${installmentsRes.rows.length} installments for plan ID ${paymentPlan.id}.`);

          // Calculate summary
          let totalPaid = 0;
          paymentPlan.installments.forEach(inst => {
              totalPaid += parseFloat(inst.amount_paid || 0);
          });
          paymentPlan.total_paid = parseFloat(totalPaid.toFixed(2));
          // ✅ يتم حساب الرصيد المتبقي بناءً على total_amount_due (الذي يجب أن يكون المبلغ بعد الدفعة المقدمة)
          paymentPlan.remaining_balance = parseFloat((paymentPlan.total_amount_due - totalPaid).toFixed(2));
          console.log(`[Backend] Payment summary for student ${student_id}: Total Due ${paymentPlan.total_amount_due}, Total Paid ${paymentPlan.total_paid}, Remaining ${paymentPlan.remaining_balance}.`);

          res.json(paymentPlan);
      } catch (err) {
          console.error("❌ Error fetching student payment details:", err.message, err.stack);
          res.status(500).json({ error: 'فشل في جلب تفاصيل الدفع للطالب: ' + err.message });
      }
  });

app.post('/api/installments/:installment_id/pay', async (req, res) => {
    const { installment_id } = req.params;
    const { amount_paid, payment_date, payment_method, transaction_reference, notes } = req.body;

    if (!amount_paid || parseFloat(amount_paid) <= 0 || !payment_date) {
        return res.status(400).json({ error: 'المبلغ المدفوع وتاريخ الدفع مطلوبان.' });
    }

    let paidAmount = parseFloat(amount_paid); // Use let to allow modification

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Fetch installment details and join with payment plan to get the total due for the whole plan
        const installmentRes = await client.query(`
            SELECT si.*, spp.total_amount_due AS plan_total_due
            FROM student_installments si
            JOIN student_payment_plans spp ON si.payment_plan_id = spp.id
            WHERE si.id = $1 FOR UPDATE
        `, [installment_id]);

        if (installmentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'القسط غير موجود.' });
        }
        const installment = installmentRes.rows[0];
        const paymentPlanId = installment.payment_plan_id;
        const planTotalDue = parseFloat(installment.plan_total_due);

        // --- ✅ Validation Logic Start: Prevent Overpayment ---
        // Calculate the sum of all payments made for this plan so far
        const totalPaidSoFarRes = await client.query(
            'SELECT COALESCE(SUM(amount_paid), 0) as total FROM student_installments WHERE payment_plan_id = $1',
            [paymentPlanId]
        );
        const totalPaidSoFar = parseFloat(totalPaidSoFarRes.rows[0].total);
        const remainingBalanceForPlan = planTotalDue - totalPaidSoFar;
        
        let infoMessage = null; // To inform the user if payment was adjusted

        // If the new payment exceeds the remaining balance for the entire plan
        if (paidAmount > remainingBalanceForPlan) {
            infoMessage = `تم تعديل المبلغ المدفوع إلى ${remainingBalanceForPlan.toFixed(2)} د.ع. لتجنب تجاوز إجمالي الرسوم.`;
            paidAmount = remainingBalanceForPlan; // Cap the payment to the remaining amount
        }
        // --- ✅ Validation Logic End ---
        
        // If the adjusted paid amount is zero or less, it means the plan is fully paid.
        if (paidAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'الخطة مدفوعة بالكامل. لا يمكن تسجيل دفعات إضافية.' });
        }

        // The rest of the logic proceeds with the (potentially capped) paidAmount
        let receiptCode = installment.receipt_code;
        if (!receiptCode) {
            receiptCode = await generateUniqueReceiptCode(client);
        }

        const currentAmountPaidOnInstallment = parseFloat(installment.amount_paid);
        const newTotalPaidForThisInstallment = currentAmountPaidOnInstallment + paidAmount;
        const amountDueOnInstallment = parseFloat(installment.amount_due);

        let newStatus = installment.status;
        if (newTotalPaidForThisInstallment >= amountDueOnInstallment) {
            newStatus = 'paid';
        } else if (newTotalPaidForThisInstallment > 0) {
            newStatus = 'partially_paid';
        }

        const newNotes = notes ?
            `${installment.notes || ''}\nدفعة جديدة: ${paidAmount.toFixed(2)} بتاريخ ${payment_date}. ${notes}` :
            `${installment.notes || ''}\nدفعة جديدة: ${paidAmount.toFixed(2)} بتاريخ ${payment_date}.`;

        const updatedInstallmentResult = await client.query(
            `UPDATE student_installments
             SET 
                amount_paid = $1, payment_date = $2, status = $3,
                payment_method = $4, transaction_reference = $5, 
                notes = $6, receipt_code = $7, updated_at = CURRENT_TIMESTAMP
             WHERE id = $8 RETURNING *`,
            [
                parseFloat(newTotalPaidForThisInstallment.toFixed(2)),
                payment_date, newStatus, payment_method,
                transaction_reference, newNotes, receiptCode, installment_id
            ]
        );
        
        // Logic for updating the overall plan status will be handled by the database trigger

        await client.query('COMMIT');
        res.json({ 
            message: 'تم تسجيل الدفعة بنجاح.', 
            info: infoMessage, // Send the info message to the frontend if payment was capped
            installment: updatedInstallmentResult.rows[0] 
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error recording installment payment:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في تسجيل الدفعة: ' + err.message });
    } finally {
        client.release();
    }
});
app.get('/api/installments/:identifier', async (req, res) => {
    const { identifier } = req.params;
    console.log(`[Backend] GET /api/installments/${identifier} received.`);

    // The base query to fetch all necessary details
    // هذا الاستعلام يقوم بجمع كل البيانات المطلوبة من عدة جداول لعرض تفاصيل الوصل كاملة
    let queryText = `
        SELECT
            si.*,
            s.name AS student_name,
            s.id AS student_id,
            d.name AS division_name,
            c.name AS class_name,
            sch.name AS school_name
        FROM student_installments si
        JOIN student_payment_plans spp ON si.payment_plan_id = spp.id
        JOIN students s ON spp.student_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN classes c ON d.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
    `;

    // Determine if the identifier is a numeric ID or a string-based receipt code
    // هذا الشرط يحدد هل سيتم البحث برقم الوصل (ID) أم بالرمز المرجعي (receipt_code)
    if (/^\d+$/.test(identifier)) {
        queryText += ` WHERE si.id = $1`;
    } else {
        queryText += ` WHERE si.receipt_code = $1`;
    }

    try {
        const result = await pool.query(queryText, [identifier]);

        // If no record is found, send a 404 Not Found response
        if (result.rows.length === 0) {
            console.log(`[Backend] No installment found for identifier: ${identifier}`);
            return res.status(404).json({ error: 'لم يتم العثور على وصل بهذا المعرف.' });
        }

        // If a record is found, send it as a JSON response
        console.log(`[Backend] Found installment:`, result.rows[0]);
        res.json(result.rows[0]);

    } catch (err) {
        console.error(`❌ فشل البحث عن الوصل بالمعرف ${identifier}:`, err.message, err.stack);
        res.status(500).json({ error: 'حدث خطأ في الخادم أثناء البحث عن الوصل.' });
    }
});


  app.get('/api/terms', async (req, res) => {
    try {
      const result = await pool.query(`SELECT id, name FROM terms ORDER BY id DESC`); //
      res.json(result.rows); //
    } catch (err) {
      console.error("❌ Error fetching terms:", err.message); //
      res.status(500).json({ error: "Failed to fetch terms" }); //
    }
  });
app.get('/api/grades-summary', async (req, res) => {
  const { class_id, term, student_id } = req.query;

  if (!class_id || !term || !student_id) {
    return res.status(400).json({ error: "class_id و term و student_id مطلوبة" });
  }

  try {
    const result = await pool.query(`
      SELECT 
        cs.subject,
        sg.month1_term1, sg.month2_term1, sg.mid_term,
        sg.month1_term2, sg.month2_term2, sg.final_exam,
        sg.makeup_exam, sg.s3, sg.final_grade
      FROM class_subjects cs
      LEFT JOIN student_grades sg
        ON cs.subject = sg.subject
        AND sg.student_id = $1
        AND sg.term = $2
      WHERE cs.class_id = $3
      ORDER BY cs.subject ASC
    `, [student_id, term, class_id]);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching grades summary:", err.message);
    res.status(500).json({ error: "فشل في جلب ملخص الدرجات" });
  }
});

app.get('/api/grades/subject-overview', async (req, res) => {
    const { school_id, class_id, division_id, subject, term } = req.query;

    if (!subject || !term) {
        return res.status(400).json({ error: "Subject and term are required query parameters." });
    }

    let queryText = `
        SELECT
            s.id AS student_id,
            s.name AS student_name,
            s.barcode,
            d.name AS division_name,
            c.name AS class_name,
            sch.name AS school_name,
            sg.month1_term1, sg.month2_term1, sg.mid_term,
            sg.month1_term2, sg.month2_term2, sg.final_exam,
            sg.makeup_exam, sg.s3, sg.final_grade, sg.teacher_id
        FROM students s
        JOIN divisions d ON s.division_id = d.id
        JOIN classes c ON d.class_id = c.id
        JOIN schools sch ON c.school_id = sch.id
        LEFT JOIN student_grades sg
            ON s.id = sg.student_id
            AND sg.subject = $1
            AND sg.term = $2
        WHERE 1=1
    `;
    const queryParams = [subject, term];
    let paramIndex = 3;

    if (school_id) {
        queryText += ` AND sch.id = $${paramIndex++}`;
        queryParams.push(school_id);
    }
    if (class_id) {
        queryText += ` AND c.id = $${paramIndex++}`;
        queryParams.push(class_id);
    }
    if (division_id) {
        queryText += ` AND d.id = $${paramIndex++}`;
        queryParams.push(division_id);
    }

    queryText += ` ORDER BY sch.name, c.name, d.name, s.name ASC;`;

    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching grades subject overview:", err.message, err.stack);
        res.status(500).json({ error: "فشل في جلب نظرة عامة لدرجات المادة" });
    }
});

  // GET /api/student-book-status?school_id=...&class_id=...&division_id=...&search=...
  app.get('/api/student-book-status', async (req, res) => {
      const { school_id, class_id, division_id, search } = req.query;

      let query = `
          SELECT
              s.id as student_id,
              s.name as student_name,
              s.barcode,
              d.name as division_name,
              c.name as class_name,
              sch.name as school_name,
              json_agg(
                  json_build_object(
                      'subject', b.subject_name,
                      'received', b.received
                  )
              ) FILTER (WHERE b.id IS NOT NULL) AS book_statuses
          FROM students s
          JOIN divisions d ON s.division_id = d.id
          JOIN classes c ON d.class_id = c.id
          JOIN schools sch ON c.school_id = sch.id
          LEFT JOIN student_book_status b ON s.id = b.student_id
      `;
      const conditions = [];
      const queryParams = [];
      let paramIndex = 1;

      if (school_id) {
          conditions.push(`sch.id = $${paramIndex++}`);
          queryParams.push(school_id);
      }
      if (class_id) {
          conditions.push(`c.id = $${paramIndex++}`);
          queryParams.push(class_id);
      }
      if (division_id) {
          conditions.push(`d.id = $${paramIndex++}`);
          queryParams.push(division_id);
      }
      if (search) {
          conditions.push(`(s.name ILIKE $${paramIndex} OR s.barcode ILIKE $${paramIndex})`);
          queryParams.push(`%${search}%`);
          paramIndex++;
      }

      if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
      }

      query += `
          GROUP BY s.id, d.name, c.name, sch.name
          ORDER BY sch.name, c.name, d.name, s.name;
      `;

      try {
          const result = await pool.query(query, queryParams);
          res.json(result.rows);
      } catch (err) {
          console.error('Error fetching student book status:', err.message, err.stack);
          res.status(500).json({ error: 'Failed to fetch student book status' });
      }
  });


  // POST /api/student-book-status
  app.post('/api/student-book-status', async (req, res) => {
      const { student_id, subject_name, received } = req.body;

      if (student_id === undefined || subject_name === undefined || received === undefined) {
          return res.status(400).json({ error: 'student_id, subject_name, and received are required.' });
      }

      try {
          const result = await pool.query(`
              INSERT INTO student_book_status (student_id, subject_name, received, received_date)
              VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
              ON CONFLICT (student_id, subject_name)
              DO UPDATE SET
                  received = EXCLUDED.received,
                  received_date = CURRENT_TIMESTAMP
              RETURNING *;
          `, [student_id, subject_name, received]);

          res.status(201).json(result.rows[0]);
      } catch (err) {
          console.error('Error updating book status:', err.message, err.stack);
          res.status(500).json({ error: 'Failed to update book status' });
      }
  });
  app.post('/api/terms', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الفصل الدراسي مطلوب' });
    try {
      const result = await pool.query('INSERT INTO terms (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/terms/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الفصل الدراسي مطلوب' });
    try {
      const result = await pool.query('UPDATE terms SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/terms/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await pool.query('DELETE FROM terms WHERE id = $1 RETURNING *', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'الفصل غير موجود' });
      res.json({ message: 'تم الحذف بنجاح' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

app.put('/api/installments/:installment_id', async (req, res) => {
    const { installment_id } = req.params;
    const { due_date, amount_due, status, notes } = req.body;
    const targetId = parseInt(installment_id); // Convert to number for reliable comparison

    console.log(`[Backend] PUT /api/installments/${targetId} received.`);
    console.log(`[Backend] Payload:`, req.body);

    if (amount_due !== undefined && (isNaN(parseFloat(amount_due)) || parseFloat(amount_due) < 0)) {
        return res.status(400).json({ error: "مبلغ القسط يجب أن يكون رقمًا موجبًا." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const currentInstallmentRes = await client.query('SELECT * FROM student_installments WHERE id = $1 FOR UPDATE', [targetId]);
        if (currentInstallmentRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "القسط غير موجود." });
        }
        const currentInstallment = currentInstallmentRes.rows[0];
        const paymentPlanId = currentInstallment.payment_plan_id;

        const planRes = await client.query('SELECT total_amount_due FROM student_payment_plans WHERE id = $1', [paymentPlanId]);
        const originalPlanTotalDue = parseFloat(planRes.rows[0].total_amount_due);
        const newAmountDueFromReq = amount_due !== undefined ? parseFloat(amount_due) : parseFloat(currentInstallment.amount_due);
        
        const newDueDate = due_date || currentInstallment.due_date;
        const newNotes = notes !== undefined ? notes : currentInstallment.notes;
        let newStatus = status || currentInstallment.status;
        const currentAmountPaid = parseFloat(currentInstallment.amount_paid || 0);

        if (amount_due !== undefined) {
            if (newAmountDueFromReq <= currentAmountPaid && newAmountDueFromReq > 0) newStatus = 'paid';
            else if (newAmountDueFromReq === 0) newStatus = 'waived';
            else if (currentAmountPaid > 0 && newAmountDueFromReq > currentAmountPaid) newStatus = 'partially_paid';
            else newStatus = 'pending';
        }
        
        await client.query(
            `UPDATE student_installments SET due_date = $1, amount_due = $2, status = $3, notes = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`,
            [newDueDate, newAmountDueFromReq, newStatus, newNotes, targetId]
        );
        console.log(`[Backend] Updated target installment ${targetId} with new amount: ${newAmountDueFromReq}`);

        const allInstallments = (await client.query('SELECT * FROM student_installments WHERE payment_plan_id = $1 ORDER BY installment_number', [paymentPlanId])).rows;
        
        let totalAllocatedAmount = 0;
        const redistributableInstallments = [];

        // --- ✅ CORE FIX: Correctly identify fixed vs. redistributable installments ---
        allInstallments.forEach(inst => {
            // The installment being edited is now considered "fixed"
            // Compare parsed integer ID with the targetId number to avoid type issues.
            if (parseInt(inst.id) === targetId) {
                totalAllocatedAmount += newAmountDueFromReq;
            } 
            // Any other paid, waived, or partially paid installments are also fixed
            else if (inst.status === 'paid' || inst.status === 'waived' || inst.status === 'partially_paid') {
                totalAllocatedAmount += parseFloat(inst.amount_due);
            } 
            // Only truly pending installments can be redistributed
            else {
                redistributableInstallments.push(inst);
            }
        });

        console.log(`[Backend] Total fixed amount (edited + paid/waived/partial): ${totalAllocatedAmount}`);
        console.log(`[Backend] Found ${redistributableInstallments.length} pending installments to redistribute over.`);

        const remainingAmountToRedistribute = originalPlanTotalDue - totalAllocatedAmount;
        console.log(`[Backend] Remaining amount to redistribute: ${remainingAmountToRedistribute}`);

        if (redistributableInstallments.length > 0) {
            if (remainingAmountToRedistribute < 0) {
                 await client.query('ROLLBACK');
                 return res.status(400).json({ error: `التعديل غير ممكن. مجموع الأقساط الثابتة (${totalAllocatedAmount.toFixed(2)}) يتجاوز إجمالي الرسوم (${originalPlanTotalDue.toFixed(2)}).`});
            }

            const amountPerInstallment = remainingAmountToRedistribute / redistributableInstallments.length;
            let sumOfRedistributedAmounts = 0;

            for (let i = 0; i < redistributableInstallments.length; i++) {
                const inst = redistributableInstallments[i];
                let newAmountForThisInst = parseFloat(amountPerInstallment.toFixed(2));
                
                if (i === redistributableInstallments.length - 1) {
                    newAmountForThisInst = parseFloat((remainingAmountToRedistribute - sumOfRedistributedAmounts).toFixed(2));
                }
                
                sumOfRedistributedAmounts += newAmountForThisInst;
                
                await client.query(
                    'UPDATE student_installments SET amount_due = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [newAmountForThisInst, inst.id]
                );
                 console.log(`[Backend] Redistributed to installment ${inst.id}. New amount: ${newAmountForThisInst}`);
            }
        } else if (Math.abs(remainingAmountToRedistribute) > 0.01) { // Check for non-zero remainder with a small tolerance
            console.warn(`[Backend] Warning: Total due mismatch of ${remainingAmountToRedistribute.toFixed(2)} with no pending installments to adjust.`);
            // Rollback if there's a mismatch and no way to balance it
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `حدث خلل في الموازنة. المبلغ المتبقي بعد التعديل هو ${remainingAmountToRedistribute.toFixed(2)} ولا توجد أقساط لتوزيعه عليها.` });
        }

        await client.query('COMMIT');
        console.log(`[Backend] Transaction committed successfully for installment ${targetId}.`);
        
        // Fetch the final state of the updated installment to return it
        const finalResult = await client.query('SELECT * FROM student_installments WHERE id = $1', [targetId]);
        res.json({ message: "تم تحديث القسط وإعادة توزيع الأقساط بنجاح.", installment: finalResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ فشل في تحديث القسط:", err.message, err.stack);
        res.status(500).json({ error: "فشل في تحديث القسط: " + err.message });
    } finally {
        client.release();
    }
});



app.delete('/api/installments/:installment_id', async (req, res) => {
    const { installment_id } = req.params;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. جلب تفاصيل القسط المراد حذفه وخطة الدفع الخاصة به.
        const installmentToDeleteRes = await client.query('SELECT payment_plan_id, amount_due FROM student_installments WHERE id = $1', [installment_id]);
        if (installmentToDeleteRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "القسط غير موجود." });
        }
        const paymentPlanId = installmentToDeleteRes.rows[0].payment_plan_id;
        const deletedInstallmentAmount = parseFloat(installmentToDeleteRes.rows[0].amount_due); // المبلغ الذي سيتم إعادة توزيعه

        // 2. حذف القسط من جدول الأقساط
        const deleteResult = await client.query('DELETE FROM student_installments WHERE id = $1 RETURNING *', [installment_id]);
        if (deleteResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'لم يتم العثور على القسط لحذفه.' });
        }

        // 3. جلب تفاصيل خطة الدفع الأصلية (هنا total_amount_due يمثل المبلغ الكلي الأصلي للخطة)
        const paymentPlanRes = await client.query('SELECT total_amount_due, down_payment_amount FROM student_payment_plans WHERE id = $1', [paymentPlanId]);
        if (paymentPlanRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'خطة الدفع المرتبطة بالقسط غير موجودة.' });
        }
        const originalPlanTotalAmountDue = parseFloat(paymentPlanRes.rows[0].total_amount_due);
        const downPaymentAmount = parseFloat(paymentPlanRes.rows[0].down_payment_amount || 0);

        // 4. جلب جميع الأقساط المتبقية لخطة الدفع، وحساب مجموع المدفوع منها
        const remainingInstallmentsRes = await client.query(
            'SELECT id, amount_due, amount_paid, status FROM student_installments WHERE payment_plan_id = $1 ORDER BY installment_number ASC',
            [paymentPlanId]
        );
        const remainingInstallments = remainingInstallmentsRes.rows;

        let totalPaidSumFromRemainingInstallments = 0;
        let pendingOrPartiallyPaidInstallments = [];

        remainingInstallments.forEach(inst => {
            totalPaidSumFromRemainingInstallments += parseFloat(inst.amount_paid || 0);
            // نعتبر الأقساط "pending" أو "partially_paid" أهدافاً لإعادة التوزيع
            if (inst.status === 'pending' || inst.status === 'partially_paid') {
                pendingOrPartiallyPaidInstallments.push(inst);
            }
        });

        // 5. حساب المبلغ الإجمالي الذي يجب توزيعه على الأقساط المستقبلية
        // هذا المبلغ هو (المبلغ الكلي الأصلي للخطة - الدفعة المقدمة - مجموع ما تم دفعه على جميع الأقساط المتبقية)
        const totalAmountToBeCoveredByFutureInstallments = originalPlanTotalAmountDue - downPaymentAmount - totalPaidSumFromRemainingInstallments;

        // 6. إعادة توزيع المبلغ على الأقساط المتبقية غير المدفوعة بالكامل
        if (pendingOrPartiallyPaidInstallments.length > 0) {
            const newAmountPerInstallment = totalAmountToBeCoveredByFutureInstallments / pendingOrPartiallyPaidInstallments.length;
            let currentSumForCheck = 0;

            for (let i = 0; i < pendingOrPartiallyPaidInstallments.length; i++) {
                const inst = pendingOrPartiallyPaidInstallments[i];
                let updatedAmount = parseFloat(newAmountPerInstallment.toFixed(2)); // تقريب إلى رقمين عشريين

                // ضبط القسط الأخير لضمان مطابقة المجموع تمامًا (لإصلاح أخطاء التقريب)
                if (i === pendingOrPartiallyPaidInstallments.length - 1) {
                    updatedAmount = parseFloat((totalAmountToBeCoveredByFutureInstallments - currentSumForCheck).toFixed(2));
                }
                
                await client.query(
                    `UPDATE student_installments SET amount_due = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                    [updatedAmount, inst.id]
                );
                currentSumForCheck += updatedAmount;
            }
        } else if (totalAmountToBeCoveredByFutureInstallments > 0) {
            // إذا لم يتبق أقساط "معلقة" أو "مدفوعة جزئيا" لتوزيع المبلغ عليها
            // هذا يعني أن هناك مبلغ متبقٍ يجب دفعه، ولكن لا توجد أقساط مستقبلية
            // في هذه الحالة، يجب أن يتغير حالة الخطة لتشير إلى ذلك،
            // أو يمكن تسجيل هذا المبلغ كدين متبقٍ على الطالب.
            // لغرض هذا الطلب، سنسمح لـ trigger بتحديث حالة الخطة.
            // total_amount_due لخطة الدفع لن يتغير، والرصيد المتبقي سيُظهر هذا المبلغ.
        }

        // 7. تحديث حالة خطة الدفع (سيتم ذلك بواسطة الـ trigger 'update_plan_financials_and_status'
        // الذي تم تعديله مسبقاً لعدم لمس total_amount_due في خطة الدفع).
        // فقط تأكد من أن الـ trigger سيتم تشغيله بشكل صحيح بعد هذه التحديثات.

        await client.query('COMMIT');
        res.status(200).json({ message: 'تم حذف القسط وإعادة توزيع المبالغ بنجاح.', deleted_installment: deleteResult.rows[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'فشل حذف القسط وإعادة توزيع المبالغ: ' + err.message });
    } finally {
        client.release();
    }
});



  app.get('/api/teacher-lessons/:class_id', async (req, res) => {
    // const { class_id } = req.params; // class_id is no longer needed here.
    try {
      // Correctly query the dedicated table for storing lesson counts.
      const result = await pool.query(`SELECT teacher_id, total_lessons FROM teacher_lessons`);
      res.json(result.rows);
    } catch (err) {
      console.error("Error loading teacher lessons:", err.message);
      res.status(500).json({ error: err.message });
    }
  });
app.post('/api/students/:student_id/additional-payment', async (req, res) => {
    const { student_id } = req.params;
    const { amount_paid, payment_date, payment_method, transaction_reference, notes } = req.body;

    console.log(`[Backend] Recording additional payment for student ID: ${student_id}. Payload:`, req.body);

    if (!amount_paid || parseFloat(amount_paid) <= 0 || !payment_date) {
        console.error(`[Backend] Error: Amount paid (positive value) and payment date are required for additional payment for student ${student_id}.`);
        return res.status(400).json({ error: 'المبلغ المدفوع (قيمة موجبة) وتاريخ الدفع مطلوبان للدفعة الإضافية.' });
    }

    const client = await pool.connect(); // Get a client from the pool once
    try {
        let newInstallmentRes = null;
        let retries = 0;
        const MAX_RETRIES = 5; // Maximum number of retry attempts

        // Declare paymentPlanId and currentPlanTotalDue outside the loop
        // so they are accessible after the loop finishes.
        let paymentPlanId = null;
        let currentPlanTotalDue = 0;

        while (retries < MAX_RETRIES) {
            await client.query('BEGIN'); // Start a new transaction for each attempt
            try {
                // 1. Fetch the student's current payment plan (the latest one)
                // This is fetched within the transaction to ensure it's up-to-date for this attempt.
                const planRes = await client.query(`
                    SELECT id, total_amount_due, down_payment_amount FROM student_payment_plans 
                    WHERE student_id = $1
                    ORDER BY created_at DESC LIMIT 1
                `, [student_id]);

                if (planRes.rows.length === 0) {
                    // No plan found, so rollback and exit immediately
                    await client.query('ROLLBACK');
                    console.error(`[Backend] Error: No payment plan found for student ${student_id} to record additional payment.`);
                    return res.status(404).json({ error: 'لا توجد خطة دفع لهذا الطالب لتسجيل دفعة إضافية.' });
                }
                const paymentPlan = planRes.rows[0];
                
                // Assign values to the variables declared outside the loop
                paymentPlanId = paymentPlan.id;
                currentPlanTotalDue = parseFloat(paymentPlan.total_amount_due);

                // 2. Determine the next unique negative installment number (without FOR UPDATE on aggregate)
                const maxNegativeInstallmentRes = await client.query(`
                    SELECT MIN(installment_number) AS min_negative_installment FROM student_installments 
                    WHERE payment_plan_id = $1 AND installment_number < 0;
                `, [paymentPlanId]);

                const nextInstallmentNumber = (maxNegativeInstallmentRes.rows[0].min_negative_installment || 0) - 1;
                console.log(`[Backend] Generated next unique installment number for additional payment (Attempt ${retries + 1}): ${nextInstallmentNumber}`);

                // 3. Insert the additional payment as a special installment
                const additionalPaymentNotes = `دفعة مقدمة : ${amount_paid} بتاريخ ${payment_date}. ${notes || ''}`;
                
                newInstallmentRes = await client.query(
                    `INSERT INTO student_installments (payment_plan_id, installment_number, due_date, amount_due, amount_paid, payment_date, status, payment_method, transaction_reference, notes)
                    VALUES ($1, $2, $3, $4, $4, $3, 'paid', $5, $6, $7) RETURNING *`,
                    [
                        paymentPlanId, 
                        nextInstallmentNumber, // Use the unique negative installment number
                        payment_date, 
                        parseFloat(amount_paid), 
                        payment_method, 
                        transaction_reference, 
                        additionalPaymentNotes
                    ]
                );
                console.log(`[Backend] Recorded additional payment installment (ID: ${newInstallmentRes.rows[0].id}) for plan ${paymentPlanId}.`);

                // All operations for this attempt succeeded, commit the transaction.
                await client.query('COMMIT'); 
                break; // Exit retry loop on successful commit

            } catch (innerErr) {
                // Rollback the current transaction if an error occurs
                await client.query('ROLLBACK'); 

                if (innerErr.code === '23505' && retries < MAX_RETRIES - 1) { // Unique violation error
                    console.warn(`[Backend] Duplicate key error (23505) on installment insert, retrying... (Attempt ${retries + 1})`);
                    retries++;
                    continue; // Continue to the next retry attempt
                } else {
                    // Re-throw other errors or if max retries reached
                    throw innerErr;
                }
            }
        }

        if (!newInstallmentRes) { // If loop finished without successfully setting newInstallmentRes
            console.error(`[Backend] Failed to insert additional payment after ${MAX_RETRIES} retries for student ${student_id}.`);
            return res.status(500).json({ error: 'فشل في تسجيل الدفعة الإضافية بعد عدة محاولات بسبب تعارض البيانات.' });
        }
        
        // Ensure paymentPlanId is available before proceeding to recalculation
        if (!paymentPlanId) {
            console.error(`[Backend] Critical Error: paymentPlanId is not defined after retry loop for student ${student_id}.`);
            return res.status(500).json({ error: 'حدث خطأ غير متوقع في معالجة الدفعة الإضافية: بيانات خطة الدفع غير متوفرة.' });
        }


        // --- Recalculate and update plan status based on ALL *committed* installments ---
        // This part runs AFTER a successful new installment has been committed.
        const allInstallmentsAfterNewPayment = await client.query(
            'SELECT amount_due, amount_paid, status FROM student_installments WHERE payment_plan_id = $1',
            [paymentPlanId]
        );

        let totalPaidAcrossAllInstallments = 0;
        allInstallmentsAfterNewPayment.rows.forEach(inst => {
            totalPaidAcrossAllInstallments += parseFloat(inst.amount_paid || 0);
        });

        const newRemainingTotalToCover = Math.max(0, currentPlanTotalDue - totalPaidAcrossAllInstallments);

        const pendingOrPartiallyPaidRegularInstallmentsRes = await client.query(
            `SELECT id, amount_due, amount_paid FROM student_installments 
             WHERE payment_plan_id = $1 AND installment_number > 0 AND (status = 'pending' OR status = 'partially_paid') 
             ORDER BY installment_number ASC`,
            [paymentPlanId]
        );
        const pendingOrPartiallyPaidInstallments = pendingOrPartiallyPaidRegularInstallmentsRes.rows;

        let sumPaidInPendingInstallments = 0;
        pendingOrPartiallyPaidInstallments.forEach(inst => {
            sumPaidInPendingInstallments += parseFloat(inst.amount_paid || 0);
        });

        const amountToRedistributeOnPending = newRemainingTotalToCover - sumPaidInPendingInstallments;

        // Start a new transaction for the redistribution and plan status update
        await client.query('BEGIN');
        try {
            if (pendingOrPartiallyPaidInstallments.length > 0 && amountToRedistributeOnPending > 0) {
                const newAmountPerInstallment = parseFloat((amountToRedistributeOnPending / pendingOrPartiallyPaidInstallments.length).toFixed(2));
                let currentSumDistributed = 0;

                for (let i = 0; i < pendingOrPartiallyPaidInstallments.length; i++) {
                    const inst = pendingOrPartiallyPaidInstallments[i];
                    let updatedAmountForThisInstallment = newAmountPerInstallment;

                    if (i === pendingOrPartiallyPaidInstallments.length - 1) {
                        updatedAmountForThisInstallment = parseFloat((amountToRedistributeOnPending - currentSumDistributed).toFixed(2));
                    }
                    
                    await client.query(
                        `UPDATE student_installments SET amount_due = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                        [updatedAmountForThisInstallment, inst.id]
                    );
                    currentSumDistributed += updatedAmountForThisInstallment;
                    console.log(`[Backend] Updated regular installment ${inst.id}: new amount_due = ${updatedAmountForThisInstallment}`);
                }
            } else if (amountToRedistributeOnPending <= 0 && pendingOrPartiallyPaidInstallments.length > 0) {
                for (const inst of pendingOrPartiallyPaidInstallments) {
                     let newStatus = 'waived';
                     if (parseFloat(inst.amount_paid) >= parseFloat(inst.amount_due) || (newRemainingTotalToCover <= 0 && parseFloat(inst.amount_paid) > 0)) {
                        newStatus = 'paid';
                     }
                    await client.query(
                        `UPDATE student_installments SET amount_due = 0.00, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                        [newStatus, inst.id]
                    );
                    console.log(`[Backend] Waived/Paid installment ${inst.id} due to zero remaining total.`);
                }
            }

            // Update the plan's status (total_amount_due is handled by trigger if any, else it stays original)
            const allInstallmentsForStatusUpdate = await client.query(
                'SELECT status, amount_due, amount_paid, due_date FROM student_installments WHERE payment_plan_id = $1', [paymentPlanId]
            );
            
            let allPaid = true;
            let hasOverdue = false;
            const today = new Date().toISOString().split('T')[0];

            allInstallmentsForStatusUpdate.rows.forEach(inst => {
                if (inst.status !== 'paid' && inst.status !== 'waived') {
                    allPaid = false;
                }
                if ((inst.status === 'pending' || inst.status === 'partially_paid') && inst.due_date < today && parseFloat(inst.amount_paid) < parseFloat(inst.amount_due)) {
                    hasOverdue = true;
                }
            });

            let planStatus = 'active';
            if (allPaid) {
                planStatus = 'fully_paid';
            } else if (hasOverdue) {
                planStatus = 'overdue_installments';
            }

            await client.query(
                'UPDATE student_payment_plans SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [planStatus, paymentPlanId]
            );

            await client.query('COMMIT'); // Commit the redistribution and status update transaction

            console.log(`[Backend] Additional payment transaction committed successfully for student ${student_id}.`);
            res.json({ message: 'تم تسجيل الدفعة الإضافية وإعادة توزيع الأقساط بنجاح.' });

        } catch (err) {
            await client.query('ROLLBACK'); // Rollback redistribution if it fails
            console.error("❌ Error in redistribution or plan status update transaction:", err.message, err.stack);
            res.status(500).json({ error: 'فشل في تحديث حالة الخطة أو إعادة توزيع الأقساط بعد الدفعة الإضافية: ' + err.message });
        }

    } catch (err) {
        // This catch block handles errors that occur outside the retry loop
        // or errors re-thrown by the retry loop after max retries.
        console.error("❌ Critical Error in additional payment process:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في تسجيل الدفعة الإضافية: ' + err.message });
    } finally {
        client.release(); // Ensure the client is released back to the pool
    }
});

  app.post('/api/teacher-lessons', async (req, res) => {
    const { teacher_id, total_lessons } = req.body;
    if (!teacher_id || total_lessons === undefined) {
      return res.status(400).json({ error: 'الرقم التعريفي للمعلم وعدد الحصص مطلوبان' });
    }

    try {
      await pool.query(`
        INSERT INTO teacher_lessons (teacher_id, total_lessons)
        VALUES ($1, $2)
        ON CONFLICT (teacher_id) DO UPDATE SET total_lessons = EXCLUDED.total_lessons
      `, [teacher_id, total_lessons]);

      res.status(200).json({ message: '✅ تم الحفظ بنجاح' });
    } catch (err) {
      console.error('❌ Error saving teacher lessons:', err.message);
      res.status(500).json({ error: 'حدث خطأ أثناء الحفظ' });
    }
  });
app.get('/api/students-financial-overview', async (req, res) => {
    const { school_id, class_id, division_id, student_name_barcode } = req.query; // Changed from search_term to student_name_barcode for clarity
    try {
        let queryText = `
            SELECT
                s.id as student_id,
                s.name as student_name,
                s.barcode as student_barcode,
                div.name as division_name,
                cls.name as class_name,
                sch.name as school_name,
                spp.id as payment_plan_id,
                spp.payment_type,
                spp.total_amount_due as total_amount, /* Aliased to match client expectation from earlier versions */
                spp.status as plan_status,
                spp.number_of_installments,
                cf.academic_year as plan_academic_year, /* Aliased to match client expectation */
                COALESCE(SUM(si.amount_paid), 0.00) as calculated_total_paid, /* Aliased to match client expectation */
                (spp.total_amount_due - COALESCE(SUM(si.amount_paid), 0.00)) as calculated_remaining_balance, /* Aliased to match client expectation */
                COUNT(si.id) FILTER (WHERE si.status = 'paid' OR si.status = 'waived') as paid_installments_count
            FROM students s
            JOIN divisions div ON s.division_id = div.id
            JOIN classes cls ON div.class_id = cls.id
            JOIN schools sch ON cls.school_id = sch.id
            LEFT JOIN student_payment_plans spp ON s.id = spp.student_id
            LEFT JOIN class_fees cf ON spp.class_fee_id = cf.id
            LEFT JOIN student_installments si ON spp.id = si.payment_plan_id
            WHERE 1=1
        `;
        const queryParams = [];
        let paramIndex = 1;

        if (school_id) {
            queryText += ` AND sch.id = $${paramIndex++}`;
            queryParams.push(school_id);
        }
        if (class_id) {
            queryText += ` AND cls.id = $${paramIndex++}`;
            queryParams.push(class_id);
        }
        if (division_id) {
            queryText += ` AND div.id = $${paramIndex++}`;
            queryParams.push(division_id);
        }
        if (student_name_barcode) {
            queryText += ` AND (s.name ILIKE $${paramIndex} OR s.barcode ILIKE $${paramIndex})`;
            queryParams.push(`%${student_name_barcode}%`);
            paramIndex++;
        }

        queryText += `
            GROUP BY s.id, s.name, s.barcode, div.name, cls.name, sch.name, spp.id, cf.academic_year, spp.total_amount_due, spp.status, spp.number_of_installments, spp.payment_type
            ORDER BY sch.name, cls.name, div.name, s.name, cf.academic_year DESC
        `;

        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching students financial overview:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في جلب نظرة عامة مالية للطلاب: ' + err.message });
    }
});


  async function generateCertificateSheet(worksheet, data) {
      // --- 1. تحديد النتيجة النهائية ---
      let isSuccessful = true;
      if (!data.grades || data.grades.length === 0) {
          isSuccessful = false;
      } else {
          data.grades.forEach(grade => {
              const finalOverallGrade = grade.final_with_makeup !== null ? grade.final_with_makeup : grade.final_grade;
              if (Math.round(finalOverallGrade || 0) < 50) {
                  isSuccessful = false;
              }
          });
      }
      const finalResultText = isSuccessful ? 'نــاجــح' : 'مــكــمــل';

      // --- 2. إعداد الصفحة (A4 بدقة عالية) ---
      worksheet.views = [{ rightToLeft: true }];
      worksheet.pageSetup.orientation = 'portrait';
      worksheet.pageSetup.paperSize = 9; // A4
      worksheet.pageSetup.horizontal = 'center';
      worksheet.pageSetup.vertical = 'center';
      worksheet.pageSetup.fitToPage = true; // خاصية مهمة لضمان الملائمة
      worksheet.pageSetup.fitToWidth = 1;
      worksheet.pageSetup.fitToHeight = 1;
      worksheet.pageSetup.margins = {
          top: 0.7, left: 0.4, right: 0.4, bottom: 0.7, header: 0.2, footer: 0.2
      };

      // --- 3. تحديد عرض الأعمدة (محسوب بدقة لـ A4) ---
      // تم حساب مجموع عرض الأعمدة ليكون مناسبًا تمامًا لورقة A4 مع الهوامش
      // عدد الأعمدة الآن 13 (A-M)
      worksheet.columns = [
          { width: 18 },  // المادة (A)
          { width: 6 },   // الشهر الأول (B)
          { width: 6 },   // الشهر الثاني (C)
          { width: 7 },   // معدل ف1 (D)
          { width: 8 },   // نصف السنة (E)
          { width: 6 },   // الشهر الأول (F)
          { width: 6 },   // الشهر الثاني (G)
          { width: 7 },   // معدل ف2 (H)
          { width: 8 },   // السعي السنوي (I)
          { width: 8 },   // آخر السنة (J)
          { width: 8 },   // النهائي (K)
          { width: 7 },   // دور ثاني (L)
          { width: 10 },  // النهائي بعد الدور الثاني (M)
      ];


      // --- 4. تعريف الأنماط (تصميم جديد) ---
      const titleFont = { name: 'Cairo', size: 20, bold: true, color: { argb: 'FF003366' } };
      const subtitleFont = { name: 'Cairo', size: 15, bold: true, color: { argb: 'FF004080' } };
      const infoFont = { name: 'Cairo', size: 12, bold: true };
      const headerFont = { name: 'Cairo', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      const cellFont = { name: 'Cairo', size: 11 };
      const boldCellFont = { name: 'Cairo', size: 11, bold: true };
      const centerAlignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      const rightAlignment = { vertical: 'middle', horizontal: 'right', wrapText: false };

      const thinBorder = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004080' } }; // أزرق داكن
      const highlightFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F0FA' } }; // أزرق فاتح جداً

      // --- 5. إضافة العناوين الرئيسية ---
      worksheet.mergeCells('A1:M1');
      worksheet.getCell('A1').value = data.school_name || "اسم المدرسة";
      worksheet.getCell('A1').font = titleFont;
      worksheet.getCell('A1').alignment = centerAlignment;
      worksheet.getRow(1).height = 35;


      worksheet.mergeCells('A2:M2');
      worksheet.getCell('A2').value = `شهادة درجات الطالب للعام الدراسي ${data.term || '----'}`;
      worksheet.getCell('A2').font = subtitleFont;
      worksheet.getCell('A2').alignment = centerAlignment;
      worksheet.getRow(2).height = 30;

      worksheet.addRow([]);

      // --- 6. إضافة معلومات الطالب (بتنسيق أفضل) ---
      const infoRow = worksheet.addRow([
          "اسم الطالب:", data.student_name || 'غير متوفر', null, null, null, "الصف:", `${data.class_name || ''} / ${data.division_name || ''}`
      ]);
      infoRow.font = infoFont;
      infoRow.height = 25;

      worksheet.mergeCells(`B${infoRow.number}:E${infoRow.number}`);
      worksheet.mergeCells(`G${infoRow.number}:M${infoRow.number}`);
      infoRow.getCell('A').alignment = rightAlignment;
      infoRow.getCell('B').alignment = rightAlignment;
      infoRow.getCell('F').alignment = rightAlignment;
      infoRow.getCell('G').alignment = rightAlignment;

      worksheet.addRow([]);

      // --- 7. إنشاء رأس الجدول ---
      const tableHeader = worksheet.addRow([
          'المادة', 'الشهر الاول', 'الشهر الثاني', 'معدل الفصل الاول', 'نصف السنة', 'الشهر الاول', 'الشهر الثاني', 'معدل الفصل الثاني', 'السعي السنوي', 'الامتحان النهائي', 'السعي النهائي', 'درجة امتحان الاكمال ', 'السعي النهائي بعد الاكمال'
      ]);
      tableHeader.height = 40;
      tableHeader.eachCell(cell => {
          cell.font = headerFont;
          cell.fill = headerFill;
          cell.alignment = centerAlignment;
          cell.border = thinBorder;
      });

      // --- 8. تعبئة بيانات الدرجات ---
      if (data.grades && data.grades.length > 0) {
          const r = (val) => (val !== null && val !== undefined) ? Math.round(val) : '--';

          data.grades.forEach(grade => {
              const row = worksheet.addRow([
                  grade.subject,
                  r(grade.month1_term1), r(grade.month2_term1), r(grade.avg1), r(grade.mid_term),
                  r(grade.month1_term2), r(grade.month2_term2), r(grade.avg2), r(grade.s3),
                  r(grade.final_exam), r(grade.final_grade), r(grade.makeup_exam), r(grade.final_with_makeup)
              ]);
              row.height = 40;
              row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                  cell.border = thinBorder;
                  cell.alignment = centerAlignment;
                  cell.font = (colNumber === 1) ? { ...cellFont, horizontal: 'right' } : cellFont;

                  if ([4, 5, 8, 9, 11, 13].includes(colNumber)) {
                      cell.font = boldCellFont;
                      cell.fill = highlightFill;
                  }
              });
          });
      } else {
          worksheet.addRow([]);
          worksheet.mergeCells(`A${worksheet.rowCount + 1}:M${worksheet.rowCount + 1}`);
          const noDataCell = worksheet.getCell(`A${worksheet.rowCount}`);
          noDataCell.value = 'لا توجد درجات مسجلة لهذا الطالب';
          noDataCell.alignment = centerAlignment;
          noDataCell.font = { ...infoFont, color: { argb: 'FFC62828' } };
          noDataCell.height = 40;
      }

      worksheet.addRow([]);

      // --- 9. إضافة النتيجة النهائية (بتصميم بارز) ---
      const resultRow = worksheet.addRow([]);
      resultRow.height = 40;

      worksheet.mergeCells(`A${resultRow.number}:J${resultRow.number}`);
      const resultLabelCell = worksheet.getCell(`A${resultRow.number}`);
      resultLabelCell.value = 'الـنـتـيـجـة الـنـهـائـيـة';
      resultLabelCell.font = { name: 'Cairo', size: 16, bold: true };
      resultLabelCell.alignment = centerAlignment;
      resultLabelCell.border = thinBorder;
      // يجب تطبيق الحدود على كل الخلايا المدموجة
      for (let i = 'B'.charCodeAt(0); i <= 'J'.charCodeAt(0); i++) {
          worksheet.getCell(`${String.fromCharCode(i)}${resultRow.number}`).border = thinBorder;
      }


      worksheet.mergeCells(`K${resultRow.number}:M${resultRow.number}`);
      const resultValueCell = worksheet.getCell(`K${resultRow.number}`);
      resultValueCell.value = finalResultText;
      resultValueCell.font = { name: 'Cairo', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      resultValueCell.alignment = centerAlignment;
      resultValueCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isSuccessful ? 'FF388E3C' : 'FFD32F2F' } // أخضر للنجاح، أحمر للإكمال
      };
      resultValueCell.border = {
          top: { style: 'medium' }, left: { style: 'medium' },
          bottom: { style: 'medium' }, right: { style: 'medium' }
      };
      worksheet.getCell(`L${resultRow.number}`).border = resultValueCell.border;
      worksheet.getCell(`M${resultRow.number}`).border = resultValueCell.border;

      // --- 10. إضافة مكان التوقيع ---
      worksheet.addRow([]);
      worksheet.addRow([]);
      worksheet.mergeCells(`J${worksheet.rowCount + 1}:M${worksheet.rowCount + 1}`);
      const signatureCell = worksheet.getCell(`J${worksheet.rowCount}`);
      signatureCell.value = "توقيع مدير المدرسة";
      signatureCell.font = infoFont;
      signatureCell.alignment = centerAlignment;
      signatureCell.border = { top: { style: 'thin' } };
      signatureCell.height = 30;
  }


async function getStudentCertificateData(studentId, termName) {
    console.log(`[DEBUG] Entering getStudentCertificateData for student ID: ${studentId}, term name: ${termName}`);

    if (!studentId || !termName) {
        console.error(`[DEBUG] Error: Student ID or term name is missing.`);
        throw new Error('رقم الطالب والفصل الدراسي مطلوبان.');
    }

    // الخطوة 1: جلب معرف الفصل الدراسي (Term ID) من اسم الفصل الدراسي (Term Name)
    const termIdRes = await pool.query(`SELECT id FROM terms WHERE name = $1`, [termName]);
    if (termIdRes.rows.length === 0) {
        console.warn(`[DEBUG] Term with name '${termName}' not found.`);
        return null; // لا يمكن المتابعة إذا لم يتم العثور على الفصل الدراسي
    }
    const termId = termIdRes.rows[0].id;
    console.log(`[DEBUG] Resolved term name '${termName}' to term ID: ${termId}`);


    const studentRes = await pool.query(`
        SELECT
            s.id as student_id, s.name as student_name, s.division_id, d.name as division_name,
            c.name as class_name, c.id as class_id, sch.name as school_name
        FROM students s
        LEFT JOIN divisions d ON s.division_id = d.id
        LEFT JOIN classes c ON d.class_id = c.id
        LEFT JOIN schools sch ON c.school_id = sch.id
        WHERE s.id = $1`,
        [studentId]
    );

    if (studentRes.rows.length === 0) {
        console.warn(`[DEBUG] No student found for ID: ${studentId}`);
        return null;
    }
    const studentData = studentRes.rows[0];

    if (!studentData.class_id) {
        console.warn(`[DEBUG] Student ${studentId} has no class_id. Returning empty grades.`);
        return { ...studentData, term: termName, grades: [] };
    }

    // دالة مساعدة لتنظيف النصوص للمطابقة
    const cleanString = (str) => {
        if (typeof str !== 'string') return '';
        return str.trim()
                  .replace(/ى/g, 'ي')
                  .replace(/[أإ]/g, 'ا')
                  .replace(/ة/g, 'ه')
                  .toLowerCase();
    };

    // الخطوة 2: جلب جميع المواد الفريدة للصف من جدول class_subjects
    const classSubjectsRes = await pool.query(
        `SELECT DISTINCT TRIM(subject) AS subject FROM class_subjects WHERE class_id = $1 ORDER BY subject`,
        [studentData.class_id]
    );
    const classSubjects = classSubjectsRes.rows.map(row => cleanString(row.subject));

    // الخطوة 3: جلب جميع درجات الطالب باستخدام معرف الفصل الدراسي (Term ID)
    const studentGradesRes = await pool.query(
        `SELECT
            TRIM(subject) AS subject,
            month1_term1, month2_term1, mid_term, month1_term2, month2_term2, final_exam, makeup_exam
        FROM student_grades
        WHERE student_id = $1 AND term = $2`,
        [studentId, termId]
    );
    const studentExistingGradesMap = new Map();
    studentGradesRes.rows.forEach(grade => {
        studentExistingGradesMap.set(cleanString(grade.subject), grade);
    });

    // الخطوة 4: دمج المواد من قائمة الصف مع الدرجات الموجودة
    const allSubjects = new Set(classSubjects);
    studentExistingGradesMap.forEach((_value, key) => allSubjects.add(key));
    const sortedSubjects = Array.from(allSubjects).sort();

    const processedGrades = sortedSubjects.map(subject => {
        const g = studentExistingGradesMap.get(subject) || {};
        
        const numOrNull = (val) => (val == null || val === '' ? null : Number(val));
        const m1t1 = numOrNull(g.month1_term1), m2t1 = numOrNull(g.month2_term1), mid = numOrNull(g.mid_term);
        const m1t2 = numOrNull(g.month1_term2), m2t2 = numOrNull(g.month2_term2), finalExam = numOrNull(g.final_exam);
        const makeupExam = numOrNull(g.makeup_exam);

        const avg1 = (m1t1 !== null && m2t1 !== null) ? (m1t1 + m2t1) / 2 : null;
        const avg2 = (m1t2 !== null && m2t2 !== null) ? (m1t2 + m2t2) / 2 : null;
        
        const s3 = (avg1 !== null && mid !== null && avg2 !== null) ? ((avg1 + mid + avg2) / 3) : null;

        // --- بداية التعديل على منطق الحساب ---
        let final_grade = null;
        // يتم حساب الدرجة النهائية (المعتمدة على الدور الأول) فقط إذا لم يكن هناك امتحان إكمال
        if (s3 !== null && finalExam !== null && makeupExam === null) {
            final_grade = (s3 + finalExam) / 2;
        }

        let final_with_makeup = null;
        // يتم حساب الدرجة بعد الإكمال فقط إذا كان هناك امتحان إكمال
        if (s3 !== null && makeupExam !== null) {
            final_with_makeup = (s3 + makeupExam) / 2;
        }
        // --- نهاية التعديل ---

        return { 
            subject: subject,
            month1_term1: m1t1, month2_term1: m2t1, mid_term: mid, 
            month1_term2: m1t2, month2_term2: m2t2, final_exam: finalExam, 
            makeup_exam: makeupExam, 
            avg1: avg1,
            avg2: avg2,
            s3: s3, 
            final_grade: final_grade, 
            final_with_makeup: final_with_makeup 
        };
    });

    console.log(`[DEBUG] Processed grades to be returned for student ${studentId}:`, processedGrades);

    return { ...studentData, term: termName, grades: processedGrades };
}


app.post('/api/submit-grades', async (req, res) => {
    const { student_id, term, grades } = req.body;
    try {
        for (const g of grades) {
            await pool.query(`
                INSERT INTO student_grades (student_id, subject, term, month1_term1, month2_term1, mid_term, month1_term2, month2_term2, final_exam, makeup_exam)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (student_id, subject, term)
                DO UPDATE SET
                    month1_term1 = EXCLUDED.month1_term1,
                    month2_term1 = EXCLUDED.month2_term1,
                    mid_term = EXCLUDED.mid_term,
                    month1_term2 = EXCLUDED.month1_term2,
                    month2_term2 = EXCLUDED.month2_term2,
                    final_exam = EXCLUDED.final_exam,
                    makeup_exam = EXCLUDED.makeup_exam
            `, [
                student_id, g.subject, term,
                g.month1_term1, g.month2_term1, g.mid_term,
                g.month1_term2, g.month2_term2,
                g.final_exam, g.makeup_exam
            ]);
        }
        res.json({ success: true });
    } catch (err) {
        console.error('❌ Error saving grades:', err);
        res.status(500).json({ error: 'Failed to save grades' });
    }
});


  app.get('/api/student-certificate-data', async (req, res) => {
      console.log(`\n\n--- 🚀 طلب جديد 🚀 ---`);
      console.log(`[STEP 1] ==> تم طلب المسار /api/student-certificate-data.`);
      console.log(`[STEP 2] ==> القيم المستلمة - student_id: '${req.query.student_id}', term: '${req.query.term}'`);
      try {
          const certificateData = await getStudentCertificateData(req.query.student_id, req.query.term);
          console.log(`[STEP 8] ==> الرد النهائي. سيتم إرسال JSON يحتوي على ${certificateData?.grades?.length ?? 0} مادة.`);
          if (!certificateData) {
              return res.json({});
          }
          res.json(certificateData);
      } catch (err) {
          console.error("[💥 ERROR] حدث خطأ في معالج المسار:", err.message);
          res.status(500).json({ error: 'Failed to fetch certificate data' });
      }
  });
  


// 2. Find the existing app.get('/api/student-search') and replace it with this:
app.get('/api/student-search', async (req, res) => {
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json([]);
    }

    const searchQuery = `%${query.replace(/ى/g, 'ي').replace(/[أإ]/g, 'ا').replace(/ة/g, 'ه')}%`;

    try {
      // ✅ استعلام جديد ومُعاد هيكلته ليكون أكثر قوة وأماناً
      const result = await pool.query(
        `SELECT
          s.id,
          s.name,
          s.barcode,
          (SELECT d.name FROM divisions d WHERE d.id = s.division_id) as division_name,
          (
            SELECT c.name
            FROM classes c
            JOIN divisions d ON c.id = d.class_id
            WHERE d.id = s.division_id
          ) as class_name
        FROM students s
        WHERE
          LOWER(REPLACE(REPLACE(REPLACE(s.name, 'ى', 'ي'), 'أ', 'ا'), 'ة', 'ه')) LIKE LOWER($1)
          OR s.barcode LIKE $1
        LIMIT 10`,
        [searchQuery]
      );
      res.json(result.rows);
    } catch (err) {
      console.error("❌ Error in /api/student-search:", err.message, err.stack);
      res.status(500).json({ error: 'Failed to search for students' });
    }
});




// 3. Add this new API endpoint (app.get('/api/grades-admin-record-data')) anywhere in your server.js, for example, near other student/grade related APIs:
app.get('/api/grades-admin-record-data', async (req, res) => {
    const studentId = req.query.student_id;
    const termName = req.query.term; // This is the term name, not ID

    if (!studentId || !termName) {
        return res.status(400).json({ error: 'معرف الطالب واسم الفصل الدراسي مطلوبان.' });
    }

    try {
        // First, get the term ID from the term name
        const termResult = await pool.query('SELECT id FROM terms WHERE name = $1', [termName]);
        if (termResult.rows.length === 0) {
            return res.status(404).json({ error: 'الفصل الدراسي غير موجود.' });
        }
        const termId = termResult.rows[0].id;

        // Fetch student details
        const studentRes = await pool.query(`
            SELECT
                s.id AS student_id,
                s.name AS student_name,
                s.barcode,
                d.id AS division_id,
                d.name AS division_name,
                c.id AS class_id,
                c.name AS class_name,
                sch.name AS school_name
            FROM students s
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            JOIN schools sch ON c.school_id = sch.id
            WHERE s.id = $1
        `, [studentId]);

        if (studentRes.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على الطالب.' });
        }
        const studentInfo = studentRes.rows[0];

        // Fetch subjects specific to the student's class
        const classSubjectsRes = await pool.query(
            `SELECT DISTINCT subject FROM class_subjects WHERE class_id = $1 ORDER BY subject`,
            [studentInfo.class_id]
        );
        const classSubjects = classSubjectsRes.rows.map(row => row.subject);

        // Fetch existing grades for the student and the specific term ID
        const studentGradesRes = await pool.query(
            `SELECT
                subject, month1_term1, month2_term1, mid_term,
                month1_term2, month2_term2, final_exam, makeup_exam
            FROM student_grades
            WHERE student_id = $1 AND term = $2`,
            [studentId, termId]
        );
        const existingGradesMap = new Map();
        studentGradesRes.rows.forEach(grade => {
            existingGradesMap.set(grade.subject, grade);
        });

        // Combine class subjects with existing grades
        const grades = classSubjects.map(subject => {
            const g = existingGradesMap.get(subject) || {};
            
            // Helper function to safely convert to number, or null
            const numOrNull = (val) => (val == null || val === '' ? null : Number(val));

            const m1t1 = numOrNull(g.month1_term1);
            const m2t1 = numOrNull(g.month2_term1);
            const mid = numOrNull(g.mid_term);
            const m1t2 = numOrNull(g.month1_term2);
            const m2t2 = numOrNull(g.month2_term2);
            const finalExam = numOrNull(g.final_exam);
            const makeupExam = numOrNull(g.makeup_exam);

            // Calculations, use 0 for missing values in calculations to avoid NaN for display
            const calcNum = (val) => (val == null ? 0 : val);

            const avg1 = (m1t1 !== null && m2t1 !== null) ? parseFloat(((calcNum(m1t1) + calcNum(m2t1)) / 2).toFixed(2)) : null;
            const avg2 = (m1t2 !== null && m2t2 !== null) ? parseFloat(((calcNum(m1t2) + calcNum(m2t2)) / 2).toFixed(2)) : null;
            
            let s3 = null;
            if (avg1 !== null && mid !== null && avg2 !== null) {
                s3 = parseFloat(((calcNum(avg1) + calcNum(mid) + calcNum(avg2)) / 3).toFixed(2));
            }

            let final_grade = null;
            if (s3 !== null && finalExam !== null) {
                final_grade = parseFloat(((calcNum(s3) + calcNum(finalExam)) / 2).toFixed(2));
            }

            let final_with_makeup = null;
            if (s3 !== null && makeupExam !== null) {
                final_with_makeup = parseFloat(((calcNum(s3) + calcNum(makeupExam)) / 2).toFixed(2));
            } else if (final_grade !== null) {
                final_with_makeup = final_grade;
            }

            return {
                subject: subject,
                month1_term1: m1t1,
                month2_term1: m2t1,
                mid_term: mid,
                month1_term2: m1t2,
                month2_term2: m2t2,
                final_exam: finalExam,
                makeup_exam: makeupExam,
                avg1: avg1,
                avg2: avg2,
                s3: s3,
                final_grade: final_grade,
                final_with_makeup: final_with_makeup
            };
        });

        res.json({ studentInfo, grades });

    } catch (err) {
        console.error("❌ Error fetching grades admin record data:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في جلب بيانات سجل الإدارة للدرجات.' });
    }
});


// 4. Add this new API endpoint (app.get('/api/student-search-with-filters')) for search suggestions with filters:
app.get('/api/student-search-with-filters', async (req, res) => {
    const { query, schoolId, classId, divisionId } = req.query;

    if (!query || query.length < 2) {
        return res.json([]);
    }

    const searchQuery = `%${query.replace(/ى/g, 'ي').replace(/[أإ]/g, 'ا').replace(/ة/g, 'ه')}%`;
    let queryText = `
        SELECT
            s.id,
            s.name,
            s.barcode,
            d.name AS division_name,
            c.name AS class_name
        FROM students s
        JOIN divisions d ON s.division_id = d.id
        JOIN classes c ON d.class_id = c.id
        WHERE
            (LOWER(REPLACE(REPLACE(REPLACE(s.name, 'ى', 'ي'), 'أ', 'ا'), 'ة', 'ه')) LIKE LOWER($1) OR s.barcode LIKE $1)
    `;
    const queryParams = [searchQuery];
    let paramIndex = 2;

    if (schoolId) {
        queryText += ` AND c.school_id = $${paramIndex++}`;
        queryParams.push(schoolId);
    }
    if (classId) {
        queryText += ` AND d.class_id = $${paramIndex++}`;
        queryParams.push(classId);
    }
    if (divisionId) {
        queryText += ` AND s.division_id = $${paramIndex++}`;
        queryParams.push(divisionId);
    }

    queryText += ` LIMIT 10`;

    try {
        const result = await pool.query(queryText, queryParams);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error in /api/student-search-with-filters:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في البحث عن الطلاب بالمرشحات.' });
    }
});


app.get('/api/students/:student_id/certificate/export', async (req, res) => {
    const { student_id } = req.params;
    const { term } = req.query;

    try {
        // استدعاء مباشر وآمن للدالة المساعدة بدلاً من fetch
        const certificateData = await getStudentCertificateData(student_id, term);

        if (!certificateData) {
            return res.status(404).send('Student data could not be generated.');
        }
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('شهادة درجات');
        await generateCertificateSheet(worksheet, certificateData);
        
        const fileName = `شهادة-${certificateData.student_name.replace(/\s/g, '_')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        
        // **الإصلاح الرئيسي**: لا تستخدم res.end() بعد هذا السطر
        // دالة write مسؤولة عن إنهاء الإرسال بنفسها
        await workbook.xlsx.write(res);

    } catch (err) {
        console.error("Error exporting single certificate:", err.message, err.stack);
        res.status(500).send("Server error generating certificate.");
    }
});


// ✅✅✅ ابحث عن المسار 'app.get('/api/divisions/:division_id/certificates/export')' واستبدله بالكامل بهذا الكود ✅✅✅
app.get('/api/divisions/:division_id/certificates/export', async (req, res) => {
    const { division_id } = req.params;
    const { term } = req.query; // هنا 'term' هو اسم الفصل الدراسي

    if (!division_id || !term) {
        return res.status(400).send('Division ID and Term are required.');
    }

    const client = await pool.connect();
    try {
        // 🚨 الخطوة الجديدة 1: جلب معرف الفصل الدراسي (Term ID) من اسم الفصل الدراسي (Term Name)
        const termIdRes = await client.query(`SELECT id FROM terms WHERE name = $1`, [term]);
        if (termIdRes.rows.length === 0) {
            client.release();
            return res.status(404).send(`الفصل الدراسي '${term}' غير موجود.`);
        }
        const termId = termIdRes.rows[0].id; // هذا هو الـ ID الذي تم حفظ الدرجات به
        console.log(`[DEBUG] Bulk export: Resolved term name '${term}' to term ID: ${termId}`);


        // --- الخطوة 2: جلب جميع الطلاب في الشعبة مع بياناتهم الأساسية ---
        const studentsRes = await client.query(`
            SELECT s.id, s.name as student_name, d.name as division_name, c.name as class_name, sch.name as school_name
            FROM students s
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            JOIN schools sch ON c.school_id = sch.id
            WHERE s.division_id = $1 ORDER BY s.name`,
            [division_id]
        );
        const students = studentsRes.rows;
        if (students.length === 0) {
            client.release();
            return res.status(404).send('No students found in this division.');
        }

        const studentIds = students.map(s => s.id);

        // --- الخطوة 3 (معدلة): جلب جميع الدرجات لكل هؤلاء الطلاب دفعة واحدة باستخدام Term ID ---
        const gradesRes = await client.query(
            // ✅ FIX: Changed from "student_id = $1" to "student_id = ANY($1)"
            `SELECT * FROM student_grades WHERE student_id = ANY($1) AND term = $2`, // 🚨 نستخدم termId هنا
            [studentIds, termId] // 🚨 نستخدم termId هنا
        );
        // تنظيم الدرجات في خريطة (Map) لسهولة الوصول إليها لاحقاً
        const gradesMap = new Map();
        // Helper function for consistent string cleaning - مكررة هنا ولكن ضرورية لعملية الدمج
        const cleanString = (str) => {
            if (typeof str !== 'string') return '';
            return str.trim()
                      .replace(/ى/g, 'ي')
                      .replace(/[أإ]/g, 'ا')
                      .replace(/ة/g, 'ه')
                      .toLowerCase();
        };

        for (const grade of gradesRes.rows) {
            if (!gradesMap.has(grade.student_id)) {
                gradesMap.set(grade.student_id, new Map());
            }
            gradesMap.get(grade.student_id).set(cleanString(grade.subject), grade); // تنظيف المادة هنا أيضاً
        }

        // --- الخطوة 4: جلب قائمة المواد الفريدة من الجدول الأسبوعي لهذه الشعبة ---
        const scheduleSubjectsRes = await client.query(
            `SELECT DISTINCT subject FROM weekly_schedule WHERE division_id = $1`,
            [division_id]
        );
        const scheduleSubjects = new Set(scheduleSubjectsRes.rows.map(r => cleanString(r.subject))); // تنظيف المادة هنا أيضاً

        // --- بدء إنشاء ملف الإكسل ---
        const workbook = new ExcelJS.Workbook();
        let divisionNameForFile, classNameForFile;

        // --- الخطوة 5: المرور على الطلاب (الموجودين في الذاكرة) وتجميع بيانات شهاداتهم ---
        for (const student of students) {
            const studentGrades = gradesMap.get(student.id) || new Map();
            const subjectsForCertificate = new Set(scheduleSubjects);
            studentGrades.forEach((grade, subject) => subjectsForCertificate.add(subject)); // subject هنا هو النظيف من GradesMap
            const sortedSubjects = Array.from(subjectsForCertificate).sort();

            const processedGrades = sortedSubjects.map(subject => {
                const g = studentGrades.get(subject) || {}; // احصل على الدرجة أو كائن فارغ
                const numOrNull = (val) => (val == null || val === '' ? null : Number(val));
                const m1t1 = numOrNull(g.month1_term1), m2t1 = numOrNull(g.month2_term1), mid = numOrNull(g.mid_term);
                const m1t2 = numOrNull(g.month1_term2), m2t2 = numOrNull(g.month2_term2), finalExam = numOrNull(g.final_exam);
                const makeupExam = numOrNull(g.makeup_exam);
                const avg1 = (m1t1 !== null && m2t1 !== null) ? (m1t1 + m2t1) / 2 : null;
                const avg2 = (m1t2 !== null && m2t2 !== null) ? (m1t2 + m2t2) / 2 : null;
                const s3 = (avg1 !== null && mid !== null && avg2 !== null) ? ((avg1 + mid + avg2) / 3) : null;
                const final_grade = (s3 !== null && finalExam !== null) ? (s3 + finalExam) / 2 : null;
                const final_with_makeup = (s3 !== null && makeupExam !== null) ? (s3 + makeupExam) / 2 : null;
                return {
                    subject,
                    month1_term1: m1t1, month2_term1: m2t1, mid_term: mid,
                    month1_term2: m1t2, month2_term2: m2t2, final_exam: finalExam,
                    makeup_exam: makeupExam,
                    avg1, avg2, s3, final_grade, final_with_makeup
                };
            });
            
            // نُمرر اسم الفصل الدراسي الأصلي (term) الذي تم استلامه من الواجهة الأمامية
            const certificateData = { ...student, term: term, grades: processedGrades };
            
            // --- إنشاء ورقة عمل جديدة لكل طالب ---
            if (!divisionNameForFile) divisionNameForFile = certificateData.division_name;
            if (!classNameForFile) classNameForFile = certificateData.class_name;
            const safeSheetName = certificateData.student_name.substring(0, 30).replace(/[\*\[\]\:\?\\\/]/g, "");
            const worksheet = workbook.addWorksheet(safeSheetName);
            await generateCertificateSheet(worksheet, certificateData);
        }
        
        // --- إعداد وإرسال الملف النهائي ---
        const fileName = `شهادات-${(classNameForFile || 'الصف').replace(/\s/g, '_')}-${(divisionNameForFile || 'الشعبة').replace(/\s/g, '_')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);

        await workbook.xlsx.write(res);

    } catch (err) {
        console.error("❌ Error exporting bulk certificates:", err.message, err.stack);
        res.status(500).send("Server error generating bulk certificates.");
    } finally {
        client.release();
    }
});


  app.post('/api/login', async (req, res) => {
      const { username, password } = req.body;
      try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user || !user.is_active) {
          return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
        }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, username: user.username } });
      } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ error: 'حدث خطأ في الخادم.' });
      }
  });


  // GET /api/roles
  app.get('/api/roles', authMiddleware, can('users:read'), async (req, res) => {
      try {
        const result = await pool.query('SELECT id, name, description FROM roles ORDER BY name');
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
  });
  // ✅ نقطة نهاية جديدة: جلب قائمة الصلاحيات الكاملة
  app.get('/api/permissions-list', authMiddleware, (req, res) => {
      res.json(ALL_PERMISSIONS);
  });
  // ✅ نقطة نهاية جديدة: جلب الأدوار مع صلاحياتها التفصيلية
  app.get('/api/roles-with-permissions', authMiddleware, async (req, res) => {
      try {
        const result = await pool.query('SELECT id, name, permissions FROM roles ORDER BY id');
        res.json(result.rows);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
  });
  




app.get('/api/student-public-data', async (req, res) => {
    const { query, term } = req.query;

    console.log(`[DEBUG] Received request for /api/student-public-data. Query: "${query}", Term: "${term}"`);

    if (!query || !term) {
        console.log("[DEBUG] Missing query or term. Sending 400 error.");
        return res.status(400).json({ error: 'الرجاء إدخال بيانات البحث واختيار الفصل الدراسي.' });
    }

    try {
        // الخطوة 1: جلب معرف الطالب من خلال الاسم أو الباركود
        // هذه الخطوة ضرورية لأن getStudentCertificateData تتوقع studentId
        const studentLookupQuery = `
            SELECT id FROM students WHERE name ILIKE $1 OR barcode = $1 LIMIT 1;
        `;
        console.log(`[DEBUG] Looking up student ID for query: "${query}"`);
        const studentLookupResult = await pool.query(studentLookupQuery, [query]);

        if (studentLookupResult.rows.length === 0) {
            console.log(`[DEBUG] Student not found for query: "${query}". Sending 404 error.`);
            return res.status(404).json({ error: 'لم يتم العثور على الطالب.' });
        }
        const studentId = studentLookupResult.rows[0].id;
        console.log(`[DEBUG] Found student ID: ${studentId} for query: "${query}"`);

        // الخطوة 2: استخدام دالة getStudentCertificateData لجلب معلومات الطالب والدرجات المعالجة
        // هذه الدالة تتعامل بالفعل مع جلب تفاصيل الطالب، مواد الصفوف، الدرجات، ومعالجتها بالكامل.
        const certificateData = await getStudentCertificateData(studentId, term);

        if (!certificateData) {
            console.log(`[DEBUG] No certificate data found for student ID: ${studentId} and term: ${term}.`);
            // يمكن أن يحدث هذا إذا لم يتم العثور على الفصل الدراسي، أو الطالب لا ينتمي لصف، إلخ.
            return res.status(404).json({ error: 'لم يتم العثور على بيانات شهادة للطالب المختار في هذا الفصل الدراسي.' });
        }
        
        // استخلاص معلومات الطالب والدرجات من الناتج الموحد لـ certificateData
        const studentInfo = {
            student_name: certificateData.student_name,
            school_name: certificateData.school_name,
            class_name: certificateData.class_name,
            division_name: certificateData.division_name,
            photo_url: certificateData.photo_url,
            id: certificateData.student_id,
            division_id: certificateData.division_id,
            class_id: certificateData.class_id
        };
        const grades = certificateData.grades;

        console.log("[DEBUG] Student Info extracted from certificateData:", studentInfo);
        console.log("[DEBUG] Grades extracted from certificateData:", grades);


        // الخطوة 3: جلب سجلات الحضور المفصلة (هذا الجزء يبقى منفصلاً لأنه ليس جزءًا من بيانات الشهادة)
        const attendanceQuery = `
            SELECT date, type, notes, subject, lesson
            FROM absences
            WHERE student_id = $1
            ORDER BY date DESC;
        `;
        console.log(`[DEBUG] Executing attendance query for student ID: ${studentId}`);
        const attendanceResult = await pool.query(attendanceQuery, [studentId]);
        const detailed_attendance = attendanceResult.rows;
        console.log("[DEBUG] Detailed attendance fetched:", detailed_attendance);
        
        console.log("[DEBUG] Sending final response with studentInfo, detailed_attendance, and grades.");
        res.json({
            studentInfo: studentInfo,
            detailed_attendance: detailed_attendance,
            grades: grades
        });

    } catch (err) {
        console.error("❌ Error fetching student public data:", err.message, err.stack);
        res.status(500).json({ error: 'حدث خطأ في الخادم أثناء جلب بيانات الطالب.' });
    }
});
  




app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.full_name, u.is_active, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching users:', err.message);
    res.status(500).json({ error: 'فشل في جلب المستخدمين' });
  }
});
// POST /api/users (Create User - FIXED)
app.post('/api/users', authMiddleware, can('users:create'), async (req, res) => {
    // Note the change from `permissions` to `user_permissions` to match the frontend
    const { username, password, full_name, role_id, is_active, user_permissions } = req.body;

    if (!username || !password || !role_id) {
        return res.status(400).json({ error: 'اسم المستخدم، كلمة المرور، والدور مطلوبون.' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, full_name, role_id, is_active, permissions)
            VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            // Correctly handles user_permissions and ensures it's valid JSON
            [username, hashedPassword, full_name, role_id, is_active === undefined ? true : is_active, JSON.stringify(user_permissions || {})]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'اسم المستخدم موجود بالفعل.' });
        }
        console.error("❌ Error creating user:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في إنشاء المستخدم: ' + err.message });
    }
});

// ✅ Correct and secure route for updating a user
app.put('/api/users/:id', authMiddleware, can('users:update'), async (req, res) => {
    const { id } = req.params;
    // The 'user_permissions' field from the request body contains custom permissions
    const { full_name, role_id, is_active, user_permissions, password } = req.body;

    // Basic validation to ensure required fields are present
    if (full_name === undefined || role_id === undefined || is_active === undefined) {
        return res.status(400).json({ error: 'Full name, role, and active status are required.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let updates = [
            'full_name = $1',
            'role_id = $2',
            'is_active = $3',
            // The database column for custom permissions is named 'permissions'
            'permissions = $4' 
        ];
        let values = [
            full_name,
            role_id,
            is_active,
            // Safely stringify the custom permissions object, defaulting to an empty object
            JSON.stringify(user_permissions || {}) 
        ];
        let paramIndex = 5;

        // Only update the password if a new one is provided
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updates.push(`password_hash = $${paramIndex++}`);
            values.push(hashedPassword);
        }

        values.push(id); // The user ID for the WHERE clause

        const queryText = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id`;
        
        const result = await client.query(queryText, values);

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'User not found.' });
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'User updated successfully.' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error updating user:", err.message, err.stack);
        res.status(500).json({ error: 'Server error while updating user.' });
    } finally {
        client.release();
    }
});


  // DELETE /api/users/:id
  app.delete('/api/users/:id', authMiddleware, can('users:delete'), async (req, res) => {
      const { id } = req.params;
      if (req.user.id == id) {
          return res.status(400).json({ error: "لا يمكنك حذف حسابك الخاص." });
      }
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        res.status(200).json({ message: 'تم حذف المستخدم بنجاح.' });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
  });



app.get('/api/check-license', async (req, res) => {
    const now = new Date().toISOString().slice(0, 10);
    // يستخدم licensePool
    const result = await licensePool.query(`
      SELECT * FROM server_license 
      WHERE is_active = true AND start_date <= $1 AND end_date >= $1
      ORDER BY id DESC LIMIT 1
    `, [now]);

    if (result.rows.length === 0) {
      return res.json({ status: 'inactive' });
    }

    res.json({ status: 'active', license: result.rows[0] });
});

  // إضافة نقطة نهاية للتحقق من البيانات
  app.get('/api/debug/check-schedule', async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM weekly_schedule WHERE division_id IN (20, 21, 22, 23)
      `);
      
      console.log(`تم العثور على ${result.rows.length} سجل في جدول weekly_schedule`);
      
      // التحقق من جميع السجلات في الجدول
      const allRecords = await pool.query(`
        SELECT division_id, COUNT(*) as count 
        FROM weekly_schedule 
        GROUP BY division_id
      `);
      
      console.log(`🔍 All records in weekly_schedule: ${JSON.stringify(allRecords.rows)}`);
      
      res.json({
        total: result.rows.length,
        records: result.rows,
        summary: allRecords.rows
      });
    } catch (err) {
      console.error("❌ Error checking schedule:", err.message);
      res.status(500).json({ error: 'فشل في التحقق من الجدول' });
    }
  });
  app.post('/api/health-centers', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'الاسم مطلوب' });

    try {
      const result = await pool.query('INSERT INTO health_centers (name) VALUES ($1) RETURNING *', [name]);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.get('/api/health-centers', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM health_centers ORDER BY name');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.put('/api/health-centers/:id', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const result = await pool.query('UPDATE health_centers SET name = $1 WHERE id = $2 RETURNING *', [name, id]);
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete('/api/health-centers/:id', async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query('DELETE FROM health_centers WHERE id = $1', [id]);
      res.json({ message: 'تم الحذف بنجاح' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  // 🔴 انسخ هذا الكود وأضفه إلى ملف server.js الخاص بك 🔴
  app.get('/api/students/:student_id/referrals', async (req, res) => {
    const { student_id } = req.params;
    try {
      const result = await pool.query(
        'SELECT id, referral_date FROM student_referrals WHERE student_id = $1 ORDER BY referral_date DESC',
        [student_id]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(`Error fetching referrals for student ${student_id}:`, err.message);
      res.status(500).json({ error: 'Failed to fetch referral history' });
    }
  });

app.post('/api/generate-license', async (req, res) => {
    const { start_date, end_date } = req.body;
    const serial = `LIC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    try {
      // يستخدم licensePool
      await licensePool.query(`INSERT INTO server_license (serial, start_date, end_date) VALUES ($1, $2, $3)`, [serial, start_date, end_date]);
      res.json({ message: 'تم توليد الترخيص', serial });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

  const PORT = process.env.PORT || 3000;
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let localIP = 'localhost'; 

  Object.keys(interfaces).forEach(ifaceName => {
    interfaces[ifaceName].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
      }
    });
  });

app.post('/api/verify-license', async (req, res) => {
    const { serial } = req.body;
    if (!serial) return res.status(400).json({ error: 'يرجى إدخال رمز التفعيل.' });

    const today = new Date().toISOString().slice(0, 10);

    try {
      // يستخدم licensePool
      const result = await licensePool.query(`
        SELECT * FROM server_license 
        WHERE serial = $1 AND start_date <= $2 AND end_date >= $2
        ORDER BY id DESC LIMIT 1
      `, [serial, today]);

      if (result.rows.length === 0) {
        return res.status(403).json({ error: '❌ رمز التفعيل غير صالح أو منتهي' });
      }

      // يستخدم licensePool
      await licensePool.query(`
        UPDATE server_license SET verified = true, is_active = true 
        WHERE id = $1
      `, [result.rows[0].id]);

      res.json({ message: '✅ تم تفعيل السيرفر بنجاح' });
    } catch (err) {
      res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الترخيص' });
    }
});



app.get('/api/licenses', async (req, res) => {
    // يستخدم licensePool
    const result = await licensePool.query('SELECT * FROM server_license ORDER BY id DESC');
    res.json(result.rows);
});


  app.put('/api/attendance/:id', async (req, res) => {
      const { id } = req.params;
      const {
          attendance_date,
          status,
          entry_timestamp,
          exit_timestamp,
          reason_for_leave,
          notes
      } = req.body;

      // التحقق من الحقول الإلزامية
      if (!status || !attendance_date) {
          return res.status(400).json({ error: 'الحالة وتاريخ الحضور حقول إلزامية.' });
      }

      // تحويل الحقول الفارغة للوقت إلى null لضمان التوافق مع قاعدة البيانات
      const entryTime = entry_timestamp || null;
      const exitTime = exit_timestamp || null;

      try {
          const updateResult = await pool.query(
              `UPDATE teacher_attendance 
              SET 
                  attendance_date = $1,
                  status = $2,
                  entry_timestamp = $3,
                  exit_timestamp = $4,
                  reason_for_leave = $5,
                  notes = $6,
                  -- إعادة تعيين حالة الموافقة على الإجازة إذا لم تعد الحالة مرتبطة بالإجازات
                  leave_approval_status = CASE 
                                              WHEN $2 IN ('إجازة قيد المراجعة', 'إجازة موافق عليها', 'غياب بسبب إجازة مرفوضة') 
                                              THEN leave_approval_status 
                                              ELSE NULL 
                                          END
              WHERE id = $7 RETURNING *`,
              [attendance_date, status, entryTime, exitTime, reason_for_leave, notes, id]
          );

          if (updateResult.rowCount === 0) {
              return res.status(404).json({ error: 'لم يتم العثور على سجل الحضور لتحديثه.' });
          }
          res.status(200).json({ message: 'تم تحديث السجل بنجاح.', data: updateResult.rows[0] });
      } catch (err) {
          console.error("❌ Error in PUT /api/attendance/:id:", err.message);
          res.status(500).json({ error: 'فشل تحديث سجل الحضور: ' + err.message });
      }
  });
  app.delete('/api/attendance/:id', async (req, res) => {
      const { id } = req.params;
      if (!id) {
          return res.status(400).json({ error: 'معرف السجل مطلوب.' });
      }
      try {
          const deleteResult = await pool.query('DELETE FROM teacher_attendance WHERE id = $1 RETURNING *', [id]);
          if (deleteResult.rowCount === 0) {
              return res.status(404).json({ error: 'لم يتم العثور على سجل الحضور.' });
          }
          res.status(200).json({ message: 'تم حذف سجل الحضور بنجاح.' });
      } catch (err) {
          console.error("❌ Error in DELETE /api/attendance/:id:", err.message);
          res.status(500).json({ error: 'فشل حذف سجل الحضور: ' + err.message });
      }
  });


app.post('/api/licenses/:id/activate', async (req, res) => {
    // يستخدم licensePool
    await licensePool.query('UPDATE server_license SET is_active = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم التفعيل' });
});

app.post('/api/licenses/:id/deactivate', async (req, res) => {
    // يستخدم licensePool
    await licensePool.query('UPDATE server_license SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم الإيقاف' });
});


app.delete('/api/licenses/:id', async (req, res) => {
    // يستخدم licensePool
    await licensePool.query('DELETE FROM server_license WHERE id = $1', [req.params.id]);
    res.json({ message: 'تم الحذف' });
});

app.get('/api/auth/status', authMiddleware, (req, res) => {
    // إذا نجح الـ authMiddleware في العمل، فهذا يعني أن التوكن صالح
    // وقد أضاف بيانات المستخدم (req.user) إلى الطلب
    res.status(200).json({
        status: 'ok',
        user: {
            id: req.user.id,
            username: req.user.username,
            permissions: req.user.permissions 
        }
    });
});

app.get('/api/students-for-exam-rooms', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id AS student_id,
        s.name AS student_name,
        d.name AS division_name,
        c.id AS class_id,
        c.name AS class_name,
        sch.name AS school_name
      FROM students s
      JOIN divisions d ON s.division_id = d.id
      JOIN classes c ON d.class_id = c.id
      JOIN schools sch ON c.school_id = sch.id
      ORDER BY sch.name ASC, c.name ASC, d.name ASC, s.name ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ خطأ في جلب بيانات الطلاب للقاعات الامتحانية:", err.message, err.stack);
    res.status(500).json({ error: 'فشل في جلب بيانات الطلاب للقاعات الامتحانية' });
  }
});

app.post('/api/export-student-list-pdf', async (req, res) => {
    const { distribution, settings } = req.body;

    if (!distribution || !settings) {
        return res.status(400).json({ error: 'البيانات المطلوبة (distribution, settings) غير كاملة.' });
    }

    const toArabicNum = (num) => {
        if (num === null || num === undefined) return '';
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return String(num).replace(/[0-9]/g, d => arabicNumbers[parseInt(d)]);
    };

    try {
        let hallSections = '';
        let examNumber = 1;

        distribution.forEach(hall => {
            hall.areas.forEach(area => {
                let tableRows = '';
                let sequence = 1;

                area.seating.forEach(student => {
                    tableRows += `
                        <tr>
                            <td>${toArabicNum(sequence++)}</td>
                            <td>${toArabicNum(examNumber++)}</td>
                            <td>${student.student_name}</td>
                            <td>${student.class_name || ''} / ${student.division_name || ''}</td>
                        </tr>
                    `;
                });

                if (tableRows) {
                    hallSections += `
                        <div class="area-container">
                             <div class="area-title">
                                 القاعة: ${hall.hallName} &nbsp;&nbsp;|&nbsp;&nbsp; المنطقة: ${area.areaName.replace('المنطقة ', '')} &nbsp;&nbsp;|&nbsp;&nbsp; عدد الطلبة: ${toArabicNum(area.totalStudentsInArea)}
                             </div>
                             <table>
                                 <thead>
                                     <tr>
                                         <th>ت</th>
                                         <th>الرقم الامتحاني</th>
                                         <th>اسم الطالب</th>
                                         <th>الصف والشعبة</th>
                                     </tr>
                                 </thead>
                                 <tbody>
                                     ${tableRows}
                                 </tbody>
                             </table>
                        </div>
                    `;
                }
            });
        });

        // ✅ FIX: إضافة حاوية المحتوى فقط في حال وجود قوائم للطلاب
        const mainContent = hallSections ? `<div class="main-content">${hallSections}</div>` : '';

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>سجل الطلاب للامتحان</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                    
                    /* ✅ FIX: استخدام @page للتحكم بالهوامش بشكل قياسي وموثوق */
                    @page {
                        size: A4;
                        margin: 1.5cm 1cm;
                    }

                    body {
                        font-family: 'Cairo', sans-serif;
                        direction: rtl;
                        font-size: 14px;
                        -webkit-print-color-adjust: exact;
                        margin: 0;
                    }

                    /* ✅ FIX: تصميم بسيط ومضمون لصفحة الغلاف */
                    .cover-page {
                        text-align: center;
                        /* استخدام padding لدفع المحتوى لأسفل وتوسيطه تقريبًا */
                        padding-top: 90mm; 
                    }

                    /* ✅ FIX: حاوية المحتوى تطلب دائمًا البدء في صفحة جديدة */
                    .main-content {
                        page-break-before: always;
                    }

                    .header h1 {
                        margin: 0;
                        font-size: 22px;
                    }
                    .header p {
                        margin: 5px 0 0;
                        font-size: 16px;
                    }
                    .area-container {
                        page-break-inside: avoid;
                        margin-bottom: 25px;
                    }
                    .area-title {
                        font-size: 16px;
                        font-weight: bold;
                        text-align: center;
                        background-color: #f2f2f2;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-bottom: none;
                        border-radius: 5px 5px 0 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: right;
                    }
                    th {
                        background-color: #e9ecef;
                        font-weight: 700;
                    }
                    th:nth-child(1), td:nth-child(1) { width: 5%; text-align: center; }
                    th:nth-child(2), td:nth-child(2) { width: 15%; text-align: center; }
                    th:nth-child(3), td:nth-child(3) { width: 50%; }
                    th:nth-child(4), td:nth-child(4) { width: 30%; }
                </style>
            </head>
            <body>
                <div class="cover-page">
                    <div class="header">
                        <h1>سجل توزيع الطلاب في القاعات الامتحانية</h1>
                        <p>${settings.examTitle || "امتحانات"}</p>
                        <p>العام الدراسي: ${settings.academicYear || '٢٠٢٤-٢٠٢٥'}</p>
                    </div>
                </div>
                
                ${mainContent}

            </body>
            </html>
        `;

        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            // ✅ FIX: إزالة الهوامش من هنا للسماح لـ @page بالتحكم الكامل
        });

        await browser.close();

        const rawFileName = `سجل_الطلاب_${settings.examTitle || 'امتحان'}.pdf`;
        const encodedFileName = encodeURIComponent(rawFileName);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("❌ فشل في تصدير سجل الطلاب (PDF):", err.message, err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل الخادم في توليد ملف سجل الطلاب PDF: ' + err.message });
        }
    }
});


// This is the complete function to replace the old one in your server.js
app.post('/api/export-seating-chart-final', async (req, res) => {
    const { distribution, settings } = req.body;

    if (!distribution || !settings) {
        return res.status(400).json({ error: 'البيانات المطلوبة (distribution, settings) غير كاملة.' });
    }

    try {
        const docChildren = [];

        // --- Define Reusable Styles ---
        const headerTextStyle = { size: 28, font: "Arial", bold: true }; // 14pt
        const subHeaderTextStyle = { size: 24, font: "Arial", bold: true }; // 12pt
        const studentCardTextStyle = { size: 24, font: "Arial" }; // 12pt font size
        const areaHeaderTextStyle = { bold: true, color: "FFFFFF", size: 28, font: "Arial" }; // 14pt
        const noBorders = {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        };

        distribution.forEach((hall, hallIndex) => {
            // Add a page break between halls (but not before the first one)
            if (hallIndex > 0) {
                docChildren.push(new Paragraph({ children: [new TextRun({ text: "", break: true })] }));
            }
            
            const schoolName = hall.areas[0]?.seating[0]?.school_name || "اسم المدرسة";

            // --- Build headers using a borderless table with defined column widths for alignment ---
            const headerTable = new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                columnWidths: [2500, 5000, 2500], // 25%, 50%, 25% for left, center, right
                alignment: AlignmentType.CENTER, // Ensure the entire table is centered
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({ // Left Cell
                                children: [
                                    new Paragraph({ text: "ختم الادارة", style: "headerStyle", alignment: AlignmentType.LEFT }),
                                ],
                                borders: noBorders,
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                            new TableCell({ // Center Cell
                                children: [
                                    new Paragraph({ text: settings.examTitle || "امتحانات", alignment: AlignmentType.CENTER, style: "headerStyle" }),
                                    new Paragraph({ text: `العام الدراسي: ${settings.academicYear || '٢٠٢٤-٢٠٢٥'}`, alignment: AlignmentType.CENTER, style: "subHeaderStyle" }),
                                    new Paragraph({ text: settings.examPeriod || 'الدور الاول', alignment: AlignmentType.CENTER, style: "subHeaderStyle" })
                                ],
                                borders: noBorders,
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                            new TableCell({ // Right Cell
                                children: [
                                    new Paragraph({ text: "ادارة", alignment: AlignmentType.RIGHT, style: "headerStyle" }),
                                    new Paragraph({ text: schoolName, alignment: AlignmentType.RIGHT, style: "subHeaderStyle" }),
                                ],
                                borders: noBorders,
                                verticalAlign: VerticalAlign.CENTER,
                            }),
                        ],
                    }),
                ],
            });
            docChildren.push(headerTable);
            docChildren.push(new Paragraph({ text: "" })); // Spacer

            // --- Build student tables ---
            let studentSequence = 1;
            hall.areas.forEach(area => {
                const cols = area.columnsCount;
                if (cols === 0) return;
                
                // --- Add custom area title with correct grammar and parentheses handling ---
                docChildren.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    style: "subHeaderStyle",
                    bidirectional: true, // Helps with RTL rendering
                    children: [
                        new TextRun("القاعة ("),
                        new TextRun(String(hall.hallName)),
                        new TextRun(") المنطقة ("),
                        new TextRun(String(area.areaName).replace('المنطقة ', '')),
                        new TextRun(") عدد طلبة المنطقة الكلي ("), // Corrected grammar
                        new TextRun(String(area.totalStudentsInArea)),
                        new TextRun(")"),
                    ],
                }));
                docChildren.push(new Paragraph({ text: "" })); // Spacer

                const seating = area.seating;
                const numRows = Math.ceil(seating.length / cols);
                const tableRows = [];

                // Area header row in table
                tableRows.push(new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ ...areaHeaderTextStyle, text: area.areaName })], alignment: AlignmentType.CENTER })],
                            columnSpan: cols,
                            shading: { fill: "44546A" },
                        }),
                    ],
                }));

                // Student card rows
                for (let r = 0; r < numRows; r++) {
                    const rowCells = [];
                    for (let c = 0; c < cols; c++) {
                        const studentIndex = r * cols + c;
                        let cell;
                        if (studentIndex >= seating.length) {
                            cell = new TableCell({ children: [new Paragraph("")] });
                        } else {
                            const student = seating[studentIndex];
                            const cardParagraphs = [];
                            if (settings.cardFields.name) cardParagraphs.push(new Paragraph({ children: [new TextRun({ ...studentCardTextStyle, text: `الاسم: ${student.student_name}` })], alignment: AlignmentType.RIGHT }));
                            if (settings.cardFields.class) cardParagraphs.push(new Paragraph({ children: [new TextRun({ ...studentCardTextStyle, text: `الصف: ${student.class_name} / ${student.division_name}` })], alignment: AlignmentType.RIGHT }));
                            if (settings.cardFields.spec) cardParagraphs.push(new Paragraph({ children: [new TextRun({ ...studentCardTextStyle, text: `الاختصاص: ${settings.specializationText || ''}` })], alignment: AlignmentType.RIGHT }));
                            if (settings.cardFields.num) cardParagraphs.push(new Paragraph({ children: [new TextRun({ ...studentCardTextStyle, text: `الرقم الامتحاني: ${studentSequence++}` })], alignment: AlignmentType.RIGHT }));
                            
                            cell = new TableCell({
                                children: cardParagraphs,
                                borders: { top: { style: BorderStyle.SINGLE, size: 6 }, bottom: { style: BorderStyle.SINGLE, size: 6 }, left: { style: BorderStyle.SINGLE, size: 6 }, right: { style: BorderStyle.SINGLE, size: 6 } },
                            });
                        }
                        rowCells.push(cell);
                    }
                    tableRows.push(new TableRow({ children: rowCells }));
                }

                const studentsTable = new Table({
                    rows: tableRows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    alignment: AlignmentType.CENTER, // Center the table on the page
                });
                docChildren.push(studentsTable);
                docChildren.push(new Paragraph({ text: "" }));
            });
        });

        // --- Create the final document once with all content ---
        const doc = new Document({
            styles: {
                paragraphStyles: [
                    { id: "headerStyle", name: "Header Style", run: { font: "Arial", size: 28, bold: true, rightToLeft: true } },
                    { id: "subHeaderStyle", name: "SubHeader Style", run: { font: "Arial", size: 24, bold: true, rightToLeft: true } },
                ],
            },
            sections: [{
                properties: {
                    page: {
                        size: { orientation: 'portrait' },
                        margin: { top: 720, right: 720, bottom: 720, left: 720 },
                    },
                    rightToLeft: true,
                },
                children: docChildren,
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        const fileName = `${encodeURIComponent(settings.examTitle)}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);

    } catch (err) {
        console.error("❌ فشل في تصدير خرائط الجلوس النهائية (Word):", err.message, err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل الخادم في توليد الملف: ' + err.message });
        }
    }
});

// ✅ استبدل أو أضف: نقطة نهاية موحدة لإنشاء جميع أنواع الصادر
app.post('/api/outgoing', upload.single('file'), authMiddleware, async (req, res) => {
    const {
        type, date, book_number, quantity, content,
        student_id, health_center, reason, endorsement_number,
        admin_name, academic_year
    } = req.body;
    const file_path = req.file ? `/outgoing_files/${req.file.filename}` : null;
    const created_by = req.user.id;

    if (!type || !date) {
        return res.status(400).json({ error: 'النوع والتاريخ مطلوبان.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let studentNameForContent = '';
        if (student_id) {
            const studentRes = await client.query('SELECT name FROM students WHERE id = $1', [student_id]);
            studentNameForContent = studentRes.rows[0]?.name || '';
        }

        let outgoingContent = content;
        let outgoingBookNumber = book_number;
        let outgoingEndorsementNumber = endorsement_number;

        if (type === 'إحالة مركز صحي') {
            outgoingContent = `إلى ${health_center}: بخصوص الطالب/ة ${studentNameForContent}. السبب: ${reason}`;
            outgoingBookNumber = `إحالة/${Date.now()}`;
            outgoingEndorsementNumber = health_center;
        } else if (type === 'تأييد استمرارية') {
            outgoingContent = `تأييد استمرارية للطالب/ة ${studentNameForContent} للعام الدراسي ${academic_year}`;
            outgoingBookNumber = endorsement_number; // رقم التأييد
        }

        // 1. إنشاء السجل الرئيسي في جدول outgoing
        const outgoingResult = await client.query(
            `INSERT INTO outgoing (
                type, date, book_number, quantity, content, file_path,
                student_id, health_center, reason, endorsement_number, admin_name, academic_year, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [
                type, date, outgoingBookNumber, quantity || null, outgoingContent, file_path,
                student_id || null, health_center || null, reason || null, outgoingEndorsementNumber || null,
                admin_name || req.user.full_name, // استخدام اسم المستخدم الحالي كمنفذ
                academic_year || null, created_by
            ]
        );
        const newOutgoingId = outgoingResult.rows[0].id;

        // 2. إنشاء السجل المرتبط في الجدول المخصص (إذا لزم الأمر)
        if (type === 'إحالة مركز صحي') {
            await client.query(
                `INSERT INTO student_referrals (student_id, referral_date, health_center, reason, created_by, outgoing_id)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [student_id, date, health_center, reason, created_by, newOutgoingId]
            );
        } else if (type === 'تأييد استمرارية') {
            await client.query(
                `INSERT INTO student_certificates (
                    student_id, certificate_number, issue_date, recipient, academic_year, director_full_name,
                    student_name_at_issue, student_class_at_issue, created_by, outgoing_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    student_id, newOutgoingId, date, 'الجهة المعنية', academic_year, admin_name,
                    studentNameForContent, 'غير محدد', created_by, newOutgoingId
                ]
            );
        }

        await client.query('COMMIT');
        const finalRecord = await client.query('SELECT * FROM outgoing WHERE id = $1', [newOutgoingId]);
        res.status(201).json(finalRecord.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error creating unified outgoing record:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في إنشاء سجل الصادر: ' + err.message });
    } finally {
        client.release();
    }
});
app.get('/api/outgoing', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                o.*,
                s.name AS student_name,
                u.full_name AS created_by_admin_name
            FROM outgoing o
            LEFT JOIN students s ON o.student_id = s.id
            LEFT JOIN users u ON o.created_by = u.id
            ORDER BY o.id DESC;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching outgoing records:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في جلب سجلات الصادر: ' + err.message });
    }
});

// ✅ استبدل: PUT /api/outgoing/:id لتعديل السجلات بشكل موحد
app.put('/api/outgoing/:id', upload.single('file'), authMiddleware, async (req, res) => {
    const { id } = req.params;
    const {
        type, date, book_number, quantity, content, student_id,
        health_center, reason, endorsement_number, admin_name,
        academic_year, existing_file_path, clear_file
    } = req.body;

    let file_path = existing_file_path || null;
    if (req.file) {
        file_path = `/outgoing_files/${req.file.filename}`;
    } else if (clear_file === 'true') {
        file_path = null;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // تحديث السجل الرئيسي في جدول outgoing
        const result = await client.query(
            `UPDATE outgoing SET
                type = $1, date = $2, book_number = $3, quantity = $4, content = $5, file_path = $6,
                student_id = $7, health_center = $8, reason = $9, endorsement_number = $10,
                admin_name = $11, academic_year = $12
            WHERE id = $13 RETURNING *`,
            [
                type, date, book_number, quantity, content, file_path, student_id,
                health_center, reason, endorsement_number, admin_name, academic_year, id
            ]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'سجل الصادر غير موجود.' });
        }

        // تحديث السجلات الفرعية (إذا لزم الأمر)
        if (type === 'إحالة مركز صحي') {
            await client.query(
                `UPDATE student_referrals SET student_id = $1, referral_date = $2, health_center = $3, reason = $4 WHERE outgoing_id = $5`,
                [student_id, date, health_center, reason, id]
            );
        } else if (type === 'تأييد استمرارية') {
            await client.query(
                `UPDATE student_certificates SET student_id = $1, issue_date = $2, certificate_number = $3, academic_year = $4 WHERE outgoing_id = $5`,
                [student_id, date, endorsement_number, academic_year, id]
            );
        }
        
        // حذف الملف القديم إذا تم استبداله أو مسحه
        if ((req.file || clear_file === 'true') && existing_file_path) {
            const oldFilePath = path.join(__dirname, 'public', existing_file_path);
            if (fs_sync.existsSync(oldFilePath)) {
                await fs_async.unlink(oldFilePath).catch(err => console.error("Error deleting old file:", err));
            }
        }

        await client.query('COMMIT');
        res.json(result.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error updating outgoing record:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في تحديث سجل الصادر: ' + err.message });
    } finally {
        client.release();
    }
});

// ✅ استبدل: DELETE /api/outgoing/:id لحذف السجلات بشكل موحد
app.delete('/api/outgoing/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const recordResult = await client.query('SELECT file_path, type FROM outgoing WHERE id = $1', [id]);
        if (recordResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'سجل الصادر غير موجود.' });
        }
        const { file_path, type } = recordResult.rows[0];

        // حذف السجلات الفرعية أولاً
        if (type === 'إحالة مركز صحي') {
            await client.query('DELETE FROM student_referrals WHERE outgoing_id = $1', [id]);
        } else if (type === 'تأييد استمرارية') {
            await client.query('DELETE FROM student_certificates WHERE outgoing_id = $1', [id]);
        }
        
        // ثم حذف السجل الرئيسي
        await client.query('DELETE FROM outgoing WHERE id = $1', [id]);
        
        // حذف الملف المرفق إن وجد
        if (file_path) {
            const fullFilePath = path.join(__dirname, 'public', file_path);
            if (fs_sync.existsSync(fullFilePath)) {
                await fs_async.unlink(fullFilePath).catch(unlinkErr => console.error("Error deleting file from disk:", unlinkErr.message));
            }
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'تم حذف سجل الصادر بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error deleting outgoing record:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في حذف سجل الصادر: ' + err.message });
    } finally {
        client.release();
    }
});

// تأكد من أن السيرفر يخدم مجلد outgoing_files
app.use('/outgoing_files', express.static(path.join(__dirname, 'public/outgoing_files')));
// ✅ مسار جديد: جلب اسم الأدمن الكامل
app.get('/api/admin-name', authMiddleware, async (req, res) => {
    try {
      // بما أننا نستخدم authMiddleware، فإن req.user.id متاح
      const userId = req.user.id; 
      const result = await pool.query(`
        SELECT full_name FROM users
        WHERE id = $1
      `, [userId]); 

      const full_name = result.rows[0]?.full_name || 'المدير العام'; // تم تغيير الافتراضي ليتوافق مع السياق السابق
      res.json({ full_name });
    } catch (err) {
      console.error('❌ Error fetching admin name:', err.message);
      res.status(500).json({ error: 'فشل في جلب اسم المستخدم.' });
    }
});

// ✅ مسار جديد: جلب جميع سجلات الشهادات (student_certificates)
// ملاحظة: هذا الـ API مفقود في server.js المرفق، ويجب إضافته ليعمل الحل الجديد
app.get('/api/student-certificates-all', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                sc.*,
                s.name AS student_name,
                u.full_name AS created_by_admin_name
            FROM student_certificates sc
            LEFT JOIN students s ON sc.student_id = s.id
            LEFT JOIN users u ON sc.created_by = u.id
            ORDER BY sc.issue_date DESC, sc.id DESC;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching all student certificates:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في جلب سجلات الشهادات: ' + err.message });
    }
});

// ✅ مسار جديد: حذف سجل شهادة (student_certificates)
// هذا المسار مفقود في server.js المرفق، ويجب إضافته
app.delete('/api/student-certificates/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await pool.query('DELETE FROM student_certificates WHERE id = $1 RETURNING *', [id]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'سجل الشهادة غير موجود.' });
        }
        res.status(200).json({ message: 'تم حذف سجل الشهادة بنجاح.' });
    } catch (err) {
        console.error("❌ Error deleting student certificate:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في حذف سجل الشهادة: ' + err.message });
    }
});

// ✅ مسار جديد: تصدير تأييد موجود كملف Word
// هذا المسار سيجلب بيانات التأييد من قاعدة البيانات ثم يستخدم generateCertificateDocx
app.get('/api/certificates/:id/export-docx', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        // جلب تفاصيل التأييد من قاعدة البيانات
        const certificateResult = await pool.query(`
            SELECT 
                sc.*,
                s.name AS student_full_name, -- نستخدم اسم مختلف لتجنب التضارب مع student_name_at_issue
                s.division_id,
                d.name AS division_name,
                c.name AS class_name
            FROM student_certificates sc
            JOIN students s ON sc.student_id = s.id
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            WHERE sc.id = $1
        `, [id]);

        if (certificateResult.rows.length === 0) {
            return res.status(404).json({ error: 'سجل التأييد غير موجود.' });
        }

        const cert = certificateResult.rows[0];

        // تجهيز البيانات للدالة generateCertificateDocx
        // يجب أن تتطابق هذه الحقول مع ما تتوقعه الدالة
        const docData = {
            certificate_number_arabic: convertToArabicNumerals(cert.certificate_number),
            issue_date_arabic: new Date(cert.issue_date).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '/'),
            student_name: cert.student_full_name || cert.student_name_at_issue, // استخدام الاسم الحالي للطالب أو الاسم وقت الإصدار
            student_class: `${cert.class_name || ''} / ${cert.division_name || ''}`, // تجميع الصف والشعبة
            academic_year: cert.academic_year,
            recipient: cert.recipient,
            director_full_name: cert.director_full_name,
            school_name: cert.school_name
        };

        const buffer = await generateCertificateDocx(docData); 

        const fileName = `تأييد_استمرارية_${cert.student_full_name.replace(/\s/g, '_')}_${cert.certificate_number}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);

    } catch (err) {
        console.error("❌ Error exporting certificate DOCX:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في توليد ملف التأييد: ' + err.message });
    }
});
app.put('/api/student-referrals/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { student_id, referral_date, health_center, reason } = req.body;
    const updated_by_user_id = req.user.id; // معرف المستخدم الذي يقوم بالتحديث

    if (!student_id || !referral_date || !health_center) {
        return res.status(400).json({ error: 'Student ID, referral date, and health center are required.' });
    }

    try {
        // Fetch the full_name of the user who is updating the referral
        const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [updated_by_user_id]);
        const manager_name_from_user = userResult.rows[0]?.full_name || 'غير متوفر';

        const result = await pool.query(
            `UPDATE student_referrals SET
                student_id = $1, referral_date = $2, health_center = $3, manager_name = $4, reason = $5,
                created_by = COALESCE(created_by, $7) -- تحديث created_by فقط إذا كان null
            WHERE id = $6 RETURNING *`,
            // Use manager_name_from_user for manager_name field in DB
            [student_id, referral_date, health_center, manager_name_from_user, reason || null, id, updated_by_user_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'سجل الإحالة غير موجود.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error updating student referral:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في تحديث سجل الإحالة: ' + err.message });
    }
});
// ✅ مسار جديد: حذف سجل إحالة (student_referrals)
// المسار الحالي لـ /api/student-referrals لا يحتوي على DELETE. سنحتاج لإضافة هذا.
app.delete('/api/student-referrals/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const deleteResult = await pool.query('DELETE FROM student_referrals WHERE id = $1 RETURNING *', [id]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ error: 'سجل الإحالة غير موجود.' });
        }
        res.status(200).json({ message: 'تم حذف سجل الإحالة بنجاح.' });
    } catch (err) {
        console.error("❌ Error deleting student referral:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في حذف سجل الإحالة: ' + err.message });
    }
});

// ... (existing API routes)
app.post('/api/confirm-attendance', authMiddleware, async (req, res) => {
  const { student_id, academic_year } = req.body;
  if (!student_id || !academic_year) {
    return res.status(400).json({ error: 'student_id و academic_year مطلوبان' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO student_attendance_confirmations (student_id, academic_year, created_by)
      VALUES ($1, $2, $3) RETURNING *
    `, [student_id, academic_year, req.user.id]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error creating attendance confirmation:', err.message);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ التأييد' });
  }
});
app.get('/api/student-by-name', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'اسم الطالب مطلوب' });

  try {
    const result = await pool.query(`
      SELECT s.id, s.name, d.name AS division_name, c.name AS class_name
      FROM students s
      JOIN divisions d ON s.division_id = d.id
      JOIN classes c ON d.class_id = c.id
      WHERE s.name ILIKE $1
    `, [`%${name}%`]);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching student by name:', err.message);
    res.status(500).json({ error: 'فشل في جلب بيانات الطالب' });
  }
});
// ✅ مسار جديد: جلب اسم الأدمن الكامل الفعلي
app.get('/api/admin-name', authMiddleware, async (req, res) => {
    try {
      // بما أننا نستخدم authMiddleware، فإن req.user.id متاح
      const userId = req.user.id; 
      const result = await pool.query(`
        SELECT full_name FROM users
        WHERE id = $1
      `, [userId]); 

      // هنا نُرجع الاسم الفعلي الموجود في قاعدة البيانات، أو null إذا لم يكن موجوداً
      // الواجهة الأمامية ستقوم بالتعامل مع قيمة null إذا لم يتم العيين لحقل full_name
      const full_name = result.rows[0]?.full_name || null; 
      res.json({ full_name });
    } catch (err) {
      console.error('❌ Error fetching admin name:', err.message);
      res.status(500).json({ error: 'فشل في جلب اسم المستخدم.' });
    }
});

app.post('/api/certificates/save-and-export', authMiddleware, can('certificates:create'), async (req, res) => {
    const {
        student_id, recipient, academic_year
    } = req.body;
    const created_by = req.user.id;

    if (!student_id || !academic_year) {
        return res.status(400).json({ error: 'البيانات الأساسية للتأييد غير مكتملة.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // جلب بيانات الطالب والمدير
        const studentRes = await client.query('SELECT name, (SELECT c.name FROM classes c JOIN divisions d ON c.id = d.class_id WHERE d.id = s.division_id) as class_name, (SELECT sch.name FROM schools sch JOIN classes c ON sch.id = c.school_id JOIN divisions d ON c.id = d.class_id WHERE d.id = s.division_id) as school_name FROM students s WHERE id = $1', [student_id]);
        const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [created_by]);
        
        if (studentRes.rows.length === 0) throw new Error('Student not found.');
        
        const student = studentRes.rows[0];
        const director_full_name = userRes.rows[0]?.full_name || 'المدير العام';
        const issue_date = new Date().toISOString().split('T')[0];

        // 1. إنشاء سجل في outgoing أولاً
        const outgoingRes = await client.query(
            `INSERT INTO outgoing (type, date, student_id, content, admin_name, academic_year, created_by, endorsement_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
                'تأييد استمرارية', issue_date, student_id, `تأييد للطالب/ة: ${student.name}`,
                director_full_name, academic_year, created_by, recipient
            ]
        );
        const newOutgoingId = outgoingRes.rows[0].id;
        
        // 2. تحديث book_number في outgoing ليكون نفس الـ ID
        await client.query('UPDATE outgoing SET book_number = $1 WHERE id = $1', [newOutgoingId]);

        // 3. إنشاء السجل في student_certificates مع الربط
        await client.query(
            `INSERT INTO student_certificates (
                student_id, certificate_number, issue_date, recipient, academic_year,
                director_full_name, school_name, student_name_at_issue, student_class_at_issue,
                created_by, outgoing_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
                student_id, newOutgoingId, issue_date, recipient, academic_year,
                director_full_name, student.school_name, student.name, student.class_name,
                created_by, newOutgoingId
            ]
        );

        // 4. توليد مستند Word
        const docData = {
            certificate_number_arabic: convertToArabicNumerals(newOutgoingId),
            issue_date_arabic: new Date(issue_date).toLocaleDateString('ar-EG-u-nu-arab'),
            student_name: student.name,
            student_class: student.class_name,
            academic_year: academic_year,
            recipient: recipient,
            director_full_name: director_full_name,
            school_name: student.school_name
        };
        const buffer = await generateCertificateDocx(docData);

        await client.query('COMMIT');

        const fileName = `تأييد_استمرارية_${student.name.replace(/\s/g, '_')}_${newOutgoingId}.docx`;
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.send(buffer);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error saving and exporting certificate:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في حفظ وتوليد التأييد: ' + err.message });
    } finally {
        client.release();
    }
});


// ✅ [معدل] مسار إنشاء وتصدير الخطابات بصيغة PDF
app.post('/api/generate-letter-pdf', authMiddleware, async (req, res) => {
    // استخلاص البيانات من الطلب
    const { templateType, data } = req.body;
    const created_by = req.user.id;
    const today = new Date();
    
    // دالة مساعدة لتحويل الأرقام إلى الصيغة العربية (الهندية)
    const convertToArabicNumerals = (num) => {
        if (num === null || num === undefined) return '';
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        return String(num).split('').map(digit => {
            if (/[0-9]/.test(digit)) {
                return arabicNumbers[parseInt(digit)];
            }
            return digit;
        }).join('');
    };

    // تنسيق التاريخ بالصيغة العربية
    const day = today.getDate();
    const month = today.getMonth() + 1; // الأشهر تبدأ من 0
    const year = today.getFullYear();
const formattedDate = convertToArabicNumerals(`${year}/${month}/${day}`);

    const client = await pool.connect();
    try {
        // بدء معاملة قاعدة البيانات لضمان حفظ البيانات بشكل متكامل
        await client.query('BEGIN');
        
        // جلب اسم المدير الكامل من قاعدة البيانات
        const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [created_by]);
        const adminFullName = userRes.rows[0]?.full_name || 'مدير المدرسة';

        // كائن لحفظ بيانات الخطاب قبل إدخالها لقاعدة البيانات
        let saveData = {
            type: data.type || 'مخاطبة',
            date: today.toISOString().split('T')[0],
            content: data.content,
            admin_name: adminFullName,
            academic_year: data.academic_year || '2025 - 2026',
            book_number: null,
            endorsement_number: null,
            student_id: null,
            is_istifsar: false
        };

        // متغير لحفظ محتوى الخطاب كـ HTML
        let letterBodyHtml;

        // تحديد نوع الخطاب وتجهيز البيانات الخاصة به
        switch (templateType) {
            case 'general':
                saveData.book_number = data.subject;
                saveData.endorsement_number = data.recipient;
                break;

            // ✅ [جديد] حالة خاصة لـ "تأييد طالب"
            case 'studentContinuity':
                if (!data.student_id) {
                    throw new Error('Student ID is required for student continuity letter.');
                }
                // جلب اسم الطالب والصف من قاعدة البيانات
                const studentRes = await client.query('SELECT s.name as student_name, c.name as class_name FROM students s JOIN divisions d ON s.division_id = d.id JOIN classes c ON d.class_id = c.id WHERE s.id = $1', [data.student_id]);
                if (studentRes.rows.length === 0) {
                     throw new Error('Student not found.');
                }
                const studentName = studentRes.rows[0]?.student_name || '...........';
                const className = studentRes.rows[0]?.class_name || '...........';
                
                saveData.type = 'تأييد طالب';
                saveData.book_number = `تأييد استمرارية: ${studentName}`;
                saveData.endorsement_number = data.recipient;
                saveData.student_id = data.student_id;
                // توليد المحتوى النصي الكامل للخطاب
                saveData.content = `الى / ${data.recipient || '...'}\n\nم/ تأييد استمرارية طالب\n\nبعد التحية ...\n\nنؤيد لكم بأن الطالب (${studentName}) في الصف (${className}) مستمر بالدوام في مدرستنا للعام الدراسي (${data.academic_year}).\n\nوبناءاً على طلبه زود بهذا التأييد.\n\nللعلم مع التقدير .`;
                break;
                
            case 'istiimraria':
                 const employeeRes = await client.query('SELECT name FROM teachers WHERE name = $1', [data.employee_name]);
                 const employeeName = employeeRes.rows[0]?.name || '...........';
                 saveData.type = 'تأييد استمرارية موظف';
                 saveData.book_number = `استمرارية موظف: ${employeeName}`;
                 saveData.endorsement_number = data.recipient;
                 break;
            
            // ... أضف بقية الحالات الأخرى هنا (انفكاك، مباشرة، الخ)
             case 'infikak':
             case 'mubashara':
             case 'qabulTaleba':
             case 'tarshih':
             case 'istifsar':
             case 'tajheezAthath':
             case 'takhweel':
             case 'manual':
                // Implement logic for other templates here based on your original file
                // This is just a placeholder
                saveData.book_number = data.subject || `كتاب ${templateType}`;
                saveData.endorsement_number = data.recipient;
                if(templateType === 'istifsar') saveData.is_istifsar = true;
                break;
        }

        // تحويل المحتوى إلى أرقام عربية قبل عرضه في PDF
        const contentForPdf = convertToArabicNumerals(saveData.content);

        // تحويل المحتوى النصي إلى فقرات HTML
        if (['general', 'studentContinuity', 'istiimraria', 'infikak', 'mubashara', 'qabulTaleba', 'istifsar'].includes(templateType)) {
             letterBodyHtml = contentForPdf.split('\n').map(line => {
                const trimmedLine = line.trim();
                if (trimmedLine === '') return '<br>';
                // تطبيق تنسيق خاص لأسطر معينة
                if (trimmedLine.startsWith('الى /')) return `<p style="text-align: center;"><strong>${trimmedLine}</strong></p>`;
                if (trimmedLine.startsWith('م/')) return `<p style="text-align: center; font-weight: bold;">${trimmedLine}</p>`;
                if (trimmedLine.startsWith('بعد التحية')) return `<p style="text-align: center;">${trimmedLine}</p>`;
                if (trimmedLine.includes('مع فائق الشكر') || trimmedLine.includes('مع التقدير') || trimmedLine.includes('للعلم مع التقدير')) return `<p style="text-align: center;">${trimmedLine}</p>`;
                return `<p>${trimmedLine}</p>`;
            }).join('');
        } else {
             letterBodyHtml = contentForPdf; // For templates with pre-formatted HTML
        }
        
        // حفظ سجل الخطاب في جدول الصادر والحصول على الرقم التعريفي الجديد
        const saveResult = await client.query(
            `INSERT INTO outgoing (type, date, book_number, content, admin_name, endorsement_number, academic_year, created_by, student_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [saveData.type, saveData.date, saveData.book_number, saveData.content, saveData.admin_name, saveData.endorsement_number, saveData.academic_year, created_by, saveData.student_id]
        );
        const newLetterId = saveResult.rows[0].id;
        
        // بناء الهيكل الكامل لصفحة الـ HTML التي سيتم تحويلها إلى PDF
        const logoUrl = data.logo_url ? `${req.protocol}://${req.get('host')}${data.logo_url}` : 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Coat_of_arms_of_Iraq.svg/1200px-Coat_of_arms_of_Iraq.svg.png';
        const arabicLetterId = convertToArabicNumerals(newLetterId);

        const htmlForPdf = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
                    html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
                    .page { font-family: 'Amiri', serif; font-size: 18px; line-height: 2.0; color: #000; width: 210mm; min-height: 297mm; padding: 1.5cm; margin: auto; box-sizing: border-box; position: relative; display: flex; flex-direction: column;}
                    .header { position: relative; height: 5cm; }
                    .header .right, .header .left, .header .center { position: absolute; top: 0; font-weight: bold; line-height: 1.6; }
                    .header .right { right: 0; text-align: right; }
                    .header .right h1, .header .right p { margin: 0; padding: 0; }
                    .header .left { left: 0; text-align: center; }
                    .header .left p { margin: 0; padding: 0; }
                    .header .center { left: 50%; transform: translateX(-50%); }
                    .header .center .crest { max-width: 80px; max-height: 80px; }
                    .letter-body { flex-grow: 1; }
                    .letter-body p { margin: 0 0 10px 0; padding: 0; text-align: right; }
                    .footer { flex-shrink: 0; padding-top: 20px; }
                    .signature-area { display: inline-block; font-weight: bold; text-align: center; }
                </style>
            </head>
            <body>
                <div class="page">
                    <div class="header">
                        <div class="right"><h1>جمهورية العراق</h1><p>وزارة التربية</p><p>${data.school_name || ''}</p></div>
                        <div class="center"><img src="${logoUrl}" alt="شعار" class="crest"></div>
                        <div class="left"><p>العدد: <span>${arabicLetterId}</span></p><p>التاريخ: <span>${formattedDate}</span></p></div>
                    </div>
                    <div class="letter-body">${letterBodyHtml}</div>
                    <div class="footer">
                         ${saveData.is_istifsar 
                            ? `<div style="display: flex; justify-content: space-between; width: 100%;"><div class="signature-area" style="text-align: right;"><p>توقيع المدرسة</p><p>الاسم:</p><p>التاريخ:</p></div><div class="signature-area" style="text-align: left;"><p>مديرة المدرسة</p><p>${adminFullName}</p></div></div>` 
                            : `<div style="text-align: left;"><div class="signature-area"><p>مديرة المدرسة</p><p>${adminFullName}</p></div></div>`
                         }
                    </div>
                </div>
            </body>
            </html>`;

        // استخدام Puppeteer لتوليد الـ PDF
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlForPdf, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
        await browser.close();

        // إتمام معاملة قاعدة البيانات
        await client.query('COMMIT');
        
        // إعداد اسم الملف وإرسال الاستجابة
        const safeRecipient = (saveData.endorsement_number || saveData.book_number || 'مخاطبة').substring(0, 20).replace(/[^a-z0-9\u0621-\u064A\s]/gi, '').replace(/\s+/g, '_');
        const fileName = `${saveData.type}_${safeRecipient}_${newLetterId}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('X-Letter-Id', newLetterId);
        res.send(pdfBuffer);

    } catch (error) {
        // في حالة حدوث خطأ، يتم التراجع عن أي تغييرات في قاعدة البيانات
        await client.query('ROLLBACK');
        console.error("❌ PDF Generation Server Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل في توليد ملف PDF: ' + error.message });
        }
    } finally {
        // إعادة الاتصال إلى المجمع
        client.release();
    }
});









app.get('/api/outgoing/:id/export-pdf', authMiddleware, async (req, res) => {
    const { id } = req.params;

    const client = await pool.connect();
    try {
        // 1. جلب بيانات الكتاب المحفوظة
        const letterResult = await client.query('SELECT * FROM outgoing WHERE id = $1', [id]);
        if (letterResult.rows.length === 0) {
            throw new Error('لم يتم العثور على الكتاب.');
        }
        const letterData = letterResult.rows[0];

        // 2. جلب الإعدادات الضرورية (اسم المدرسة، الشعار، اسم المدير)
        const userRes = await client.query('SELECT full_name FROM users WHERE id = $1', [letterData.created_by]);
        const adminFullName = userRes.rows[0]?.full_name || 'مدير المدرسة';

        const schoolRes = await client.query('SELECT name, logo_url FROM schools ORDER BY id LIMIT 1');
        const school_name = schoolRes.rows[0]?.name;
        const logo_url = schoolRes.rows[0]?.logo_url;

        // 3. إعادة بناء محتوى HTML للـ PDF
        let letterBodyHtml;
        const type = letterData.type;
        const content = letterData.content;

        // دالة مساعدة لتحويل الأرقام
        const convertToArabicNumerals = (num) => {
            if (num === null || num === undefined) return '';
            const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            return String(num).split('').map(digit => {
                if (/[0-9]/.test(digit)) { return arabicNumbers[parseInt(digit)]; }
                return digit;
            }).join('');
        };
        
        // الأنواع التي يكون محتواها HTML بالفعل
        if (type.includes('تجهيز') || type.includes('ترشيح')) {
            letterBodyHtml = convertToArabicNumerals(content);
        } 
        // نوع التخويل له تصميم خاص
        else if (type.includes('تخويل')) {
             const arabicContentForPdf = convertToArabicNumerals(content);
             letterBodyHtml = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 2cm;">
                    <div style="flex-grow: 1;">
                        ${arabicContentForPdf.split('\n').map(line => `<p style="margin: 0; padding: 5px 0;">${line.trim() === '' ? '<br>' : line}</p>`).join('')}
                    </div>
                    <div style="width: 120px; height: 150px; border: 2px dashed #ccc; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; font-size: 14px; margin-left: 20px; flex-shrink: 0;">
                        صورة المخول
                    </div>
                </div>`;
        }
        // بقية الأنواع التي محتواها نصي
        else {
            const arabicContentForPdf = convertToArabicNumerals(content);
            letterBodyHtml = arabicContentForPdf.split('\n').map(line => {
                const trimmedLine = line.trim();
                if (trimmedLine === '') return '<br>';
                 if (type === 'استفسار' && (trimmedLine.startsWith('الأستاذ/ة:') || trimmedLine.startsWith('يرجى الإجابة') || trimmedLine.startsWith('الإجابة:') || trimmedLine.startsWith('رأي إدارة المدرسة:'))) {
                    return `<p style="text-align: center; font-weight: bold;">${trimmedLine}</p>`;
                }
                if (trimmedLine.startsWith('الى /')) return `<p style="text-align: center;"><strong>${trimmedLine}</strong></p>`;
                if (trimmedLine.startsWith('م/')) return `<p style="text-align: center; font-weight: bold;">${trimmedLine}</p>`;
                if (trimmedLine.startsWith('بعد التحية')) return `<p style="text-align: center;">${trimmedLine}</p>`;
                if (trimmedLine.includes('مع فائق الشكر') || trimmedLine.includes('مع التقدير') || trimmedLine.includes('للتفضل بالعلم')) return `<p style="text-align: center;">${trimmedLine}</p>`;
                return `<p>${trimmedLine}</p>`;
            }).join('');
        }
        
        // 4. بناء الهيكل الكامل لصفحة الـ PDF
        const arabicLetterId = convertToArabicNumerals(letterData.id);
        
        // ✅✅✅ FIX: Manual date formatting to ensure day/month/year and Arabic numerals
        const date = new Date(letterData.date);
        const day = date.getDate();
        const month = date.getMonth() + 1; // getMonth() is zero-based
        const year = date.getFullYear();
const formattedDate = convertToArabicNumerals(`${year}/${month}/${day}`);
        
        const finalLogoUrl = logo_url ? `${req.protocol}://${req.get('host')}${logo_url}` : 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Coat_of_arms_of_Iraq.svg/1200px-Coat_of_arms_of_Iraq.svg.png';
        const is_istifsar = type.includes('استفسار');

        const htmlForPdf = `
            <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
                html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; }
                .page { font-family: 'Amiri', serif; font-size: 18px; line-height: 2.0; color: #000; width: 210mm; min-height: 297mm; padding: 1.5cm; margin: auto; box-sizing: border-box; position: relative; display: flex; flex-direction: column; }
                .header .right, .header .left, .header .center { position: absolute; top: 1.5cm; font-weight: bold; line-height: 1.6; }
                .header .right { right: 1.5cm; text-align: right; }
                .header .right h1, .header .right p { margin: 0; padding: 0; }
                .header .left { left: 1.5cm; text-align: center; }
                .header .left p { margin: 0; padding: 0; }
                .header .center { left: 50%; transform: translateX(-50%); }
                .header .center .crest { max-width: 80px; max-height: 80px; }
                .letter-body { margin-top: 5cm; flex-grow: 1; }
                .letter-body p { margin: 0 0 10px 0; padding: 0; text-align: right; }
                .letter-body table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; text-align: center; }
                .letter-body th, .letter-body td { border: 1px solid #333; padding: 8px; }
                .letter-body th { font-weight: bold; background-color: #f2f2f2; }
                .footer { flex-shrink: 0; padding-top: 20px; }
                .signature-area { display: inline-block; font-weight: bold; text-align: center; }
            </style></head><body><div class="page">
                <div class="header">
                    <div class="right"><h1>جمهورية العراق</h1><p>وزارة التربية</p><p>${school_name || ''}</p></div>
                    <div class="center"><img src="${finalLogoUrl}" alt="شعار" class="crest"></div>
                    <div class="left"><p>العدد: <span>${arabicLetterId}</span></p><p>التاريخ: <span>${formattedDate}</span></p></div>
                </div>
                <div class="letter-body">${letterBodyHtml}</div>
                <div class="footer">
                     ${is_istifsar 
                        ? `<div style="display: flex; justify-content: space-between; width: 100%;"><div class="signature-area" style="text-align: right;"><p>توقيع المدرسة</p><p>الاسم:</p><p>التاريخ:</p></div><div class="signature-area" style="text-align: left;"><p>مديرة المدرسة</p><p>${adminFullName}</p></div></div>` 
                        : `<div style="text-align: left;"><div class="signature-area"><p>مديرة المدرسة</p><p>${adminFullName}</p></div></div>`
                     }
                </div>
            </div></body></html>`;

        // 5. توليد PDF وإرساله
        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlForPdf, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
        await browser.close();
        
        const safeRecipient = (letterData.endorsement_number || letterData.book_number || 'مخاطبة').substring(0, 20).replace(/[^a-z0-9\u0621-\u064A\s]/gi, '').replace(/\s+/g, '_');
        const fileName = `${letterData.type}_${safeRecipient}_${letterData.id}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.setHeader('X-Letter-Id', letterData.id);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("❌ PDF Re-export Server Error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل في إعادة تصدير ملف PDF: ' + error.message });
        }
    } finally {
        client.release();
    }
});

// --- 3. تعديل على مسار البحث لجلب بيانات التعديل ---
// ابحث عن المسار GET /api/outgoing/search واستبدله بهذا الإصدار المحدث
//
app.get('/api/outgoing/search', authMiddleware, async (req, res) => {
    const { letterId } = req.query;
    if (!letterId) {
        return res.status(400).json({ error: 'رقم الكتاب مطلوب للبحث.' });
    }

    try {
        // البحث عن المخاطبة وربطها مع جدول المستخدمين لجلب اسم من قام بالتعديل
        const result = await pool.query(`
            SELECT 
                o.*, 
                u.full_name as modified_by_name 
            FROM outgoing o
            LEFT JOIN users u ON o.modified_by = u.id
            WHERE o.id = $1
        `, [letterId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على كتاب بهذا الرقم.' });
        }
        
        res.json(result.rows[0]);

    } catch (error) {
        console.error("❌ Search Error:", error);
        res.status(500).json({ error: 'فشل البحث عن الكتاب: ' + error.message });
    }
});


// دالة مساعدة لتحويل الأرقام الإنجليزية إلى هندية (عربية)
function convertToArabicNumerals(num) {
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(num).split('').map(digit => arabicNumbers[parseInt(digit)] || digit).join('');
}
// ... (بعد مسارات API الخاصة بالصفوف والفصول، أو في قسم جديد)

// API: جلب جميع المواد الفريدة من teacher_subjects
app.get('/api/all-unique-subjects', async (req, res) => {
    try {
        const result = await pool.query(`SELECT DISTINCT subject AS name FROM teacher_subjects ORDER BY name`);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching all unique subjects:", err.message);
        res.status(500).json({ error: 'فشل في جلب جميع المواد الفريدة' });
    }
});

// API: جلب المواد المرتبطة بصف معين
app.get('/api/classes/:class_id/subjects', async (req, res) => {
    const { class_id } = req.params;
    try {
        const result = await pool.query(`SELECT subject FROM class_subjects WHERE class_id = $1 ORDER BY subject`, [class_id]);
        res.json(result.rows);
    } catch (err) {
        console.error("❌ Error fetching class subjects:", err.message);
        res.status(500).json({ error: 'فشل في جلب مواد الصف' });
    }
});

// API: تعيين/تحديث المواد لصف معين
app.post('/api/class-subjects', async (req, res) => {
    const { class_id, subjects } = req.body;
    if (!class_id || !Array.isArray(subjects)) {
        return res.status(400).json({ error: 'معرّف الصف ومصفوفة المواد مطلوبة' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // حذف جميع المواد الحالية لهذا الصف
        await client.query(`DELETE FROM class_subjects WHERE class_id = $1`, [class_id]);

        // إضافة المواد الجديدة
        if (subjects.length > 0) {
            const insertValues = subjects.map(subject => `(${class_id}, '${subject.replace(/'/g, "''")}')`).join(',');
            await client.query(`INSERT INTO class_subjects (class_id, subject) VALUES ${insertValues}`);
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'تم تحديث مواد الصف بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error setting class subjects:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في تعيين مواد الصف: ' + err.message });
    } finally {
        client.release();
    }
});

// API: نسخ المواد من صف إلى آخر
app.post('/api/class-subjects/copy', async (req, res) => {
    const { from_class_id, to_class_id } = req.body;
    if (!from_class_id || !to_class_id) {
        return res.status(400).json({ error: 'معرّف الصف المصدر والصف الهدف مطلوبان' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // جلب المواد من الصف المصدر
        const sourceSubjectsResult = await client.query(`SELECT subject FROM class_subjects WHERE class_id = $1`, [from_class_id]);
        const subjectsToCopy = sourceSubjectsResult.rows.map(row => row.subject);

        // حذف جميع المواد الحالية من الصف الهدف
        await client.query(`DELETE FROM class_subjects WHERE class_id = $1`, [to_class_id]);

        // إضافة المواد المنسوخة إلى الصف الهدف
        if (subjectsToCopy.length > 0) {
            const insertValues = subjectsToCopy.map(subject => `(${to_class_id}, '${subject.replace(/'/g, "''")}')`).join(',');
            await client.query(`INSERT INTO class_subjects (class_id, subject) VALUES ${insertValues}`);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'تم نسخ المواد بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error copying class subjects:", err.message, err.stack);
        res.status(500).json({ error: 'فشل في نسخ مواد الصف: ' + err.message });
    } finally {
        client.release();
    }
});
// This is a complete Express.js route handler for generating a PDF receipt.
// It uses Puppeteer to generate a PDF from an HTML template.
// This version reverts to the classic, preferred design while keeping all functional upgrades.
app.get("/api/installments/:identifier", async (req, res) => {
    const { identifier } = req.params;
    let queryText = `...`;
    // إذا كان المدخل رقماً فقط، يبحث بالـ id. وإذا كان يحتوي على حروف، يبحث بالـ receipt_code
    if (/^\d+$/.test(identifier)) {
        queryText += ` WHERE si.id = $1`;
    } else {
        queryText += ` WHERE si.receipt_code = $1`;
    }
    // ...
});
// ✅✅✅ Final Attempt with flexible date matching. This is the last resort.
// ✅✅✅ المحاولة النهائية مع مطابقة مرنة للتاريخ. هذا هو الحل الأخير.
// ✅✅✅ The Definitive Function: This code will work correctly AFTER the date format in the 'absences' table is fixed to 'YYYY-MM-DD' and the column type is set to DATE.
// ✅✅✅ الدالة النهائية: هذا الكود سيعمل بشكل صحيح فقط بعد إصلاح تنسيق التاريخ في جدول 'absences' إلى 'YYYY-MM-DD' وتعيين نوع الحقل إلى DATE.
app.post('/api/export-daily-absence-pdf', authMiddleware, async (req, res) => {
    const { date, division_id } = req.body;
    const observerName = req.user.full_name || 'مدير النظام';

    if (!date || !division_id) {
        return res.status(400).json({ error: 'التاريخ ومعرّف الشعبة مطلوبان.' });
    }

    try {
        // --- 1. Fetch school, class, and division information ---
        const divisionInfoRes = await pool.query(`
            SELECT 
                d.name AS division_name,
                c.name AS class_name,
                s.name AS school_name,
                s.director_name
            FROM divisions d
            JOIN classes c ON d.class_id = c.id
            JOIN schools s ON c.school_id = s.id
            WHERE d.id = $1
        `, [division_id]);

        if (divisionInfoRes.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على الشعبة.' });
        }
        const { school_name, class_name, division_name, director_name } = divisionInfoRes.rows[0];

        // --- 2. Fetch lesson-specific records OF ALL TYPES ---
        const lessonRecordsRes = await pool.query(`
            SELECT 
                a.lesson,
                a.type AS absence_type,
                s.name as student_name,
                COALESCE(t.name, 'غير محدد') as teacher_name
            FROM absences a
            JOIN students s ON a.student_id = s.id
            LEFT JOIN teacher_subjects ts ON a.subject = ts.subject
            LEFT JOIN teachers t ON ts.teacher_id = t.id
            WHERE a.date::DATE = $1::DATE 
              AND s.division_id = $2 
              AND a.lesson IS NOT NULL AND a.lesson <> ''
            ORDER BY a.type, a.lesson ASC
        `, [date, division_id]);

        // --- 3. Fetch general (full-day) records OF ALL TYPES ---
        const generalRecordsRes = await pool.query(`
            SELECT 
                s.name as student_name,
                a.type as absence_type
            FROM absences a
            JOIN students s ON a.student_id = s.id
            WHERE a.date::DATE = $1::DATE
              AND s.division_id = $2
              AND (a.lesson IS NULL OR a.lesson = '')
            ORDER BY a.type, s.name ASC
        `, [date, division_id]);
        
        // --- 4. Group all records by their type ('غياب', 'درس', 'إجازة') ---
        const reportData = {};
        
        lessonRecordsRes.rows.forEach(row => {
            const type = row.absence_type;
            const lesson = row.lesson;
            if (!reportData[type]) reportData[type] = { lessons: {}, general: [] };
            if (!reportData[type].lessons[lesson]) {
                reportData[type].lessons[lesson] = { teacher: row.teacher_name, students: [] };
            }
            reportData[type].lessons[lesson].students.push(row.student_name);
        });

        generalRecordsRes.rows.forEach(row => {
            const type = row.absence_type;
            if (!reportData[type]) reportData[type] = { lessons: {}, general: [] };
            reportData[type].general.push(row.student_name);
        });

        // --- 5. Build the HTML content for the PDF with separate sections for each type ---
        let reportContentHtml = '';
        const typeTranslations = {
            'غياب': 'الغياب',
            'درس': 'الدروس الخصوصية',
            'إجازة': 'الإجازات'
        };

        const absenceTypes = Object.keys(reportData);

        if (absenceTypes.length === 0) {
            reportContentHtml = `<div class="no-absences">لا توجد أي سجلات لهذا اليوم.</div>`;
        } else {
            absenceTypes.forEach(type => {
                const typeData = reportData[type];
                const translatedType = typeTranslations[type] || type;
                
                reportContentHtml += `<div class="type-section">`;
                reportContentHtml += `<h2 class="type-header">${translatedType}</h2>`;

                const lessons = Object.keys(typeData.lessons);
                if (lessons.length > 0) {
                    const tableHeadersHtml = lessons.map(lesson => `<th>${lesson}<br><small>المدرس: ${typeData.lessons[lesson].teacher}</small></th>`).join('');
                    const tableCellsHtml = lessons.map(lesson => `<td><ul class="student-list">${typeData.lessons[lesson].students.map(name => `<li>${name}</li>`).join('')}</ul></td>`).join('');
                    reportContentHtml += `<h3>سجلات خلال الحصص</h3><table><thead><tr class="header-row">${tableHeadersHtml}</tr></thead><tbody><tr class="data-row">${tableCellsHtml}</tr></tbody></table>`;
                }

                if (typeData.general.length > 0) {
                    reportContentHtml += `<h3 class="general-absence-title">سجلات اليوم الكامل</h3><ul class="general-absence-list">${typeData.general.map(name => `<li>${name}</li>`).join('')}</ul>`;
                }
                reportContentHtml += `</div>`;
            });
        }
        
        const htmlContent = `
            <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>جدول السجلات اليومي</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body { font-family: 'Cairo', sans-serif; direction: rtl; font-size: 10px; } 
                .report-container { width: 100%; margin: auto; }
                .header { text-align: center; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                .header h1 { margin: 0; font-size: 18px; } .header h2 { margin: 5px 0; font-size: 16px; font-weight: 600; }
                .header-details { display: flex; justify-content: space-around; margin-top: 10px; font-size: 12px; }
                
                .type-section { margin-top: 20px; page-break-inside: avoid; }
                .type-header { font-size: 16px; background-color: #4A90E2; color: white; padding: 8px; text-align: center; border-radius: 5px; }
                
                table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 10px; }
                th, td { border: 1px solid black; padding: 5px; text-align: right; vertical-align: top; word-wrap: break-word; }
                .header-row th { background-color: #f2f2f2; font-weight: 700; text-align: center; vertical-align: middle; height: 40px; }
                .header-row th small { font-weight: normal; font-size: 9px; } .data-row td { height: 150px; } /* Reduced height */
                .student-list { list-style-type: none; padding-right: 5px; margin: 0; } .student-list li { padding-bottom: 3px; }
                .general-absence-title { margin-top: 15px; text-align: center; font-size: 14px; background-color: #f2f2f2; padding: 8px; border: 1px solid #ccc; }
                .general-absence-list { columns: 4; -webkit-columns: 4; -moz-columns: 4; list-style-position: inside; padding-right: 20px; }
                .signatures { display: flex; justify-content: space-around; margin-top: 40px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; font-weight: bold; }
                .signature-box { text-align: center; } .signature-box p { margin-top: 30px; font-weight: normal; }
                .no-absences { text-align: center; font-size: 18px; font-weight: bold; color: #555; padding: 50px; }
            </style></head><body><div class="report-container">
            <div class="header"><h1>${school_name}</h1><h2>قائمة السجلات اليومية</h2><div class="header-details"><span>الصف: ${class_name} / الشعبة: ${division_name}</span><span>التاريخ: ${new Date(date).toLocaleDateString('ar-EG-u-nu-arab', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></div></div>
            <div class="report-body">${reportContentHtml}</div><div class="signatures"><div class="signature-box"><span>توقيع المراقب</span><p>${observerName}</p></div><div class="signature-box"><span>توقيع المدير</span><p>${director_name || '....................'}</p></div></div>
            </div></body></html>`;
        
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true, margin: { top: '1cm', right: '1cm', bottom: '1.5cm', left: '1cm' } });
        await browser.close();

        const fileName = `تقرير_سجلات_${division_name.replace(/ /g, '_')}_${date}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("❌ [PDF EXPORT] CRITICAL ERROR:", err.message, err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل الخادم في توليد ملف PDF.' });
        }
    }
});


app.get("/api/installments/:installment_id/receipt", async (req, res) => {
    const { installment_id } = req.params;
    console.log(`[Backend] Generating PDF receipt for installment ID: ${installment_id}`);

    let browser = null; // Define browser outside try block for the finally clause

    try {
        // --- Helper Functions ---
        // These functions convert numbers to words and format currency/dates.
        const numberToWords = (number) => {
            const units = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
            const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
            const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
            const hundreds = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
            const thousands = { single: "ألف", dual: "ألفان", plural: "آلاف" };
            const millions = { single: "مليون", dual: "مليونان", plural: "ملايين" };

            function convertThreeDigits(num) {
                let str = "";
                const h = Math.floor(num / 100);
                const t = Math.floor((num % 100) / 10);
                const u = num % 10;
                if (h > 0) str += hundreds[h] + (t > 0 || u > 0 ? " و " : "");
                if (t === 1 && u > 0) { str += teens[u]; } 
                else {
                    if (t > 0) str += tens[t] + (u > 0 ? " و " : "");
                    if (u > 0) str += units[u];
                }
                return str;
            }
            if (number === 0) return "صفر";
            let words = "";
            const millionPart = Math.floor(number / 1000000);
            const thousandPart = Math.floor((number % 1000000) / 1000);
            const lastPart = number % 1000;
            if (millionPart > 0) {
                if (millionPart === 1) words += millions.single;
                else if (millionPart === 2) words += millions.dual;
                else if (millionPart >= 3 && millionPart <= 10) words += convertThreeDigits(millionPart) + " " + millions.plural;
                else words += convertThreeDigits(millionPart) + " " + millions.single;
                if (thousandPart > 0 || lastPart > 0) words += " و ";
            }
            if (thousandPart > 0) {
                if (thousandPart === 1) words += thousands.single;
                else if (thousandPart === 2) words += thousands.dual;
                else if (thousandPart >= 3 && thousandPart <= 10) words += convertThreeDigits(thousandPart) + " " + thousands.plural;
                else words += convertThreeDigits(thousandPart) + " " + thousands.single;
                if (lastPart > 0) words += " و ";
            }
            if (lastPart > 0) {
                words += convertThreeDigits(lastPart);
            }
            return words.trim() + " دينار عراقي فقط لا غير";
        };
        
        const formatCurrency = (amount) => {
            if (amount === null || amount === undefined || isNaN(parseFloat(amount))) return "٠";
            const number = parseFloat(amount);
            const options = {
                minimumFractionDigits: (number % 1 === 0) ? 0 : 2,
                maximumFractionDigits: 2,
            };
            const formatted = new Intl.NumberFormat('en-US', options).format(number);
            const easternArabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
            return formatted.replace(/[0-9]/g, d => easternArabicNumerals[d]);
        };

        const formatDate = (date) => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }

        // --- الخطوة 1: جلب بيانات القسط من قاعدة البيانات ---
        const result = await pool.query(`
            SELECT si.*, s.name AS student_name, s.gender, d.name AS division_name, c.name AS class_name,
                   sch.name AS school_name, spp.total_amount_due AS plan_total_amount_due
            FROM student_installments si
            JOIN student_payment_plans spp ON si.payment_plan_id = spp.id
            JOIN students s ON spp.student_id = s.id
            JOIN divisions d ON s.division_id = d.id
            JOIN classes c ON d.class_id = c.id
            JOIN schools sch ON c.school_id = sch.id
            WHERE si.id = $1
        `, [installment_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "القسط غير موجود." });
        }
        
        // ✅ هنا يتم تعريف المتغير "installment" بشكل صحيح
        const installment = result.rows[0];

        // --- حساب المبالغ المتبقية والمدفوعة ---
        const totalPaidRes = await pool.query(
            "SELECT COALESCE(SUM(amount_paid), 0) AS total_paid FROM student_installments WHERE payment_plan_id = $1 AND payment_date <= $2",
            [installment.payment_plan_id, installment.payment_date]
        );

        const actualTotalPaidForPlan = parseFloat(totalPaidRes.rows[0].total_paid);
        const planTotalDue = parseFloat(installment.plan_total_amount_due);
        const remainingBalance = planTotalDue - actualTotalPaidForPlan;
        const amountPaidInWords = numberToWords(installment.amount_paid);
        const genderText = installment.gender === 'Female' ? 'الطالبة' : 'الطالب';
        
        // --- ✅✅ الخطوة 2: نقل كود الباركود إلى هنا (المكان الصحيح) ✅✅ ---
        // يتم استخدام الرمز المرجعي إن وجد، أو رقم القسط كحل بديل للوصولات القديمة
        const barcodeText = installment.receipt_code || installment.id.toString();
        let barcodeImageSrc = '';
        try {
            barcodeImageSrc = await generateRealBarcode(barcodeText);
        } catch (barcodeError) {
            console.error("Could not generate barcode:", barcodeError.message);
            barcodeImageSrc = ''; // اجعل الصورة فارغة في حال حدوث خطأ
        }
        
        // --- الخطوة 3: تجهيز أصول ومحتوى HTML ---
        const fontBoldBuffer = await fs_async.readFile('./Cairo-Bold.ttf');
        const fontRegularBuffer = await fs_async.readFile('./Cairo-Regular.ttf');
        const fontBoldBase64 = fontBoldBuffer.toString('base64');
        const fontRegularBase64 = fontRegularBuffer.toString('base64');
        
        // Create the HTML content for the PDF
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="ar">
            <head>
            <meta charset="UTF-8">
            <title>وصل قبض - ${installment.id}</title>
            <style>
                @font-face { font-family: 'Cairo'; src: url(data:font/truetype;base64,${fontRegularBase64}) format('truetype'); font-weight: normal; }
                @font-face { font-family: 'Cairo'; src: url(data:font/truetype;base64,${fontBoldBase64}) format('truetype'); font-weight: bold; }
                body { font-family: 'Cairo', sans-serif; direction: rtl; line-height: 1.8; color: #333; font-size: 14px; margin: 0; }
                .page-container { width: 210mm; min-height: 297mm; margin: auto; padding: 1.5cm; box-sizing: border-box; display: flex; flex-direction: column; }
                .main-content { flex-grow: 1; }
                .receipt-box { border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); padding: 30px; }
                .header { text-align: center; border-bottom: 2px solid #003366; padding-bottom: 15px; margin-bottom: 20px; }
                .header h1 { margin: 0; color: #003366; font-size: 28px; font-weight: bold; }
                .header p { margin: 5px 0 0; font-size: 16px; font-weight: bold; }
                .meta-info { display: flex; justify-content: space-between; margin-bottom: 30px; font-size: 12px; color: #555; font-weight: bold; }
                .details-section p { display: flex; justify-content: space-between; margin: 15px 0; align-items: center; }
                .details-section p strong { min-width: 200px; font-size: 15px; }
                .details-section p span { color: #003366; text-align: left; flex-grow: 1; font-weight: bold; }
                .amount { font-weight: bold; font-size: 18px; color: #000; }
                .summary-table { width: 100%; border-collapse: collapse; margin-top: 30px; }
                .summary-table th, .summary-table td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                .summary-table thead { background-color: #003366; color: #fff; }
                .summary-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
                .summary-table tfoot td { font-weight: bold; color: #003366; }
                .page-footer { text-align: center; padding-top: 20px; }
                .signatures { display: flex; justify-content: space-around; align-items: flex-end; margin-top: 40px; }
            </style>
            </head>
            <body>
            <div class="page-container">
                <div class="main-content">
                    <div class="receipt-box">
                        <div class="header">
                            <h1>وصل استلام مبلغ</h1>
                            <p>${installment.school_name || 'غير متوفر'}</p>
                        </div>
                        <div class="meta-info">
                            <span>التاريخ: ${formatDate(new Date())}</span>
                            <span>رقم الوصل: ${installment.id}</span>
                        </div>
                        <div class="details-section">
                            <p><strong>استلمنا من ولي أمر ${genderText}:</strong> <span>${installment.student_name || 'غير متوفر'}</span></p>
                            <p><strong>الصف والشعبة:</strong> <span>${installment.class_name || ''} / ${installment.division_name || ''}</span></p>
                            <p><strong>مبلغاً وقدره (رقماً):</strong> <span><span class="amount">${formatCurrency(installment.amount_paid)}</span> د.ع.</span></p>
                            <p><strong>المبلغ كتابتاً:</strong> <span style="font-weight: bold; font-size: 14px;">${amountPaidInWords}</span></p>
                            <p><strong>وذلك عن:</strong> <span>${installment.installment_number > 0 ? `القسط رقم (<span class="amount">${installment.installment_number}</span>)` : (installment.installment_number === 0 ? 'دفعة مقدمة' : 'دفعة إضافية')}</span></p>
                        </div>
                        <div class="summary-section">
                            <table class="summary-table">
                                <thead><tr><th>البيان</th><th>المبلغ (د.ع.)</th></tr></thead>
                                <tbody>
                                    <tr><td>المبلغ الكلي للقسط الدراسي</td><td class="amount">${formatCurrency(planTotalDue)}</td></tr>
                                    <tr><td>إجمالي المدفوع (شامل هذه الدفعة)</td><td class="amount">${formatCurrency(actualTotalPaidForPlan)}</td></tr>
                                </tbody>
                                <tfoot><tr><td>المبلغ المتبقي من القسط</td><td class="amount">${formatCurrency(remainingBalance)}</td></tr></tfoot>
                            </table>
                        </div>
                        <div class="signatures">
                            <div><p>_________________________</p><p>توقيع المحاسب</p></div>
                            <div><p>_________________________</p><p>ختم الإدارة</p></div>
                        </div>
                    </div>
                </div>
                <div class="page-footer">
                    ${barcodeImageSrc ? `<img src="${barcodeImageSrc}" alt="Barcode" style="height: 90px;"/>` : '<p>تعذر إنشاء الباركود</p>'}
                </div>
            </div>
            </body>
            </html>
        `;

        // --- الخطوة 4: تشغيل Puppeteer وتوليد PDF ---
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBytes = await page.pdf({ format: 'A4', printBackground: true });
        
        // --- الخطوة 5: إرسال استجابة PDF ---
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=receipt_${installment.id}.pdf`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error(`[Backend] Critical error generating PDF for installment ID ${installment_id}:`, error.message, error.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: "فشل توليد الوصل بسبب خطأ داخلي في الخادم." });
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});


app.get('/api/class-fees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT cf.*, c.name as class_name, s.name as school_name FROM class_fees cf JOIN classes c ON cf.class_id = c.id JOIN schools s ON c.school_id = s.id WHERE cf.id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class fee not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error fetching single class fee:", err.message);
        res.status(500).json({ error: 'Failed to fetch class fee details: ' + err.message });
    }
});



// ... (Your existing app.post('/api/class-fees'))
// ... (Your existing app.get('/api/class-fees'))
// ... (Your existing app.get('/api/classes/:class_id/fees'))

// PUT /api/class-fees/:id - Endpoint to update an existing class fee
app.put('/api/class-fees/:id', async (req, res) => {
    const { id } = req.params;
    const { class_id, academic_year, total_fee, default_installments, notes } = req.body;

    // Basic validation
    if (!class_id || !total_fee) {
        return res.status(400).json({ error: 'Class ID and total fee are required.' });
    }

    try {
        const result = await pool.query(
            `UPDATE class_fees
            SET class_id = $1, academic_year = $2, total_fee = $3, default_installments = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
            WHERE id = $6 RETURNING *`,
            [class_id, academic_year || '2024-2025', total_fee, default_installments || 1, notes, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Class fee not found.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error("❌ Error updating class fee:", err.message, err.stack);
        res.status(500).json({ error: 'Failed to update class fee: ' + err.message });
    }
});

async function setupDynamicFieldsTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.recipients (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.letter_subjects (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // إضافة حقل للشعار في جدول المدارس
        await client.query(`ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;`);

        await client.query('COMMIT');
        console.log("✅ Tables for recipients, subjects, and logo_url column are ready.");
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("❌ Error setting up dynamic fields tables:", err.message);
        throw err;
    } finally {
        client.release();
    }
}
async function ensureScheduleTableExists() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.schedule (
                id SERIAL PRIMARY KEY,
                division_id INTEGER NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
                day INTEGER NOT NULL,
                period INTEGER NOT NULL,
                teacher_id INTEGER NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
                subject TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    } catch (error) {
        throw error;
    }
}


  const axios = require('axios');

  const TELEGRAM_BOT_TOKEN = "7738522343:AAG15Ktath0IaxsclzvL9OtF7q6-vNfrfJk";
  const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  function groupAbsencesForServer(absences) {
      const students = new Map();
      absences.forEach(absence => {
          if (!students.has(absence.student_id)) {
              students.set(absence.student_id, {
                  id: absence.student_id,
                  name: absence.student_name,
                  phone: absence.parent_phone,
                  gender: absence.gender,
                  telegram_chat_id: absence.telegram_chat_id, 
                  absences: []
              });
          }
          const studentData = students.get(absence.student_id);
          studentData.absences.push({
              date: absence.date,
              type: absence.absence_type,
              subject: absence.subject,
              lesson: absence.lesson,
              notes: absence.absence_notes
          });
      });
      return Array.from(students.values());
  }


async function generatePdfFromHtml(htmlContent, title) {
    let browser = null;
    try {
        // Launch Puppeteer browser
        browser = await puppeteer.launch({ 
            headless: true, // Use new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();

        // Set content and wait for it to be fully loaded
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        return pdfBuffer;
    } finally {
        // Ensure the browser is closed
        if (browser) {
            await browser.close();
        }
    }
}





const renderGrade = (grade) => {
    // إذا كانت الدرجة غير موجودة، نعرض "---"
    if (grade === null || grade === undefined) return '---';
    
    // تقريب الدرجة لأقرب عدد صحيح
    const roundedGrade = Math.round(grade);
    // التحقق إذا كانت الدرجة أقل من 50
    const isFail = roundedGrade < 50;
    // تحديد النمط (أحمر وتحته خط) في حالة الرسوب
    const style = isFail ? 'color: #D32F2F; text-decoration: underline; font-weight: bold;' : '';
    
    // تحويل الأرقام إلى الصيغة العربية
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    const arabicGrade = String(roundedGrade).replace(/[0-9]/g, d => arabicNumbers[parseInt(d)]);

    // إرجاع الدرجة مع النمط المطبق
    return `<span style="${style}">${arabicGrade}</span>`;
};

async function generateCertificatePdfHtml(data, verificationUrl, directorName = '') {
    // --- 1. حساب النتيجة النهائية بناءً على عدد مواد الرسوب والمعدل ---
    let failingSubjectsCount = 0;
    let finalAverage = null;

    if (data.grades && data.grades.length > 0) {
        let finalGradesSum = 0;
        let gradesCount = 0;

        data.grades.forEach(grade => {
            // ✅ المنطق الأساسي هنا: استخدم درجة 'final_with_makeup' إذا كانت موجودة،
            // وإلا فاستخدم 'final_grade'. هذا يضمن أن امتحان الإكمال يؤثر على النتيجة.
            const finalOverallGrade = grade.final_with_makeup !== null && grade.final_with_makeup !== undefined
                ? grade.final_with_makeup
                : grade.final_grade;

            // تستخدم هذه الجزئية التقريب لتحديد الرسوب.
            // يتم استخدام 'finalOverallGrade' (التي قد تكون درجة الإكمال) لتحديد ما إذا كانت المادة راسبة.
            if (finalOverallGrade !== null && finalOverallGrade !== undefined && Math.round(finalOverallGrade) < 50) {
                failingSubjectsCount++;
            }

            // يتم تضمين 'finalOverallGrade' (التي قد تكون درجة الإكمال) في حساب المعدل الكلي.
            if (finalOverallGrade !== null && finalOverallGrade !== undefined) {
                finalGradesSum += finalOverallGrade;
                gradesCount++;
            }
        });

        if (gradesCount > 0) {
            finalAverage = (finalGradesSum / gradesCount).toFixed(2);
        }
    } else {
        // إذا لم تكن هناك درجات، اعتبر الطالب راسباً تلقائياً.
        failingSubjectsCount = 99;
    }

    let finalResultText = '';
    let resultClassName = '';

    if (failingSubjectsCount === 0) {
        finalResultText = 'نــاجــح';
        resultClassName = 'success';
    } else if (failingSubjectsCount <= 3) { // 1 إلى 3 مواد إكمال
        finalResultText = 'مــكــمــل';
        resultClassName = 'fail'; // يمكن تغيير هذا الكلاس إذا كان هناك تصميم مختلف للمكملين
    } else { // أكثر من 3 مواد إكمال (أو 99 في حالة عدم وجود درجات)
        finalResultText = 'راســب';
        resultClassName = 'fail';
    }

    /**
     * تحويل الأرقام الإنجليزية إلى أرقام عربية.
     * @param {number|string|null|undefined} num - الرقم المراد تحويله.
     * @returns {string} - الرقم المحول إلى صيغة عربية أو '---' إذا كان غير صالح.
     */
    const toArabicNum = (num) => {
        if (num === null || num === undefined || num === '') return '---';
        const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        // تحويل الرقم إلى سلسلة نصية لتمكين الاستبدال
        return String(num).replace(/[0-9]/g, d => arabicNumbers[parseInt(d)]);
    };

    /**
     * عرض الدرجة بعد التقريب وتحويلها إلى أرقام عربية.
     * @param {number|string|null|undefined} grade - الدرجة المراد عرضها.
     * @returns {string} - الدرجة المقربة والمحولة إلى أرقام عربية، أو '---'.
     */
    const renderGrade = (grade) => {
        // إذا كانت الدرجة غير موجودة، أرجع "---"
        if (grade === null || grade === undefined || grade === '') {
            return '---';
        }

        // حوّل القيمة إلى رقم عشري للتعامل مع المدخلات النصية (مثل "49.5")
        const numericGrade = parseFloat(grade);

        // إذا لم تكن القيمة رقماً صالحاً، أرجع "---"
        if (isNaN(numericGrade)) {
            return '---';
        }

        // قرّب الدرجة لأقرب عدد صحيح
        const roundedGrade = Math.round(numericGrade);

        // حوّل الرقم المقرّب إلى أرقام عربية
        const arabicRoundedGrade = toArabicNum(roundedGrade);

        // أضف النمط إذا كانت الدرجة أقل من 50
        if (roundedGrade < 50) {
            return `<span style="color: red; text-decoration: underline;">${arabicRoundedGrade}</span>`;
        }

        return arabicRoundedGrade;
    };

    let gradesRows = '';
    if (data.grades && data.grades.length > 0) {
        data.grades.forEach(grade => {
            gradesRows += `
                <tr>
                    <td>${grade.subject}</td>
                    <td>${renderGrade(grade.month1_term1)}</td>
                    <td>${renderGrade(grade.month2_term1)}</td>
                    <td class="auto-cell">${renderGrade(grade.avg1)}</td>
                    <td class="mid-year-col">${renderGrade(grade.mid_term)}</td>
                    <td>${renderGrade(grade.month1_term2)}</td>
                    <td>${renderGrade(grade.month2_term2)}</td>
                    <td class="auto-cell">${renderGrade(grade.avg2)}</td>
                    <td class="auto-cell">${renderGrade(grade.s3)}</td>
                    <td>${renderGrade(grade.final_exam)}</td>
                    <td class="final-col">${renderGrade(grade.final_grade)}</td>
                    <td>${renderGrade(grade.makeup_exam)}</td>
                    <td class="final-col">${renderGrade(grade.final_with_makeup)}</td>
                </tr>
            `;
        });
    } else {
        gradesRows = '<tr><td colspan="13">لا توجد درجات مسجلة.</td></tr>';
    }

    // جزء توليد رمز الاستجابة السريعة (QR Code)
    // يتطلب هذا مكتبة 'bwip-js' التي عادة ما تستخدم في بيئات Node.js
    let qrCodeImageSrc = '';
    try {
        const qrCodeContent = verificationUrl || `Student: ${data.student_name}\nID: ${data.student_id}\nTerm: ${data.term}`;
        // تأكد من أن bwipjs معرف هنا (مثلاً، إذا كنت تستخدم Node.js، يجب أن تكون قد قمت بـ `const bwipjs = require('bwip-js');` في بداية الملف)
        // **ملاحظة:** إذا كانت هذه الدالة ستعمل في متصفح، ستحتاج إلى استبدال `bwip-js` بمكتبة QR Code تعمل في المتصفح.
        // بما أن الطلب كان تعديل الدالة الموجودة، تم الإبقاء على استدعاء `bwipjs`.
        const bwipjs = require('bwip-js');
        const png = await bwipjs.toBuffer({
            bcid: 'qrcode', text: qrCodeContent, scale: 3, width: 32, height: 32,
            backgroundcolor: 'FFFFFF', // لون خلفية أبيض لضمان الرؤية
            barcolor: '000000' // لون الباركود أسود
        });
        qrCodeImageSrc = `data:image/png;base64,${png.toString('base64')}`;
    } catch (e) {
        console.error("Certificate QR Code Generation Error:", e);
        // يمكن إضافة صورة QR Code بديلة أو نص خطأ هنا إذا فشل التوليد
        qrCodeImageSrc = ''; // امسح الصورة لتجنب عرض رابط مكسور
    }

    return `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>شهادة درجات الطالب</title>
            <style>
                @font-face {
                    font-family: 'Amiri'; src: url('fonts/Amiri-Italic.ttf') format('truetype'); font-weight: 400;
                }
                @font-face {
                    font-family: 'Amiri'; src: url('fonts/Amiri-Bold.ttf') format('truetype'); font-weight: 700;
                }
                body {
                    font-family: 'Amiri', serif; margin: 0; padding: 0; background: #fff;
                    -webkit-print-color-adjust: exact; print-color-adjust: exact;
                }
                .page {
                    width: 210mm; /* A4 width */
                    height: 297mm; /* A4 height */
                    padding: 15mm; margin: auto;
                    box-sizing: border-box; display: flex; flex-direction: column;
                    border: 10px solid; border-image: linear-gradient(45deg, #003366, #4a90e2) 1;
                    position: relative; page-break-after: always;
                }
                .page:last-child { page-break-after: avoid; }
                .header { text-align: center; margin-bottom: 10px; }
                .header-line-1 { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
                .header-line-2 { font-size: 26px; font-weight: 700; color: #003366; margin: 5px 0; }
                .header-line-3 { font-size: 20px; font-weight: 700; }
                .student-info {
                    border: 1px solid #ddd; border-radius: 8px; padding: 10px 15px;
                    margin-bottom: 15px; display: grid; grid-template-columns: 1fr 1fr;
                    gap: 8px 20px; font-size: 15px; text-align: center;
                }
                .student-info p { margin: 4px 0; }
                .student-info strong { color: #003366; }
                .grades-table {
                    width: 100%; border-collapse: collapse; flex-grow: 1; table-layout: fixed;
                }
                .grades-table th, .grades-table td {
                    border: 1px solid #ccc; padding: 4px; text-align: center;
                    font-size: 14px; word-wrap: break-word;
                }
                .grades-table tr > *:nth-child(1) { width: 12%; }
                .grades-table th {
                    background-color: #eaf2f8; color: #003366; font-weight: 700;
                    font-size: 12px; vertical-align: middle;
                }
                .grades-table td:first-child { text-align: right; padding-right: 8px; }
                .auto-cell, .mid-year-col, .final-col { font-weight: bold; }
                .summary {
                    margin-top: 15px; padding-top: 15px; border-top: 2px solid #003366;
                    display: flex; justify-content: space-around; align-items: center;
                    font-size: 18px; font-weight: 700;
                }
                .summary-item { text-align: center; }
                .summary-item .label { color: #555; font-size: 15px; }
                .summary-item .value {
                    padding: 5px 20px; border-radius: 8px; font-size: 20px;
                    font-weight: bold; color:rgb(0, 0, 0); min-width: 120px; display: inline-block;
                }
                .summary-item .value.success { background-color: #28a745; }
                .summary-item .value.fail { background-color: #D32F2F; }
                .footer {
                    margin-top: auto; padding-top: 10px;
                    display: flex;
                    justify-content: space-between; /* توزيع العناصر على الأطراف */
                    align-items: flex-end; /* محاذاة العناصر للأسفل */
                    width: 100%; /* لضمان أخذ المساحة الكاملة */
                }
                .signature-area {
                    text-align: left; /* جعل النص في أقصى اليسار */
                    font-size: 16px; font-weight: bold;
                    flex-grow: 1; /* لتأخذ المساحة المتبقية وتدفع الـ QR إلى المنتصف */
                }
                .qr-code-area {
                    text-align: center; /* توسيط الباركود */
                    position: absolute; /* وضع مطلق للتحكم الدقيق */
                    left: 50%; /* تحريك الباركود إلى منتصف الصفحة */
                    transform: translateX(-50%); /* إزاحة الباركود إلى الوراء بنصف عرضه ليكون في المنتصف تمامًا */
                    bottom: 25px; /* مسافة من أسفل الصفحة */
                }
                .qr-code-area img { width: 70px; height: 70px; }
            </style>
        </head>
        <body>
            <div class="page">
                <div class="header">
                    <div class="header-line-1"><span>جمهورية العراق</span><span>وزارة التربية</span></div>
                    <div class="header-line-2">${data.school_name || "اسم المدرسة"}</div>
                    <div class="header-line-3">شهادة الدرجات النهائية للعام الدراسي ${toArabicNum(data.term || '----')}</div>
                </div>
                <div class="student-info">
                    <p><strong>اسم الطالب:</strong> ${data.student_name || 'غير متوفر'}</p>
                    <p><strong>الصف:</strong> ${data.class_name || 'غير محدد'}</p>
                    <p><strong>الرقم الامتحاني:</strong> ${toArabicNum(data.student_id)}</p>
                    <p><strong>الشعبة:</strong> ${data.division_name || 'غير محددة'}</p>
                </div>
                <table class="grades-table">
                    <thead>
                        <tr>
                            <th rowspan="2" style="vertical-align: middle;">المادة</th>
                            <th colspan="3">الفصل الدراسي الاول</th>
                            <th rowspan="2" class="mid-year-col" style="vertical-align: middle;">نصف السنة</th>
                            <th colspan="3">الفصل الدراسي الثاني</th>
                            <th rowspan="2" style="vertical-align: middle;">السعي السنوي</th>
                            <th rowspan="2" style="vertical-align: middle;">الامتحان النهائي</th>
                            <th rowspan="2" style="vertical-align: middle;">الدرجة النهائية</th>
                            <th rowspan="2" style="vertical-align: middle;">امتحان الاكمال</th>
                            <th rowspan="2" style="vertical-align: middle;">النهائية بعد الاكمال</th>
                        </tr>
                        <tr>
                            <th>الشهر الاول</th><th>الشهر الثاني</th><th>معدل الفصل</th>
                            <th>الشهر الاول</th><th>الشهر الثاني</th><th>معدل الفصل</th>
                        </tr>
                    </thead>
                    <tbody>${gradesRows}</tbody>
                </table>
                <div class="summary">
                    <div class="summary-item">
                        <div class="label">المعدل النهائي</div>
                        <div class="value">${renderGrade(finalAverage)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="label">النتيجة</div>
                        <div class="value ${resultClassName}">${finalResultText}</div>
                    </div>
                </div>
                <div class="footer">
                    <div class="signature-area">
                        <p>مدير المدرسة</p>
                        <p>${directorName || ''}</p>
                    </div>
                    <div class="qr-code-area">
                        ${qrCodeImageSrc ? `<img src="${qrCodeImageSrc}" alt="QR Code" />` : ''}
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

app.get('/api/students/:student_id/certificate/export-pdf', authMiddleware, async (req, res) => { // ✅ تمت إضافة authMiddleware
    const { student_id } = req.params;
    const { term } = req.query;

    try {
        const certificateData = await getStudentCertificateData(student_id, term);

        if (!certificateData) {
            return res.status(404).send('بيانات الشهادة غير متوفرة.');
        }

        // ✅ جلب اسم المدير من المستخدم المسجل دخوله
        const directorName = req.user.full_name || 'مدير المدرسة';
        // ✅ إنشاء رابط التحقق
        const verificationUrl = `${req.protocol}://${req.get('host')}/student_public_viewer.html?query=${student_id}&term=${term}`;

        // ✅ تمرير اسم المدير ورابط التحقق إلى الدالة
        const htmlContent = await generateCertificatePdfHtml(certificateData, verificationUrl, directorName);

        const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        const fileName = `شهادة-${certificateData.student_name.replace(/\s/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("Error exporting single certificate PDF:", err.message, err.stack);
        res.status(500).send("خطأ في الخادم أثناء توليد الشهادة.");
    }
});
app.get('/api/divisions/:division_id/certificates/export-pdf', authMiddleware, async (req, res) => { // ✅ تمت إضافة authMiddleware
    const { division_id } = req.params;
    const { term } = req.query;

    if (!division_id || !term) {
        return res.status(400).send('معرف الشعبة والفصل الدراسي مطلوبان.');
    }

    const client = await pool.connect();
    let browser;
    try {
        const studentsRes = await client.query('SELECT id FROM students WHERE division_id = $1 ORDER BY name', [division_id]);
        const students = studentsRes.rows;

        if (students.length === 0) {
            return res.status(404).send('لا يوجد طلاب في هذه الشعبة.');
        }

        let combinedHtml = '';
        let divisionName, className;
        
        // ✅ جلب اسم المدير مرة واحدة
        const directorName = req.user.full_name || 'مدير المدرسة';

        for (const student of students) {
            const certificateData = await getStudentCertificateData(student.id, term);
            if (certificateData) {
                if (!divisionName) divisionName = certificateData.division_name;
                if (!className) className = certificateData.class_name;
                
                // ✅ إنشاء رابط التحقق لكل طالب
                const verificationUrl = `${req.protocol}://${req.get('host')}/student_public_viewer.html?query=${student.id}&term=${term}`;
                // ✅ تمرير البيانات للدالة
                combinedHtml += await generateCertificatePdfHtml(certificateData, verificationUrl, directorName);
            }
        }

        if (!combinedHtml) {
             return res.status(404).send('لم يتم العثور على بيانات لطباعتها لأي طالب.');
        }

        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(`<html><body>${combinedHtml}</body></html>`, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
        
        const fileName = `شهادات-${(className || 'الصف').replace(/\s/g, '_')}-${(divisionName || 'الشعبة').replace(/\s/g, '_')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("Error exporting bulk certificates PDF:", err.message, err.stack);
        res.status(500).send("خطأ في الخادم أثناء توليد الشهادات.");
    } finally {
        if(browser) await browser.close();
        client.release();
    }
});

// API Endpoint 1: Report of unpaid students with amounts and installment counts
app.get('/api/financial-reports/unpaid-summary', async (req, res) => {
    try {
        // Query the database to get the list of unpaid students
        const queryResult = await pool.query(`
            SELECT
                s.name AS student_name,
                (spp.total_amount_due - COALESCE(SUM(si.amount_paid), 0.00)) AS remaining_balance,
                COUNT(si.id) FILTER (WHERE si.status NOT IN ('paid', 'waived')) AS unpaid_installments_count,
                cls.name as class_name
            FROM students s
            JOIN student_payment_plans spp ON s.id = spp.student_id
            JOIN student_installments si ON spp.id = si.payment_plan_id
            JOIN divisions div ON s.division_id = div.id
            JOIN classes cls ON div.class_id = cls.id
            WHERE spp.status <> 'fully_paid'
            GROUP BY s.id, spp.id, cls.name
            HAVING (spp.total_amount_due - COALESCE(SUM(si.amount_paid), 0.00)) > 0.01
            ORDER BY cls.name, s.name;
        `);

        const students = queryResult.rows;

        // Helper function to format currency
        const formatCurrency = (amount) => new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';

        // Generate the HTML content for the PDF
        const fileNameDate = new Date().toISOString().slice(0, 10).replace(/-/g, '_'); // FIXED: Safe date format for filename
        const displayDate = new Date().toLocaleDateString('ar-EG'); // Date for display inside PDF
        const reportTitle = "كشف بأسماء الطلاب غير المسددين والمبالغ المتبقية";
        let tableRows = '';
        students.forEach(student => {
            tableRows += `
                <tr>
                    <td>${student.student_name}</td>
                    <td>${student.class_name}</td>
                    <td class="amount">${formatCurrency(student.remaining_balance)}</td>
                    <td class="count">${student.unpaid_installments_count}</td>
                </tr>
            `;
        });



        const htmlContent = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${reportTitle}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                    body { font-family: 'Cairo', sans-serif; direction: rtl; }
                    .container { padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
                    h1 { color: #0056b3; margin: 0; }
                    p { color: #666; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                    thead { background-color: #0056b3; color: white; }
                    tbody tr:nth-child(even) { background-color: #f2f2f2; }
                    .amount { font-weight: bold; color: #dc3545; }
                    .count { text-align: center; }
                    .footer { text-align: left; margin-top: 30px; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${reportTitle}</h1>
                        <p>تاريخ التقرير: ${displayDate}</p>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>اسم الطالب</th>
                                <th>الصف</th>
                                <th>المبلغ المتبقي</th>
                                <th>عدد الأقساط غير المسددة</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    <div class="footer">
                        <p>تم إعداد هذا التقرير في ${displayDate}.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        // Generate PDF from the HTML
        const pdfBuffer = await generatePdfFromHtml(htmlContent, reportTitle);

        // Send the PDF as a response
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="unpaid_students_summary_${fileNameDate}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating unpaid summary report:', error);
        res.status(500).json({ error: 'فشل في توليد تقرير الطلاب غير المسددين.' });
    }
});

// API Endpoint 2: Report of unpaid students with due dates
app.get('/api/financial-reports/unpaid-due-dates', async (req, res) => {
    try {
        const queryResult = await pool.query(`
            SELECT
                s.name AS student_name,
                cls.name as class_name,
                si.due_date,
                si.amount_due,
                si.status
            FROM students s
            JOIN student_payment_plans spp ON s.id = spp.student_id
            JOIN student_installments si ON spp.id = si.payment_plan_id
            JOIN divisions div ON s.division_id = div.id
            JOIN classes cls ON div.class_id = cls.id
            WHERE si.status IN ('pending', 'partially_paid', 'overdue')
            ORDER BY s.name, si.due_date;
        `);
        
        // Group installments by student
        const studentsData = queryResult.rows.reduce((acc, row) => {
            if (!acc[row.student_name]) {
                acc[row.student_name] = { name: row.student_name, className: row.class_name, installments: [] };
            }
            acc[row.student_name].installments.push({
                due_date: new Date(row.due_date).toLocaleDateString('ar-EG'),
                amount_due: row.amount_due,
                status: row.status
            });
            return acc;
        }, {});
        
        // Helper function to format currency
        const formatCurrency = (amount) => new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';

        // Generate HTML content
        const fileNameDate = new Date().toISOString().slice(0, 10).replace(/-/g, '_'); // FIXED: Safe date format for filename
        const displayDate = new Date().toLocaleDateString('ar-EG'); // Date for display inside PDF
        const reportTitle = "كشف تواريخ استحقاق الطلاب غير المسددين";
        let studentSections = '';

        for (const studentName in studentsData) {
            const student = studentsData[studentName];
            let installmentRows = '';
            student.installments.forEach(inst => {
                installmentRows += `
                    <tr>
                        <td>${inst.due_date}</td>
                        <td class="amount">${formatCurrency(inst.amount_due)}</td>
                        <td>${inst.status === 'overdue' ? 'متأخر' : 'قيد الانتظار'}</td>
                    </tr>
                `;
            });
            
            studentSections += `
                <div class="student-section">
                    <h2>${student.name} - <span>${student.className}</span></h2>
                    <table>
                        <thead>
                            <tr>
                                <th>تاريخ الاستحقاق</th>
                                <th>المبلغ المستحق</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>${installmentRows}</tbody>
                    </table>
                </div>
            `;
        }

        const htmlContent = `
             <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${reportTitle}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                    body { font-family: 'Cairo', sans-serif; direction: rtl; }
                    .container { padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
                    h1 { color: #0056b3; margin: 0; }
                    p { color: #666; }
                    .student-section { margin-bottom: 30px; page-break-inside: avoid; }
                    .student-section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    .student-section h2 span { font-size: 0.8em; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                    thead { background-color: #5a6268; color: white; }
                    tbody tr:nth-child(even) { background-color: #f2f2f2; }
                    .amount { font-weight: bold; }
                    .footer { text-align: left; margin-top: 30px; font-size: 12px; color: #777; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${reportTitle}</h1>
                        <p>تاريخ التقرير: ${displayDate}</p>
                    </div>
                    ${studentSections}
                    <div class="footer">
                        <p>SM System</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const pdfBuffer = await generatePdfFromHtml(htmlContent, reportTitle);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="unpaid_due_dates_${fileNameDate}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating due dates report:', error);
        res.status(500).json({ error: 'فشل في توليد تقرير تواريخ الاستحقاق.' });
    }
});





// ✅✅✅ NEW API ENDPOINT FOR OVERDUE PAYMENTS ✅✅✅
app.get('/api/financial-reports/overdue-payments', async (req, res) => {
    try {
        const queryResult = await pool.query(`
            SELECT
                s.name AS student_name,
                cls.name as class_name,
                SUM(si.amount_due - si.amount_paid) AS overdue_balance
            FROM students s
            JOIN student_payment_plans spp ON s.id = spp.student_id
            JOIN student_installments si ON spp.id = si.payment_plan_id
            JOIN divisions div ON s.division_id = div.id
            JOIN classes cls ON div.class_id = cls.id
            WHERE 
                si.due_date < CURRENT_DATE 
            AND 
                si.status NOT IN ('paid', 'waived')
            GROUP BY s.id, cls.name
            HAVING SUM(si.amount_due - si.amount_paid) > 0.01
            ORDER BY cls.name, s.name;
        `);

        const students = queryResult.rows;
        const formatCurrency = (amount) => new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
        const fileNameDate = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const displayDate = new Date().toLocaleDateString('ar-EG');
        const reportTitle = "كشف بالطلاب المتأخرين والمبالغ المستحقة حالياً";
        
        let tableRows = '';
        students.forEach(student => {
            tableRows += `
                <tr>
                    <td>${student.student_name}</td>
                    <td>${student.class_name}</td>
                    <td class="amount">${formatCurrency(student.overdue_balance)}</td>
                </tr>
            `;
        });

        const htmlContent = `
            <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${reportTitle}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
                body { font-family: 'Cairo', sans-serif; direction: rtl; } .container { padding: 20px; }
                .header { text-align: center; border-bottom: 2px solid #0056b3; padding-bottom: 10px; margin-bottom: 20px; }
                h1 { color: #0056b3; margin: 0; } p { color: #666; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                thead { background-color: #ffc107; color: #212529; }
                tbody tr:nth-child(even) { background-color: #f2f2f2; }
                .amount { font-weight: bold; color: #dc3545; }
                .footer { text-align: left; margin-top: 30px; font-size: 12px; color: #777; }
            </style></head><body><div class="container"><div class="header"><h1>${reportTitle}</h1>
            <p>تاريخ التقرير: ${displayDate}</p></div><table><thead><tr><th>اسم الطالب</th><th>الصف</th>
            <th>المبلغ المستحق حالياً</th></tr></thead><tbody>${tableRows}</tbody></table>
            <div class="footer"><p>SM System</p></div></div></body></html>`;

        const pdfBuffer = await generatePdfFromHtml(htmlContent, reportTitle);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="overdue_payments_${fileNameDate}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating overdue payments report:', error);
        res.status(500).json({ error: 'فشل في توليد تقرير الطلاب المتأخرين.' });
    }
});



async function generateCertificateDocx(data) {
    const docChildren = [];

    const titleTextStyle = { size: 36, font: "Amiri", bold: true }; // 18pt
    const bodyTextStyle = { size: 28, font: "Amiri" }; // 14pt
    const smallTextStyle = { size: 20, font: "Amiri" };

    // 🔲 سطر: إدارة (يسار)
    docChildren.push(new Paragraph({
        children: [
            new TextRun({ text: "إدارة", bold: true, size: 24 }),
        ],
        alignment: AlignmentType.LEFT,
        bidirectional: true,
        spacing: { after: 0 }
    }));

    // 🔲 سطر: العدد (يمين، مثبت بخط عريض)
    docChildren.push(new Paragraph({
        children: [
            new TextRun({ text: "العدد: " + (data.certificate_number_arabic || "_____"), bold: true, size: 24 }),
        ],
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 100 }
    }));

    // 🔲 سطر: اسم المدرسة (يسار)
    docChildren.push(new Paragraph({
        children: [
            new TextRun({ text: data.school_name || "اسم المدرسة", bold: true, size: 24 }),
        ],
        alignment: AlignmentType.LEFT,
        bidirectional: true,
        spacing: { after: 0 }
    }));

    // 🔲 سطر: التاريخ (يمين، مثبت بخط عريض)
    docChildren.push(new Paragraph({
        children: [
            new TextRun({ text: "التاريخ: " + ((data.issue_date_arabic || "____-__-__").replace(/-/g, "/")), bold: true, size: 24 }),
        ],
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        spacing: { after: 300 }
    }));

    // ----------------- الى /
    docChildren.push(new Paragraph({
        children: [
            new TextRun({ text: "الى / ", bold: true, size: 36, font: "Amiri" }),
            new TextRun({ text: data.recipient || "الجهة المعنية", bold: true, size: 36, font: "Amiri" }),
        ],
        alignment: AlignmentType.CENTER,
        bidirectional: true
    }));

    docChildren.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ----------------- العنوان
    docChildren.push(new Paragraph({
        text: "م/ تأييد استمرارية طالب",
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        style: "mainStyle"
    }));

    docChildren.push(new Paragraph({ text: "", spacing: { after: 300 } }));

    // ----------------- التحية
    docChildren.push(new Paragraph({
        text: "تحية طيبة ....",
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        style: "bodyStyle"
    }));

    docChildren.push(new Paragraph({ text: "", spacing: { after: 200 } }));

    // ----------------- الفقرة الرئيسية (تم تعديل العام الدراسي لكي يظهر بين قوسين)
    docChildren.push(new Paragraph({
        children: [
            new TextRun("نؤيد لكم بأن الطالب "),
            new TextRun({ text: ")" + (data.student_name || "اسم الطالب") + "(", bold: true }),
            new TextRun(" في الصف "),
            new TextRun({
                text: ")" + (data.student_class || "الصف") + "(",
                bold: true
            }),
            new TextRun(" مستمر بالدوام في مدرستنا للعام الدراسي "),
            // تم تعديل هذا السطر لوضع العام الدراسي بين قوسين
            new TextRun({ text: "(" + (data.academic_year || "العام الدراسي") + ")", bold: true }),
        ],
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        style: "bodyStyle"
    }));

    docChildren.push(new Paragraph({
        text: "وبناءاً على طلبه زود بهذا التأييد .",
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        style: "bodyStyle"
    }));

    docChildren.push(new Paragraph({ text: "", spacing: { after: 400 } }));

    // ----------------- الختام
    docChildren.push(new Paragraph({
        text: "للعلم مع التقدير .",
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        style: "bodyStyle"
    }));

    // ----------------- التوقيع
    docChildren.push(new Paragraph({
        text: "المدير",
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        style: "mainStyle",
        indent: { right: 720 },
        spacing: { before: 5000 }
    }));

    // سطر جديد لاسم المدير
    docChildren.push(new Paragraph({
        text: data.director_full_name || "المدير العام",
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        style: "bodyStyle",
        indent: { right: 720 }
    }));

    // ----------------- إنشاء الوثيقة
    const doc = new Document({
        styles: {
            paragraphStyles: [
                { id: "mainStyle", name: "Main Style", run: titleTextStyle, paragraph: { rightToLeft: true } },
                { id: "bodyStyle", name: "Body Style", run: bodyTextStyle, paragraph: { rightToLeft: true } },
                { id: "smallStyle", name: "Small Style", run: smallTextStyle, paragraph: { rightToLeft: true } },
            ]
        },
        sections: [{
            properties: {
                page: {
                    size: { orientation: 'portrait' },
                    margin: { top: 720, right: 720, bottom: 720, left: 720 },
                },
                rightToLeft: true
            },
            children: docChildren
        }]
    });

    return await Packer.toBuffer(doc);
}


async function generatePdf(htmlContent, headerText = '') {
    let browser = null;
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            headerTemplate: `<div style="font-size: 10px; text-align: center; width: 100%; padding: 10px;">${headerText}</div>`,
            footerTemplate: '<div style="font-size: 10px; text-align: center; width: 100%; padding: 10px;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
            margin: {
                top: '50px',
                bottom: '50px',
                right: '20px',
                left: '20px'
            }
        });

        return pdfBuffer;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}


// API: تحديث الرواتب الأساسية لمجموعة من المدرسين
app.post('/api/salaries/batch-update', async (req, res) => {
    const { salaries } = req.body; // expecting an array of { teacher_id, base_salary }
    if (!salaries || !Array.isArray(salaries)) {
        return res.status(400).json({ error: 'البيانات غير صحيحة' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const salaryInfo of salaries) {
            await client.query(
                'UPDATE teachers SET base_salary = $1 WHERE id = $2',
                [salaryInfo.base_salary, salaryInfo.teacher_id]
            );
        }
        await client.query('COMMIT');
        res.json({ message: 'تم تحديث الرواتب بنجاح' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error in batch salary update:', err.message);
        res.status(500).json({ error: 'فشل في تحديث الرواتب' });
    } finally {
        client.release();
    }
});

// API: جلب عدد غيابات المدرس للشهر الحالي
app.get('/api/teachers/:id/absences-count', async (req, res) => {
    const { id } = req.params;
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    try {
        const result = await pool.query(
            `SELECT COUNT(*) FROM teacher_attendance 
             WHERE teacher_id = $1 AND status = 'غياب' 
             AND attendance_date BETWEEN $2 AND $3`,
            [id, firstDay, lastDay]
        );
        res.json({ absences_count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        console.error('Error fetching absences count:', err.message);
        res.status(500).json({ error: 'فشل في جلب عدد الغيابات' });
    }
});

// API: صرف راتب لمدرس وتوليد وصل PDF
app.post('/api/salaries/pay', async (req, res) => {
    const { teacher_id, deduction_per_day } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. جلب بيانات المدرس والراتب
        const teacherRes = await client.query('SELECT name, base_salary FROM teachers WHERE id = $1', [teacher_id]);
        if (teacherRes.rows.length === 0) {
            throw new Error('لم يتم العثور على المدرس');
        }
        const teacher = teacherRes.rows[0];
        const baseSalary = parseFloat(teacher.base_salary || 0);

        // 2. حساب الغيابات والخصم
        const today = new Date();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        const firstDay = new Date(year, today.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(year, today.getMonth() + 1, 0).toISOString().split('T')[0];

        const absencesRes = await client.query(
            `SELECT COUNT(*) FROM teacher_attendance WHERE teacher_id = $1 AND status = 'غياب' AND attendance_date BETWEEN $2 AND $3`,
            [teacher_id, firstDay, lastDay]
        );
        const absencesCount = parseInt(absencesRes.rows[0].count, 10);
        const totalDeduction = absencesCount * parseFloat(deduction_per_day);
        const finalAmountPaid = baseSalary - totalDeduction;

        // 3. التحقق مما إذا تم صرف راتب لهذا الشهر بالفعل
        const existingPayment = await client.query(
            'SELECT id FROM teacher_salaries WHERE teacher_id = $1 AND month = $2 AND year = $3',
            [teacher_id, month, year]
        );
        if (existingPayment.rows.length > 0) {
            throw new Error('تم صرف راتب لهذا المدرس بالفعل في هذا الشهر.');
        }

        // 4. حفظ سجل الدفع في قاعدة البيانات
        const receiptNumber = `PAY-${year}${month}-${teacher_id}-${Date.now()}`;
        const paymentDate = today.toISOString().split('T')[0];

        await client.query(
            `INSERT INTO teacher_salaries (teacher_id, payment_date, month, year, base_salary, absences_count, deduction_amount, final_amount_paid, receipt_number)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [teacher_id, paymentDate, month, year, baseSalary, absencesCount, totalDeduction, finalAmountPaid, receiptNumber]
        );

        // 5. توليد وصل PDF
        const htmlContent = `
            <html>
            <body style="font-family: 'Cairo', sans-serif; direction: rtl; text-align: right; padding: 20px;">
                <div style="border: 2px solid #333; padding: 20px; max-width: 800px; margin: auto;">
                    <h1 style="text-align: center; color: #333;">وصل استلام راتب</h1>
                    <p><strong>رقم الوصل:</strong> ${receiptNumber}</p>
                    <p><strong>التاريخ:</strong> ${today.toLocaleDateString('ar-IQ')}</p>
                    <hr>
                    <p><strong>اسم المدرس:</strong> ${teacher.name}</p>
                    <p><strong>الراتب لشهر:</strong> ${month}/${year}</p>
                    <hr>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px;">الراتب الأساسي</td><td style="padding: 8px;">${baseSalary.toLocaleString()} د.ع</td></tr>
                        <tr><td style="padding: 8px;">عدد الغيابات</td><td style="padding: 8px;">${absencesCount}</td></tr>
                        <tr><td style="padding: 8px;">إجمالي الخصم</td><td style="padding: 8px; color: red;">${totalDeduction.toLocaleString()} د.ع</td></tr>
                        <tr style="font-weight: bold; font-size: 1.2em;"><td style="padding: 8px;">المبلغ الصافي المستلم</td><td style="padding: 8px;">${finalAmountPaid.toLocaleString()} د.ع</td></tr>
                    </table>
                    <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                        <div>
                            <p><strong>توقيع المستلم:</strong></p>
                            <p>___________________</p>
                        </div>
                        <div>
                            <p><strong>توقيع المحاسب:</strong></p>
                            <p>___________________</p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const pdfBuffer = await generatePdf(htmlContent, `وصل راتب - ${teacher.name}`);
        
        await client.query('COMMIT');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="receipt_${receiptNumber}.pdf"`);
        res.setHeader('X-Receipt-Number', receiptNumber);
        res.send(pdfBuffer);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error paying salary:', err.message);
        res.status(500).json({ error: err.message || 'فشل في عملية صرف الراتب' });
    } finally {
        client.release();
    }
});


// API: توليد تقرير إجمالي PDF
app.get('/api/salaries/report/overall', async (req, res) => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // جلب جميع الرواتب المصروفة لهذا الشهر
        const paymentsRes = await client.query(
            `SELECT ts.*, t.name as teacher_name FROM teacher_salaries ts
             JOIN teachers t ON ts.teacher_id = t.id
             WHERE ts.month = $1 AND ts.year = $2`,
            [month, year]
        );
        const payments = paymentsRes.rows;

        if (payments.length === 0) {
            throw new Error('لا توجد رواتب مصروفة لهذا الشهر لتوليد تقرير.');
        }

        let totalPaid = 0;
        let totalDeductions = 0;
        let tableRows = '';

        payments.forEach(p => {
            const finalAmount = parseFloat(p.final_amount_paid);
            const deductionAmount = parseFloat(p.deduction_amount);
            totalPaid += finalAmount;
            totalDeductions += deductionAmount;
            tableRows += `
                <tr>
                    <td>${p.teacher_name}</td>
                    <td>${parseFloat(p.base_salary).toLocaleString()}</td>
                    <td>${p.absences_count}</td>
                    <td style="color: red;">${deductionAmount.toLocaleString()}</td>
                    <td style="font-weight: bold;">${finalAmount.toLocaleString()}</td>
                </tr>
            `;
        });
        
        const reportNumber = `REP-${year}${month}-${Date.now()}`;
        const reportDate = today.toISOString().split('T')[0];

        // حفظ التقرير في قاعدة البيانات
        await client.query(
            `INSERT INTO teacher_salary_reports (report_date, month, year, total_paid, total_deductions, teacher_count, report_number, report_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [reportDate, month, year, totalPaid, totalDeductions, payments.length, reportNumber, JSON.stringify(payments)]
        );

        // توليد PDF
        const htmlContent = `
            <html>
            <body style="font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px;">
                <h1 style="text-align: center;">التقرير المالي لرواتب المدرسين</h1>
                <h2 style="text-align: center;">لشهر ${month}/${year}</h2>
                <p><strong>رقم التقرير:</strong> ${reportNumber}</p>
                <p><strong>تاريخ التقرير:</strong> ${today.toLocaleDateString('ar-IQ')}</p>
                <hr>
                <table style="width: 100%; border-collapse: collapse; text-align: right;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 8px; border: 1px solid #ddd;">اسم المدرس</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">الراتب الأساسي (د.ع)</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">غيابات</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">الخصم (د.ع)</th>
                            <th style="padding: 8px; border: 1px solid #ddd;">الصافي (د.ع)</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                    <tfoot>
                        <tr style="font-weight: bold; font-size: 1.2em; background-color: #e9e9e9;">
                            <td colspan="3" style="padding: 8px; border: 1px solid #ddd;">الإجمالي</td>
                            <td style="padding: 8px; border: 1px solid #ddd; color: red;">${totalDeductions.toLocaleString()} د.ع</td>
                            <td style="padding: 8px; border: 1px solid #ddd;">${totalPaid.toLocaleString()} د.ع</td>
                        </tr>
                    </tfoot>
                </table>
            </body>
            </html>
        `;

        const pdfBuffer = await generatePdf(htmlContent, `التقرير المالي - ${month}/${year}`);
        
        await client.query('COMMIT');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="overall_report_${reportNumber}.pdf"`);
        res.setHeader('X-Report-Number', reportNumber);
        res.send(pdfBuffer);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error generating overall report:', err.message);
        res.status(500).json({ error: err.message || 'فشل في توليد التقرير' });
    } finally {
        client.release();
    }
});

app.get('/api/search-grades', async (req, res) => {
    const { query, schoolId, classId, divisionId, term } = req.query;

    if (!query || !schoolId || !classId || !divisionId || !term) {
        return res.status(400).json({ error: 'All filter parameters and a search query are required.' });
    }

    const client = await pool.connect();
    try {
        // Step 1: Find the student that matches all criteria.
        // الخطوة ١: البحث عن الطالب الذي يطابق جميع المعايير المحددة
        const studentRes = await client.query(
            `SELECT s.id, s.name FROM students s
             JOIN divisions d ON s.division_id = d.id
             JOIN classes c ON d.class_id = c.id
             WHERE (s.name ILIKE $1 OR s.barcode = $2)
             AND s.division_id = $3
             AND c.id = $4
             AND c.school_id = $5
             LIMIT 1`,
            [`%${query}%`, query, divisionId, classId, schoolId]
        );

        if (studentRes.rows.length === 0) {
            // If student not found, return a success response with an empty array.
            // The frontend will handle this by showing a "not found" message.
            // في حال عدم العثور على الطالب، يتم إرجاع استجابة ناجحة مع مصفوفة فارغة
            // وستقوم الواجهة الأمامية بعرض رسالة تفيد بعدم العثور على الطالب
            return res.json([]);
        }

        const student = studentRes.rows[0];
        const studentId = student.id;
        const studentName = student.name;

        // Step 2: Get all subjects assigned to the student's class.
        // الخطوة ٢: جلب جميع المواد المخصصة لصف الطالب
        const classSubjectsRes = await client.query(
            'SELECT subject FROM class_subjects WHERE class_id = $1 ORDER BY subject',
            [classId]
        );
        const subjectsForClass = classSubjectsRes.rows.map(r => r.subject);

        if (subjectsForClass.length === 0) {
            // If the class has no subjects assigned, return an empty array.
            // إذا لم يكن للصف أي مواد مخصصة، أرجع مصفوفة فارغة
            return res.json([]);
        }

        // Step 3: Get all existing grades for this student for the given term.
        // الخطوة ٣: جلب كل الدرجات الموجودة للطالب في الفصل الدراسي المحدد
        const studentGradesRes = await client.query(
            `SELECT * FROM student_grades WHERE student_id = $1 AND term = $2`,
            [studentId, term]
        );

        // Map grades by subject name for easy lookup.
        // تخزين الدرجات في خريطة (Map) حسب اسم المادة لتسهيل الوصول إليها
        const gradesMap = new Map();
        studentGradesRes.rows.forEach(grade => {
            gradesMap.set(grade.subject.trim(), grade);
        });

        // Step 4: Combine the subjects with the grades.
        // For each subject the student is supposed to have, create a grade record.
        // If a grade record already exists, use it. Otherwise, create a placeholder.
        // الخطوة ٤: دمج قائمة المواد مع الدرجات الفعلية
        // لكل مادة يجب أن يدرسها الطالب، يتم إنشاء سجل درجة
        // إذا كان هناك سجل درجة موجود، يتم استخدامه. وإلا، يتم إنشاء سجل افتراضي فارغ
        const results = subjectsForClass.map(subjectName => {
            const existingGrade = gradesMap.get(subjectName.trim());

            if (existingGrade) {
                // Return the existing grade data
                // إرجاع بيانات الدرجة الموجودة
                return {
                    student_id: studentId,
                    student_name: studentName,
                    subject: subjectName,
                    month1_term1: existingGrade.month1_term1,
                    month2_term1: existingGrade.month2_term1,
                    mid_term: existingGrade.mid_term,
                    month1_term2: existingGrade.month1_term2,
                    month2_term2: existingGrade.month2_term2,
                    final_exam: existingGrade.final_exam,
                    makeup_exam: existingGrade.makeup_exam,
                };
            } else {
                // If no grade record exists for a subject, return a default record with nulls.
                // إذا لم يوجد سجل درجة لمادة معينة، يتم إرجاع سجل افتراضي بقيم فارغة
                return {
                    student_id: studentId,
                    student_name: studentName,
                    subject: subjectName,
                    month1_term1: null,
                    month2_term1: null,
                    mid_term: null,
                    month1_term2: null,
                    month2_term2: null,
                    final_exam: null,
                    makeup_exam: null,
                };
            }
        });

        res.json(results);

    } catch (err) {
        console.error('Error in /api/search-grades:', err.message, err.stack);
        res.status(500).json({ error: 'Server error while searching for grades.' });
    } finally {
        client.release();
    }
});

// API: البحث عن وصل (راتب أو تقرير)
app.get('/api/receipts/:receiptNumber', async (req, res) => {
    const { receiptNumber } = req.params;
    try {
        if (receiptNumber.startsWith('PAY-')) {
            const result = await pool.query(
                `SELECT ts.*, t.name as teacher_name FROM teacher_salaries ts
                 JOIN teachers t ON ts.teacher_id = t.id
                 WHERE ts.receipt_number = $1`,
                [receiptNumber]
            );
            if (result.rows.length === 0) throw new Error('لم يتم العثور على وصل الصرف.');
            res.json({ type: 'payment', ...result.rows[0] });
        } else if (receiptNumber.startsWith('REP-')) {
            const result = await pool.query(
                'SELECT * FROM teacher_salary_reports WHERE report_number = $1',
                [receiptNumber]
            );
            if (result.rows.length === 0) throw new Error('لم يتم العثور على وصل التقرير.');
            res.json({ type: 'report', ...result.rows[0] });
        } else {
            throw new Error('صيغة رقم الوصل غير صحيحة.');
        }
    } catch (err) {
        console.error('Error finding receipt:', err.message);
        res.status(404).json({ error: err.message });
    }
});
// ------------------------------------------------------------------
// --- END: تعديلات خاصة برواتب المدرسين ---
// ------------------------------------------------------------------


// --- 2. إضافة مسار جديد لتحديث محتوى المخاطبة ---
// أضف هذا المسار الجديد (API Endpoint) إلى ملف السيرفر الخاص بك
app.put('/api/outgoing/:id/content', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id; // معرّف المستخدم الحالي من التوكن

    if (!content) {
        return res.status(400).json({ error: 'المحتوى مطلوب.' });
    }

    try {
        const updateResult = await pool.query(
            `UPDATE outgoing 
             SET 
                content = $1, 
                updated_at = CURRENT_TIMESTAMP, 
                modified_by = $2,
                modification_notes = $3
             WHERE id = $4 
             RETURNING updated_at, modified_by, modification_notes`,
            [content, userId, `تم التعديل بتاريخ ${new Date().toLocaleDateString('ar-EG')}`, id]
        );

        if (updateResult.rows.length === 0) {
            return res.status(404).json({ error: 'لم يتم العثور على الكتاب.' });
        }
        
        // جلب اسم المستخدم الذي قام بالتعديل لإرجاعه للواجهة
        const userResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [userId]);
        const modified_by_name = userResult.rows[0]?.full_name || 'غير معروف';
        
        const responseData = {
            ...updateResult.rows[0],
            modified_by_name: modified_by_name
        };

        res.json({ message: 'تم تحديث المحتوى بنجاح.', data: responseData });

    } catch (error) {
        console.error("❌ Error updating letter content:", error);
        res.status(500).json({ error: 'فشل تحديث محتوى الكتاب: ' + error.message });
    }
});

app.post('/api/upload-logo', authMiddleware, uploadLogo.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'لم يتم رفع أي ملف.' });
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    try {
        // تحديث شعار المدرسة الأولى في النظام (يمكن تعديل هذا المنطق لاحقاً)
        await pool.query(
            `UPDATE schools SET logo_url = $1 WHERE id = (SELECT id FROM schools ORDER BY id LIMIT 1)`,
            [logoUrl]
        );
        res.json({ message: 'تم رفع الشعار بنجاح.', logo_url: logoUrl });
    } catch (error) {
        console.error("❌ Error saving logo URL:", error.message);
        res.status(500).json({ error: 'فشل حفظ مسار الشعار.' });
    }
});

// مسار جديد: جلب كل الإعدادات دفعة واحدة (الجهات، المواضيع، الشعار)
app.get('/api/letter-settings', authMiddleware, async (req, res) => {
    try {
        const recipientsRes = await pool.query('SELECT * FROM recipients ORDER BY name');
        const subjectsRes = await pool.query('SELECT * FROM letter_subjects ORDER BY name');
        const schoolRes = await pool.query('SELECT name, logo_url FROM schools ORDER BY id LIMIT 1');

        res.json({
            recipients: recipientsRes.rows,
            subjects: subjectsRes.rows,
            school: schoolRes.rows[0] || { name: 'اسم المدرسة', logo_url: null }
        });
    } catch (error) {
        console.error("❌ Error fetching letter settings:", error.message);
        res.status(500).json({ error: 'فشل جلب الإعدادات.' });
    }
});

// مسار جديد: إضافة جهة معنية جديدة
app.post('/api/recipients', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الجهة مطلوب.' });
    try {
        const result = await pool.query('INSERT INTO recipients (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *', [name]);
        if (result.rows.length === 0) {
           return res.status(409).json({ message: 'الجهة موجودة بالفعل.'});
        }
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// مسار جديد: إضافة موضوع جديد
app.post('/api/letter_subjects', authMiddleware, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم الموضوع مطلوب.' });
    try {
        const result = await pool.query('INSERT INTO letter_subjects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *', [name]);
         if (result.rows.length === 0) {
           return res.status(409).json({ message: 'الموضوع موجود بالفعل.'});
        }
        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

  // المسار الجديد للإرسال التلقائي
  app.post('/api/send-telegram-notifications-auto', async (req, res) => {
      const { date, school_id, class_id, division_id } = req.body;

      // 1. جلب بيانات الغياب
      let queryText = `
        SELECT 
          a.date, a.type AS absence_type, a.subject, a.lesson, a.notes AS absence_notes,
          s.id AS student_id, s.name AS student_name, s.parent_phone, s.gender, s.telegram_chat_id
        FROM absences a
        JOIN students s ON a.student_id = s.id
        JOIN divisions d ON s.division_id = d.id
        JOIN classes c ON d.class_id = c.id
        WHERE 1=1
      `;
      const queryParams = [];
      let paramIndex = 1;

      if (date) {
          const baseDate = new Date(date);
          const startDate = new Date(baseDate);
          startDate.setDate(baseDate.getDate() - baseDate.getDay());
          const endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);

          queryText += ` AND a.date::DATE BETWEEN $${paramIndex++} AND $${paramIndex++}`;
          queryParams.push(startDate.toISOString().split('T')[0]);
          queryParams.push(endDate.toISOString().split('T')[0]);
      }
      if (division_id) {
          queryText += ` AND s.division_id = $${paramIndex++}`;
          queryParams.push(division_id);
      } else if (class_id) {
          queryText += ` AND d.class_id = $${paramIndex++}`;
          queryParams.push(class_id);
      } else if (school_id) {
          queryText += ` AND c.school_id = $${paramIndex++}`;
          queryParams.push(school_id);
      }
      queryText += ` ORDER BY s.name, a.date;`;
      
      const allAbsences = (await pool.query(queryText, queryParams)).rows;
      const studentsGrouped = groupAbsencesForServer(allAbsences);

      // 2. إرسال الرسائل وتجميع التقرير
      const report = [];
      const sendPromises = studentsGrouped.map(async (student) => {
          // التحقق من وجود معرف تيليجرام
          if (!student.telegram_chat_id) {
              report.push({ studentName: student.name, status: 'فشل', reason: 'لا يوجد معرف تيليجرام لولي الأمر.' });
              return;
          }

          // تكوين الرسالة
          const childPronoun = student.gender?.toLowerCase().trim() === 'female' ? 'ابنتكم' : 'ابنكم';
          const studentPronoun = student.gender?.toLowerCase().trim() === 'female' ? 'الطالبة' : 'الطالب';
          const absenceSummary = student.absences.map(a => {
              let detail = `• ${a.type}`;
              if (a.type === 'درس' && (a.lesson || a.subject)) {
                  detail += ` (الحصة: ${a.lesson || 'غير محدد'} - مادة: ${a.subject || 'غير محدد'})`;
              }
              detail += ` بتاريخ ${new Date(a.date + 'T00:00:00').toLocaleDateString('ar-EG')}`;
              return detail;
          }).join('\n');

          let message = `السيد ولي أمر ${studentPronoun}: *${student.name}*\n\n`;
          message += `تحية طيبة وبعد،\nنود إعلامكم بتفاصيل غياب ${childPronoun} خلال هذا الأسبوع:\n\n`;
          message += `${absenceSummary}\n\n`;
          message += `نرجو متابعة الأمر، مع خالص الشكر والتقدير.\n*إدارة المدرسة*`;

          // إرسال الرسالة
          try {
              await axios.post(TELEGRAM_API_URL, {
                  chat_id: student.telegram_chat_id,
                  text: message,
                  parse_mode: 'Markdown'
              });
              report.push({ studentName: student.name, status: 'تم الإرسال', reason: 'نجح' });
          } catch (error) {
              const errorReason = error.response?.data?.description || error.message;
              report.push({ studentName: student.name, status: 'فشل', reason: `خطأ من تيليجرام: ${errorReason}` });
          }
      });

      await Promise.all(sendPromises);
      
      // 3. إرسال التقرير النهائي للواجهة الأمامية
      res.json({ message: "اكتملت عملية الإرسال.", report });
  });


app.post('/api/export-seating-chart-pdf', async (req, res) => {
    const { distribution, settings } = req.body;

    if (!distribution || !settings) {
        return res.status(400).json({ error: 'البيانات المطلوبة (distribution, settings) غير كاملة.' });
    }

    // Helper function to generate the complete HTML for the PDF
    const generatePdfHtml = (distribution, settings) => {
        let bodyContent = '';
        
        // Loop through each hall to generate its content block
        distribution.forEach(hall => {
            const schoolName = hall.areas[0]?.seating[0]?.school_name || "اسم المدرسة";
            let studentSequence = 1; // Exam number sequence resets for each hall
            
            // Generate the header for this specific hall
            const hallHeader = `
                <div class="header">
                    <div class="header-left">
                        <p>إدارة</p>
                        <p>${schoolName}</p>
                    </div>
                    <div class="header-center">
                        <h2>${settings.examTitle || "امتحانات"}</h2>
                        <p>العام الدراسي: ${settings.academicYear || '٢٠٢٤-٢٠٢٥'}</p>
                        <p>${settings.examPeriod || 'الدور الاول'}</p>
                    </div>
                    <div class="header-right">
                        <p>ختم الإدارة</p>
                    </div>
                </div>
            `;

            let areasHtml = '';
            // Loop through each area within the hall
            hall.areas.forEach(area => {
                const cols = area.columnsCount;
                if (cols === 0) return;

                const seating = area.seating;
                const numRows = Math.ceil(seating.length / cols);
                
                let tableRows = '';
                // Generate table rows with student cards
                for (let r = 0; r < numRows; r++) {
                    let rowCells = '';
                    for (let c = 0; c < cols; c++) {
                        const studentIndex = r * cols + c;
                        if (studentIndex < seating.length) {
                            const student = seating[studentIndex];
                            let cardContent = '';
                            if (settings.cardFields.name) cardContent += `<p><b>الاسم:</b> ${student.student_name}</p>`;
                            if (settings.cardFields.class) cardContent += `<p><b>الصف:</b> ${student.class_name} / ${student.division_name}</p>`;
                            if (settings.cardFields.spec) cardContent += `<p><b>الاختصاص:</b> ${settings.specializationText || ''}</p>`;
if (settings.cardFields.num) {
    const arabicExamNumber = (studentSequence++).toLocaleString('ar-EG');
    cardContent += `<p><b>الرقم الامتحاني:</b> ${arabicExamNumber}</p>`;
}                            
                            rowCells += `<td class="student-card">${cardContent}</td>`;
                        } else {
                            rowCells += `<td></td>`; // Empty cell
                        }
                    }
                    tableRows += `<tr>${rowCells}</tr>`;
                }

                // Wrap each area in a container that avoids page breaks inside it
                areasHtml += `
                    <div class="area-container">
                        <div class="area-title">
                            القاعة (${hall.hallName}) &ndash; المنطقة (${area.areaName.replace('المنطقة ', '')}) &ndash; عدد طلبة المنطقة (${area.totalStudentsInArea})
                        </div>
                        <table class="seating-table">
                            ${tableRows}
                        </table>
                    </div>
                `;
            });

            // Add the hall's header and all its areas to the main content
            bodyContent += `
                <div class="hall-block">
                    ${hallHeader}
                    ${areasHtml}
                </div>
            `;
        });

        // Return the final HTML structure with updated styles
        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>خرائط الجلوس</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                    
                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                        }
                        .hall-block {
                           page-break-before: auto;
                        }
                    }

                    body {
                        font-family: 'Cairo', sans-serif;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        -webkit-print-color-adjust: exact;
                    }

                    .hall-block {
                        padding: 0 10mm;
                    }
                    
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        text-align: center;
                        font-weight: bold;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                        margin-top: 25px;
                        margin-bottom: 20px;
                        page-break-after: avoid;
                    }
                    .header h2 { margin: 0; font-size: 18px; }
                    .header p { margin: 2px 0; font-size: 14px; }
                    .header-left, .header-right { flex: 1; }
                    .header-center { flex: 2; }
                    .header-left { text-align: right; }
                    .header-right { text-align: left; }

                    .area-container {
                        page-break-inside: avoid;
                        margin-bottom: 20px;
                    }

                    .area-title {
                        text-align: center;
                        font-weight: bold;
                        font-size: 16px;
                        margin-top: 15px;
                        margin-bottom: 10px;
                    }
                    .seating-table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }
                    /* --- START: Card Size Adjustments --- */
                    .seating-table td {
                        border: 1px solid #777;
                        vertical-align: top;
                        height: 65px; /* Reduced from 90px */
                        padding: 3px; /* Reduced from 5px */
                        word-wrap: break-word;
                    }
                    .student-card p {
                        margin: 2px 0; /* Reduced from 4px */
                        font-size: 10px; /* Reduced from 12px */
                        text-align: right;
                    }
                    /* --- END: Card Size Adjustments --- */
                    .student-card b {
                        font-weight: 700;
                    }
                </style>
            </head>
            <body>
                ${bodyContent}
            </body>
            </html>
        `;
    };

    try {
        const htmlContent = generatePdfHtml(distribution, settings);
        
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '1cm',
                right: '1cm',
                bottom: '1cm',
                left: '1cm'
            }
        });

        await browser.close();

        const fileName = `${encodeURIComponent(settings.examTitle || 'خرائط_الجلوس')}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("❌ فشل في تصدير خرائط الجلوس (PDF):", err.message, err.stack);
        if (!res.headersSent) {
            res.status(500).json({ error: 'فشل الخادم في توليد ملف PDF: ' + err.message });
        }
    }
});

app.listen(PORT, '0.0.0.0', () => { 
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    if (localIP !== 'localhost') {
      console.log(`   Or on your local network: http://${localIP}:${PORT}`);
    }
    console.log(`   Timestamp: ${new Date().toISOString()}`);
  });
