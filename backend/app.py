import os

import psycopg2
from psycopg2.extras import RealDictCursor

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv


# ============================================================
# KONFIGURASI
# ============================================================

load_dotenv()

FRONTEND_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        '..',
        'frontend'
    )
)

app = Flask(
    __name__,
    static_folder=FRONTEND_DIR,
    static_url_path=''
)

CORS(app)


# ============================================================
# DATABASE
# ============================================================

def conn():

    database_url = os.getenv('DATABASE_URL')

    if database_url:
        return psycopg2.connect(
            database_url,
            cursor_factory=RealDictCursor
        )

    return psycopg2.connect(
        host=os.getenv('DB_HOST', '127.0.0.1'),
        port=os.getenv('DB_PORT', '5432'),
        dbname=os.getenv(
            'DB_NAME',
            'kelompok_belajar_ut'
        ),
        user=os.getenv(
            'DB_USER',
            'postgres'
        ),
        password=os.getenv(
            'DB_PASSWORD',
            ''
        ),
        cursor_factory=RealDictCursor
    )


def query(
    sql,
    p=(),
    one=False,
    fetch=False,
    commit=False
):
    c = conn()

    try:
        x = c.cursor()

        x.execute(sql, p)

        if one:
            r = x.fetchone()
        elif fetch:
            r = x.fetchall()
        else:
            r = None

        if commit:
            c.commit()

        return r

    except Exception:
        c.rollback()
        raise

    finally:
        c.close()
        
# ============================================================
# NOTIFICATION HELPER
# ============================================================

def create_notification(
    user_id,
    title,
    message,
    related_user_id=None
):
    query(
        '''
        INSERT INTO notifications(
            user_id,
            title,
            message,
            related_user_id
        )
        VALUES(
            %s,
            %s,
            %s,
            %s
        )
        ''',
        (
            user_id,
            title,
            message,
            related_user_id
        ),
        commit=True
    )


# ============================================================
# AUTHENTICATION
# ============================================================

def current():
    """
    Mengambil user yang sedang login berdasarkan token.

    Pada versi MVP ini token berisi ID user.
    """

    authorization = request.headers.get(
        'Authorization',
        ''
    )

    if not authorization.startswith('Bearer '):
        return None

    token = authorization.replace(
        'Bearer ',
        '',
        1
    ).strip()

    try:
        user_id = int(token)
    except ValueError:
        return None

    if user_id <= 0:
        return None

    return query(
        '''
        SELECT *
        FROM users
        WHERE id=%s
        ''',
        (user_id,),
        one=True
    )


def public_user(user):
    """
    Menghapus password sebelum data user
    dikirim ke frontend.
    """

    if not user:
        return None

    user = dict(user)

    user.pop(
        'password_hash',
        None
    )

    return user


# ============================================================
# HALAMAN UTAMA
# ============================================================

@app.get('/')
def home():
    return send_from_directory(FRONTEND_DIR,'index.html')
    
@app.route('/dashboard.html')
def dashboard_page():
    return send_from_directory(FRONTEND_DIR, 'dashboard.html')


@app.route('/cari-teman.html')
def cari_teman_page():
    return send_from_directory(FRONTEND_DIR, 'cari-teman.html')


@app.route('/kelompok.html')
def kelompok_page():
    return send_from_directory(FRONTEND_DIR, 'kelompok.html')


@app.route('/mata-kuliah.html')
def mata_kuliah_page():
    return send_from_directory(FRONTEND_DIR, 'mata-kuliah.html')


@app.route('/profil.html')
def profil_page():
    return send_from_directory(FRONTEND_DIR, 'profil.html')


@app.route('/admin.html')
def admin_page():
    return send_from_directory(FRONTEND_DIR, 'admin.html')


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get('/api/health')
def health():

    try:

        query(
            'SELECT 1',
            one=True
        )

        return jsonify(
            ok=True,
            message='API dan database terhubung'
        )

    except Exception as e:

        return jsonify(
            ok=False,
            error=str(e)
        ), 500


# ============================================================
# REGISTER
# ============================================================

@app.post('/api/register')
def register():

    d = request.json or {}

    required = (
        'full_name',
        'email',
        'password',
        'program_study',
        'semester'
    )

    if any(
        not d.get(k)
        for k in required
    ):
        return jsonify(
            error='Data wajib belum lengkap'
        ), 400

    email = d['email'].strip().lower()

    try:

        r = query(
            '''
            INSERT INTO users(
                full_name,
                email,
                password_hash,
                nim,
                program_study,
                semester,
                domicile,
                upbjj,
                role
            )
            VALUES(
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'student'
            )
            RETURNING id
            ''',
            (
                d['full_name'].strip(),
                email,
                generate_password_hash(
                    d['password']
                ),
                d.get('nim', ''),
                d['program_study'],
                int(d['semester']),
                d.get('domicile', ''),
                d.get('upbjj', '')
            ),
            one=True,
            commit=True
        )

        return jsonify(
            message='Registrasi berhasil',
            user_id=r['id']
        )

    except psycopg2.errors.UniqueViolation:

        return jsonify(
            error='Email sudah terdaftar'
        ), 409

    except Exception as e:

        return jsonify(
            error=str(e)
        ), 500


# ============================================================
# LOGIN
# ============================================================

@app.post('/api/login')
def login():

    d = request.json or {}

    email = d.get(
        'email',
        ''
    ).strip().lower()

    password = d.get(
        'password',
        ''
    )

    user = query(
        '''
        SELECT *
        FROM users
        WHERE email=%s
        ''',
        (email,),
        one=True
    )

    if (
        not user
        or not check_password_hash(
            user['password_hash'],
            password
        )
    ):
        return jsonify(
            error='Email atau password salah'
        ), 401

    user = public_user(user)

    return jsonify(
        token=str(user['id']),
        user=user
    )


# ============================================================
# PROFIL SAYA
# ============================================================

@app.get('/api/me')
def me():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    user = public_user(user)

    user['courses'] = query(
        '''
        SELECT c.*
        FROM courses c
        JOIN user_courses uc
            ON uc.course_id=c.id
        WHERE uc.user_id=%s
        ORDER BY c.code
        ''',
        (user['id'],),
        fetch=True
    )

    return jsonify(
        user=user
    )


@app.put('/api/me')
def update_me():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    d = request.json or {}

    try:

        semester = int(
            d.get('semester', 1)
        )

    except ValueError:

        return jsonify(
            error='Semester tidak valid'
        ), 400

    query(
        '''
        UPDATE users
        SET
            full_name=%s,
            nim=%s,
            program_study=%s,
            semester=%s,
            domicile=%s,
            upbjj=%s,
            study_method=%s,
            study_time=%s,
            bio=%s,
            whatsapp=%s,
            whatsapp_consent=%s
        WHERE id=%s
        ''',
        (
            d.get(
                'full_name',
                ''
            ),
            d.get(
                'nim',
                ''
            ),
            d.get(
                'program_study',
                ''
            ),
            semester,
            d.get(
                'domicile',
                ''
            ),
            d.get(
                'upbjj',
                ''
            ),
            d.get(
                'study_method',
                'Online'
            ),
            d.get(
                'study_time',
                '18:00-21:00'
            ),
            d.get(
                'bio',
                ''
            ),
            d.get(
                'whatsapp',
                ''
            ),
            bool(
                d.get(
                    'whatsapp_consent'
                )
            ),
            user['id']
        ),
        commit=True
    )

    return jsonify(
        message='Profil diperbarui'
    )
    
# ============================================================
# DAFTAR DOMISILI
# ============================================================

@app.get('/api/domiciles')
def domiciles():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    return jsonify(
        domiciles=query(
            '''
            SELECT DISTINCT
                TRIM(domicile) AS domicile
            FROM users
            WHERE
                domicile IS NOT NULL
                AND TRIM(domicile) <> ''
            ORDER BY
                TRIM(domicile)
            ''',
            fetch=True
        )
    )


# ============================================================
# SEMUA MATA KULIAH
# ============================================================

@app.get('/api/courses')
def courses():

    return jsonify(
        courses=query(
            '''
            SELECT *
            FROM courses
            ORDER BY code
            ''',
            fetch=True
        )
    )


# ============================================================
# MATA KULIAH SAYA
# ============================================================

@app.post('/api/my-courses')
def add_course():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    d = request.json or {}

    course_id = d.get(
        'course_id'
    )

    if not course_id:
        return jsonify(
            error='course_id wajib diisi'
        ), 400

    # Pastikan mata kuliah ada
    course = query(
        '''
        SELECT id
        FROM courses
        WHERE id=%s
        ''',
        (course_id,),
        one=True
    )

    if not course:
        return jsonify(
            error='Mata kuliah tidak ditemukan'
        ), 404

    query(
        '''
        INSERT INTO user_courses(
            user_id,
            course_id
        )
        VALUES(%s,%s)
        ON CONFLICT DO NOTHING
        ''',
        (
            user['id'],
            course_id
        ),
        commit=True
    )

    return jsonify(
        message='Mata kuliah ditambahkan'
    )


@app.get('/api/my-courses')
def my_courses():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    return jsonify(
        courses=query(
            '''
            SELECT c.*
            FROM courses c
            JOIN user_courses uc
                ON uc.course_id=c.id
            WHERE uc.user_id=%s
            ORDER BY c.code
            ''',
            (user['id'],),
            fetch=True
        )
    )


@app.delete('/api/my-courses/<int:cid>')
def del_course(cid):

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    query(
        '''
        DELETE FROM user_courses
        WHERE user_id=%s
        AND course_id=%s
        ''',
        (
            user['id'],
            cid
        ),
        commit=True
    )

    return jsonify(
        message='Mata kuliah dihapus'
    )


# ============================================================
# CARI TEMAN BELAJAR
# ============================================================

@app.get('/api/partners')
def partners():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    filters = {
        key: request.args.get(
            key,
            ''
        ).strip()
        for key in (
            'course',
            'program',
            'semester',
            'method',
            'time',
            'domicile'
        )
    }

    sql = '''
        SELECT
            u.id,
            u.full_name,
            u.program_study,
            u.semester,
            u.domicile,
            u.upbjj,
            u.study_method,
            u.study_time,
            u.bio,

            COALESCE(
                string_agg(
                    DISTINCT c.name,
                    ', '
                ),
                ''
            ) AS courses,

            COALESCE(
                cr.status,
                'none'
            ) AS connection_status

        FROM users u

        LEFT JOIN user_courses uc
            ON uc.user_id = u.id

        LEFT JOIN courses c
            ON c.id = uc.course_id

        LEFT JOIN connection_requests cr
            ON (
                cr.sender_id = %s
                AND cr.receiver_id = u.id
            )
            OR (
                cr.sender_id = u.id
                AND cr.receiver_id = %s
            )

        WHERE u.id <> %s
    '''

    params = [
        user['id'],
        user['id'],
        user['id']
    ]

    # Filter mata kuliah
    if filters['course']:

        sql += '''
            AND EXISTS(
                SELECT 1
                FROM user_courses ux
                JOIN courses cx
                    ON cx.id = ux.course_id
                WHERE ux.user_id = u.id
                AND (
                    cx.name ILIKE %s
                    OR cx.code ILIKE %s
                )
            )
        '''

        params.extend([
            f"%{filters['course']}%",
            f"%{filters['course']}%"
        ])

    # Filter program studi
    if filters['program']:

        sql += '''
            AND u.program_study ILIKE %s
        '''

        params.append(
            f"%{filters['program']}%"
        )

    # Filter semester
    if filters['semester']:

        try:

            semester = int(
                filters['semester']
            )

            sql += '''
                AND u.semester = %s
            '''

            params.append(
                semester
            )

        except ValueError:

            return jsonify(
                error='Semester tidak valid'
            ), 400

    # Filter metode belajar
    if filters['method']:

        sql += '''
            AND u.study_method = %s
        '''

        params.append(
            filters['method']
        )

    # Filter waktu belajar
    if filters['time']:

        sql += '''
            AND u.study_time ILIKE %s
        '''

        params.append(
            f"%{filters['time']}%"
        )

    # Filter domisili
    if filters['domicile']:

        sql += '''
            AND u.domicile ILIKE %s
        '''

        params.append(
            f"%{filters['domicile']}%"
        )

    sql += '''
        GROUP BY
            u.id,
            cr.status

        ORDER BY
            u.created_at DESC
    '''

    return jsonify(
        partners=query(
            sql,
            params,
            fetch=True
        )
    )
    
    # ============================================================
# CHAT
# ============================================================

def are_connected(user_a, user_b):

    connection = query(
        '''
        SELECT id
        FROM connection_requests
        WHERE
            status='accepted'
            AND
            (
                (
                    sender_id=%s
                    AND receiver_id=%s
                )
                OR
                (
                    sender_id=%s
                    AND receiver_id=%s
                )
            )
        LIMIT 1
        ''',
        (
            user_a,
            user_b,
            user_b,
            user_a
        ),
        one=True
    )

    return bool(connection)


# ============================================================
# DAFTAR PESAN
# ============================================================

@app.get('/api/messages/<int:user_id>')
def get_messages(user_id):

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    # Tidak boleh chat dengan diri sendiri
    if user_id == user['id']:
        return jsonify(
            error='Tidak dapat membuka chat dengan diri sendiri'
        ), 400

    # Harus sudah terhubung
    if not are_connected(
        user['id'],
        user_id
    ):
        return jsonify(
            error='Kamu hanya dapat mengobrol dengan mahasiswa yang sudah terhubung'
        ), 403

    messages = query(
        '''
        SELECT
    id,
    sender_id,
    receiver_id,
    message,
    is_read,
    TO_CHAR(
        created_at,
        'YYYY-MM-DD HH24:MI:SS'
    ) AS created_at
    FROM messages
        WHERE
            (
                sender_id=%s
                AND receiver_id=%s
            )
            OR
            (
                sender_id=%s
                AND receiver_id=%s
            )
        ORDER BY created_at ASC
        ''',
        (
            user['id'],
            user_id,
            user_id,
            user['id']
        ),
        fetch=True
    )

    return jsonify(
        messages=messages
    )


# ============================================================
# KIRIM PESAN
# ============================================================

@app.post('/api/messages')
def send_message():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    data = request.json or {}

    receiver_id = data.get(
        'receiver_id'
    )

    message = str(
        data.get(
            'message',
            ''
        )
    ).strip()

    if not receiver_id:
        return jsonify(
            error='receiver_id wajib diisi'
        ), 400

    if not message:
        return jsonify(
            error='Pesan tidak boleh kosong'
        ), 400

    try:

        receiver_id = int(
            receiver_id
        )

    except (
        TypeError,
        ValueError
    ):

        return jsonify(
            error='receiver_id tidak valid'
        ), 400

    # Tidak boleh mengirim ke diri sendiri
    if receiver_id == user['id']:
        return jsonify(
            error='Tidak dapat mengirim pesan kepada diri sendiri'
        ), 400

    # Pastikan penerima ada
    receiver = query(
        '''
        SELECT
            id,
            full_name
        FROM users
        WHERE id=%s
        ''',
        (
            receiver_id,
        ),
        one=True
    )

    if not receiver:
        return jsonify(
            error='Mahasiswa tidak ditemukan'
        ), 404

    # Harus sudah terhubung
    if not are_connected(
        user['id'],
        receiver_id
    ):
        return jsonify(
            error='Kamu hanya dapat mengirim pesan kepada mahasiswa yang sudah terhubung'
        ), 403

    new_message = query(
        '''
        INSERT INTO messages(
            sender_id,
            receiver_id,
            message
        )
        VALUES(
            %s,
            %s,
            %s
        )
        RETURNING
            id,
            sender_id,
            receiver_id,
            message,
            is_read,
            created_at
        ''',
        (
            user['id'],
            receiver_id,
            message
        ),
        one=True,
        commit=True
    )

    # Notifikasi pesan baru
    create_notification(
    receiver_id,
    'Pesan baru',
    (
        user['full_name']
        + ' mengirim pesan kepada kamu.'
    ),
    related_user_id=user['id']
)

    return jsonify(
        message=new_message
    ), 201


# ============================================================
# TANDAI PESAN SUDAH DIBACA
# ============================================================

@app.put('/api/messages/<int:user_id>/read')
def mark_messages_read(user_id):

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    if not are_connected(
        user['id'],
        user_id
    ):
        return jsonify(
            error='Kamu tidak memiliki akses ke percakapan ini'
        ), 403

    query(
        '''
        UPDATE messages
        SET is_read=TRUE
        WHERE
            sender_id=%s
            AND receiver_id=%s
            AND is_read=FALSE
        ''',
        (
            user_id,
            user['id']
        ),
        commit=True
    )

    return jsonify(
        message='Pesan ditandai sudah dibaca'
    )

# ============================================================
# PERMINTAAN KONEKSI
# ============================================================

@app.post('/api/connections')
def connect():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    data = request.json or {}

    receiver_id = data.get(
        'receiver_id'
    )

    if not receiver_id:
        return jsonify(
            error='receiver_id wajib diisi'
        ), 400

    try:

        receiver_id = int(receiver_id)

    except (TypeError, ValueError):

        return jsonify(
            error='receiver_id tidak valid'
        ), 400

    # Tidak boleh menghubungkan diri sendiri
    if receiver_id == user['id']:

        return jsonify(
            error='Tidak dapat mengirim koneksi ke diri sendiri'
        ), 400

    # Pastikan user tujuan benar-benar ada
    receiver = query(
        '''
        SELECT
            id,
            full_name
        FROM users
        WHERE id=%s
        ''',
        (
            receiver_id,
        ),
        one=True
    )

    if not receiver:

        return jsonify(
            error='Mahasiswa tidak ditemukan'
        ), 404

    # Cek koneksi yang sudah ada
    existing = query(
        '''
        SELECT
            id,
            sender_id,
            receiver_id,
            status
        FROM connection_requests
        WHERE
            (
                sender_id=%s
                AND receiver_id=%s
            )
            OR
            (
                sender_id=%s
                AND receiver_id=%s
            )
        ORDER BY id DESC
        LIMIT 1
        ''',
        (
            user['id'],
            receiver_id,
            receiver_id,
            user['id']
        ),
        one=True
    )

    if existing:

        # Sudah menjadi koneksi
        if existing['status'] == 'accepted':

            return jsonify(
                error='Kalian sudah terhubung'
            ), 409

        # Masih ada permintaan
        if existing['status'] == 'pending':

            if (
                existing['sender_id']
                == user['id']
            ):

                return jsonify(
                    error='Permintaan koneksi sudah dikirim'
                ), 409

            else:

                return jsonify(
                    error=(
                        'Mahasiswa tersebut sudah '
                        'mengirim permintaan koneksi '
                        'kepada kamu'
                    )
                ), 409

    # Buat permintaan baru
    connection = query(
        '''
        INSERT INTO connection_requests(
            sender_id,
            receiver_id,
            status
        )
        VALUES(%s,%s,'pending')
        RETURNING id
        ''',
        (
            user['id'],
            receiver_id
        ),
        one=True,
        commit=True
    )

    # Kirim notifikasi
    create_notification(
        receiver_id,
        'Permintaan koneksi baru',
        (
            user['full_name']
            + ' ingin terhubung dengan kamu.'
        )
    )

    return jsonify(
        message='Permintaan koneksi berhasil dikirim',
        id=connection['id']
    ), 201


# ============================================================
# DAFTAR KONEKSI
# ============================================================

@app.get('/api/connections')
def get_connections():

    user = current()

    if not user:

        return jsonify(
            error='Unauthorized'
        ), 401

    user_id = user['id']

    # Permintaan masuk
    incoming = query(
        '''
        SELECT
            cr.id,
            cr.status,
            cr.created_at,
            u.id AS user_id,
            u.full_name,
            u.email,
            u.program_study,
            u.semester,
            u.domicile,
            u.upbjj,
            u.study_method,
            u.study_time,
            u.bio
        FROM connection_requests cr
        JOIN users u
            ON u.id=cr.sender_id
        WHERE cr.receiver_id=%s
        ORDER BY cr.created_at DESC
        ''',
        (
            user_id,
        ),
        fetch=True
    )

    # Permintaan keluar
    outgoing = query(
        '''
        SELECT
            cr.id,
            cr.status,
            cr.created_at,
            u.id AS user_id,
            u.full_name,
            u.email,
            u.program_study,
            u.semester,
            u.domicile,
            u.upbjj,
            u.study_method,
            u.study_time,
            u.bio
        FROM connection_requests cr
        JOIN users u
            ON u.id=cr.receiver_id
        WHERE cr.sender_id=%s
        ORDER BY cr.created_at DESC
        ''',
        (
            user_id,
        ),
        fetch=True
    )

    # Koneksi yang sudah diterima
    connected = query(
        '''
        SELECT
            cr.id,
            cr.created_at,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.id
                ELSE u1.id
            END AS user_id,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.full_name
                ELSE u1.full_name
            END AS full_name,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.email
                ELSE u1.email
            END AS email,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.program_study
                ELSE u1.program_study
            END AS program_study,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.semester
                ELSE u1.semester
            END AS semester,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.domicile
                ELSE u1.domicile
            END AS domicile,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.upbjj
                ELSE u1.upbjj
            END AS upbjj,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.study_method
                ELSE u1.study_method
            END AS study_method,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.study_time
                ELSE u1.study_time
            END AS study_time,

            CASE
                WHEN cr.sender_id=%s
                THEN u2.bio
                ELSE u1.bio
            END AS bio

        FROM connection_requests cr

        JOIN users u1
            ON u1.id=cr.sender_id

        JOIN users u2
            ON u2.id=cr.receiver_id

        WHERE
            (
                cr.sender_id=%s
                OR cr.receiver_id=%s
            )
            AND cr.status='accepted'

        ORDER BY cr.created_at DESC
        ''',
        (
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id,
            user_id
        ),
        fetch=True
    )

    return jsonify(
        incoming=incoming,
        outgoing=outgoing,
        connected=connected
    )


# ============================================================
# TERIMA / TOLAK PERMINTAAN KONEKSI
# ============================================================

@app.put('/api/connections/<int:cid>')
def update_connection(cid):

    user = current()

    if not user:

        return jsonify(
            error='Unauthorized'
        ), 401

    data = request.json or {}

    action = str(
        data.get(
            'action',
            ''
        )
    ).strip().lower()

    if action not in (
        'accept',
        'reject'
    ):

        return jsonify(
            error=(
                'Action harus accept atau reject'
            )
        ), 400

    connection = query(
        '''
        SELECT
            cr.id,
            cr.sender_id,
            cr.receiver_id,
            cr.status,
            sender.full_name AS sender_name,
            receiver.full_name AS receiver_name
        FROM connection_requests cr

        JOIN users sender
            ON sender.id=cr.sender_id

        JOIN users receiver
            ON receiver.id=cr.receiver_id

        WHERE cr.id=%s
        ''',
        (
            cid,
        ),
        one=True
    )

    if not connection:

        return jsonify(
            error='Permintaan koneksi tidak ditemukan'
        ), 404

    # Hanya penerima yang boleh menerima/menolak
    if connection['receiver_id'] != user['id']:

        return jsonify(
            error=(
                'Kamu tidak memiliki akses '
                'untuk memproses permintaan ini'
            )
        ), 403

    # Harus masih pending
    if connection['status'] != 'pending':

        return jsonify(
            error='Permintaan koneksi sudah diproses'
        ), 409

    # ========================================================
    # TERIMA KONEKSI
    # ========================================================

    if action == 'accept':

        # Cek apakah sudah ada koneksi accepted
        # antara dua mahasiswa ini
        existing_accepted = query(
            '''
            SELECT
                id
            FROM connection_requests
            WHERE
                status='accepted'
                AND
                (
                    (
                        sender_id=%s
                        AND receiver_id=%s
                    )
                    OR
                    (
                        sender_id=%s
                        AND receiver_id=%s
                    )
                )
            LIMIT 1
            ''',
            (
                connection['sender_id'],
                connection['receiver_id'],
                connection['receiver_id'],
                connection['sender_id']
            ),
            one=True
        )

        if existing_accepted:

            return jsonify(
                error='Kalian sudah terhubung'
            ), 409

        # Ubah status menjadi accepted
        query(
            '''
            UPDATE connection_requests
            SET status='accepted'
            WHERE id=%s
            ''',
            (
                cid,
            ),
            commit=True
        )

        # Kirim notifikasi
        create_notification(
            connection['sender_id'],
            'Koneksi diterima',
            (
                user['full_name']
                + ' menerima permintaan koneksi kamu.'
            )
        )

        return jsonify(
            message='Permintaan koneksi diterima'
        )

    # ========================================================
    # TOLAK KONEKSI
    # ========================================================

    query(
        '''
        DELETE FROM connection_requests
        WHERE id=%s
        ''',
        (
            cid,
        ),
        commit=True
    )

    create_notification(
        connection['sender_id'],
        'Permintaan koneksi ditolak',
        (
            user['full_name']
            + ' menolak permintaan koneksi kamu.'
        )
    )

    return jsonify(
        message='Permintaan koneksi ditolak'
    )

# ============================================================
# NOTIFICATIONS
# ============================================================

@app.get('/api/notifications')
def notifications():

    user = current()

    if not user:

        return jsonify(
            error='Unauthorized'
        ), 401

    rows = query(
        '''
        SELECT
        id,
        title,
        message,
        is_read,
        created_at,
        related_user_id
        FROM notifications
        WHERE user_id=%s
        ORDER BY created_at DESC
        LIMIT 50
        ''',
        (
            user['id'],
        ),
        fetch=True
    )

    return jsonify(
        notifications=rows
    )


# ============================================================
# MARK NOTIFICATION AS READ
# ============================================================

@app.put('/api/notifications/<int:nid>/read')
def notification_read(nid):

    user = current()

    if not user:

        return jsonify(
            error='Unauthorized'
        ), 401

    query(
        '''
        UPDATE notifications
        SET is_read=TRUE
        WHERE
            id=%s
            AND user_id=%s
        ''',
        (
            nid,
            user['id']
        ),
        commit=True
    )

    return jsonify(
        message='Notifikasi ditandai sudah dibaca'
    )


# ============================================================
# MARK ALL NOTIFICATIONS AS READ
# ============================================================

@app.put('/api/notifications/read-all')
def notifications_read_all():

    user = current()

    if not user:

        return jsonify(
            error='Unauthorized'
        ), 401

    query(
        '''
        UPDATE notifications
        SET is_read=TRUE
        WHERE user_id=%s
        ''',
        (
            user['id'],
        ),
        commit=True
    )

    return jsonify(
        message='Semua notifikasi sudah dibaca'
    )


# ============================================================
# KELOMPOK BELAJAR
# ============================================================

@app.get('/api/groups')
def groups():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    return jsonify(
        groups=query(
            '''
            SELECT
                g.*,
                c.code,
                c.name AS course_name,
                u.full_name AS creator,

                (
                    SELECT COUNT(*)
                    FROM group_members gm
                    WHERE gm.group_id=g.id
                ) AS member_count,

                EXISTS(
                    SELECT 1
                    FROM group_members gx
                    WHERE gx.group_id=g.id
                    AND gx.user_id=%s
                ) AS joined

            FROM study_groups g

            LEFT JOIN courses c
                ON c.id=g.course_id

            JOIN users u
                ON u.id=g.creator_id

            ORDER BY g.created_at DESC
            ''',
            (user['id'],),
            fetch=True
        )
    )


@app.post('/api/groups')
def create_group():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    d = request.json or {}

    if not d.get('name'):
        return jsonify(
            error='Nama kelompok wajib diisi'
        ), 400

    try:

        max_members = int(
            d.get(
                'max_members',
                4
            )
        )

    except ValueError:

        return jsonify(
            error='Jumlah anggota tidak valid'
        ), 400

    if max_members < 2:
        return jsonify(
            error='Minimal 2 anggota'
        ), 400

    group = query(
        '''
        INSERT INTO study_groups(
            name,
            description,
            course_id,
            creator_id,
            method,
            study_time,
            max_members,
            meeting_link
        )
        VALUES(
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            %s
        )
        RETURNING id
        ''',
        (
            d['name'],
            d.get(
                'description',
                ''
            ),
            d.get(
                'course_id'
            ) or None,
            user['id'],
            d.get(
                'method',
                'Online'
            ),
            d.get(
                'study_time',
                '18:00-21:00'
            ),
            max_members,
            d.get(
                'meeting_link',
                ''
            )
        ),
        one=True,
        commit=True
    )

    query(
        '''
        INSERT INTO group_members(
            group_id,
            user_id,
            role
        )
        VALUES(
            %s,
            %s,
            'admin'
        )
        ''',
        (
            group['id'],
            user['id']
        ),
        commit=True
    )

    return jsonify(
        id=group['id'],
        message='Kelompok berhasil dibuat'
    )


@app.post('/api/groups/<int:gid>/join')
def join(gid):

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    group = query(
        '''
        SELECT
            id,
            max_members
        FROM study_groups
        WHERE id=%s
        ''',
        (gid,),
        one=True
    )

    if not group:
        return jsonify(
            error='Kelompok tidak ditemukan'
        ), 404

    # Cek apakah sudah menjadi anggota
    already = query(
        '''
        SELECT user_id
        FROM group_members
        WHERE group_id=%s
        AND user_id=%s
        ''',
        (
            gid,
            user['id']
        ),
        one=True
    )

    if already:
        return jsonify(
            message='Kamu sudah menjadi anggota kelompok'
        )

    count = query(
        '''
        SELECT COUNT(*) AS n
        FROM group_members
        WHERE group_id=%s
        ''',
        (gid,),
        one=True
    )['n']

    if count >= group['max_members']:
        return jsonify(
            error='Kapasitas kelompok penuh'
        ), 400

    query(
        '''
        INSERT INTO group_members(
            group_id,
            user_id
        )
        VALUES(%s,%s)
        ON CONFLICT DO NOTHING
        ''',
        (
            gid,
            user['id']
        ),
        commit=True
    )

    return jsonify(
        message='Berhasil bergabung'
    )


# ============================================================
# STATISTIK MAHASISWA
# ============================================================

@app.get('/api/stats')
def stats():

    user = current()

    if not user:
        return jsonify(
            error='Unauthorized'
        ), 401

    partners_count = query(
        '''
        SELECT COUNT(*) AS n
        FROM users
        WHERE id<>%s
        ''',
        (user['id'],),
        one=True
    )['n']

    courses_count = query(
        '''
        SELECT COUNT(*) AS n
        FROM user_courses
        WHERE user_id=%s
        ''',
        (user['id'],),
        one=True
    )['n']

    groups_count = query(
        '''
        SELECT COUNT(*) AS n
        FROM study_groups
        ''',
        one=True
    )['n']

    connections_count = query(
        '''
        SELECT COUNT(*) AS n
        FROM connection_requests
        WHERE (
            sender_id=%s
            OR receiver_id=%s
        )
        AND status='accepted'
        ''',
        (
            user['id'],
            user['id']
        ),
        one=True
    )['n']

    return jsonify(
        partners=partners_count,
        courses=courses_count,
        groups=groups_count,
        connections=connections_count
    )


# ============================================================
# ============================================================
# ADMIN PANEL
# ============================================================
# ============================================================


def admin_only():
    """
    Memastikan user sudah login
    dan mempunyai role admin.
    """

    user = current()

    if not user:

        return None, (
            jsonify(
                error='Unauthorized. Silakan login terlebih dahulu.'
            ),
            401
        )

    if user.get('role') != 'admin':

        return None, (
            jsonify(
                error='Akses admin diperlukan.'
            ),
            403
        )

    return user, None


# ============================================================
# ADMIN - DASHBOARD
# ============================================================

@app.get('/api/admin/overview')
def admin_overview():

    user, error = admin_only()

    if error:
        return error

    users = query(
        '''
        SELECT COUNT(*) AS n
        FROM users
        ''',
        one=True
    )['n']

    courses = query(
        '''
        SELECT COUNT(*) AS n
        FROM courses
        ''',
        one=True
    )['n']

    groups = query(
        '''
        SELECT COUNT(*) AS n
        FROM study_groups
        ''',
        one=True
    )['n']

    return jsonify(
        users=users,
        courses=courses,
        groups=groups
    )


# ============================================================
# ADMIN - KELOLA MATA KULIAH
# ============================================================

@app.get('/api/admin/courses')
def admin_courses():

    user, error = admin_only()

    if error:
        return error

    courses = query(
        '''
        SELECT
            id,
            code,
            name
        FROM courses
        ORDER BY code ASC
        ''',
        fetch=True
    )

    return jsonify(
        courses=courses
    )


@app.post('/api/admin/courses')
def admin_add_course():

    user, error = admin_only()

    if error:
        return error

    data = request.json or {}

    code = str(
        data.get(
            'code',
            ''
        )
    ).strip().upper()

    name = str(
        data.get(
            'name',
            ''
        )
    ).strip()

    if not code:

        return jsonify(
            error='Kode mata kuliah wajib diisi.'
        ), 400

    if not name:

        return jsonify(
            error='Nama mata kuliah wajib diisi.'
        ), 400

    existing = query(
        '''
        SELECT id
        FROM courses
        WHERE UPPER(code)=UPPER(%s)
        ''',
        (code,),
        one=True
    )

    if existing:

        return jsonify(
            error='Kode mata kuliah sudah digunakan.'
        ), 409

    course = query(
        '''
        INSERT INTO courses(
            code,
            name
        )
        VALUES(
            %s,
            %s
        )
        RETURNING
            id,
            code,
            name
        ''',
        (
            code,
            name
        ),
        one=True,
        commit=True
    )

    return jsonify(
        message='Mata kuliah berhasil ditambahkan.',
        course=course
    ), 201


@app.put('/api/admin/courses/<int:cid>')
def admin_update_course(cid):

    user, error = admin_only()

    if error:
        return error

    data = request.json or {}

    code = str(
        data.get(
            'code',
            ''
        )
    ).strip().upper()

    name = str(
        data.get(
            'name',
            ''
        )
    ).strip()

    if not code or not name:

        return jsonify(
            error='Kode dan nama mata kuliah wajib diisi.'
        ), 400

    existing = query(
        '''
        SELECT id
        FROM courses
        WHERE id=%s
        ''',
        (cid,),
        one=True
    )

    if not existing:

        return jsonify(
            error='Mata kuliah tidak ditemukan.'
        ), 404

    duplicate = query(
        '''
        SELECT id
        FROM courses
        WHERE UPPER(code)=UPPER(%s)
        AND id<>%s
        ''',
        (
            code,
            cid
        ),
        one=True
    )

    if duplicate:

        return jsonify(
            error='Kode mata kuliah sudah digunakan.'
        ), 409

    course = query(
        '''
        UPDATE courses
        SET
            code=%s,
            name=%s
        WHERE id=%s
        RETURNING
            id,
            code,
            name
        ''',
        (
            code,
            name,
            cid
        ),
        one=True,
        commit=True
    )

    return jsonify(
        message='Mata kuliah berhasil diperbarui.',
        course=course
    )


@app.delete('/api/admin/courses/<int:cid>')
def admin_delete_course(cid):

    user, error = admin_only()

    if error:
        return error

    existing = query(
        '''
        SELECT
            id,
            code,
            name
        FROM courses
        WHERE id=%s
        ''',
        (cid,),
        one=True
    )

    if not existing:

        return jsonify(
            error='Mata kuliah tidak ditemukan.'
        ), 404

    try:

        query(
            '''
            DELETE FROM courses
            WHERE id=%s
            ''',
            (cid,),
            commit=True
        )

        return jsonify(
            message='Mata kuliah berhasil dihapus.'
        )

    except psycopg2.Error:

        return jsonify(
            error=(
                'Mata kuliah tidak dapat dihapus '
                'karena masih digunakan oleh '
                'mahasiswa atau kelompok belajar.'
            )
        ), 409


# ============================================================
# ADMIN - KELOLA PENGGUNA
# ============================================================

@app.get('/api/admin/users')
def admin_users():

    user, error = admin_only()

    if error:
        return error

    users = query(
        '''
        SELECT
            id,
            full_name,
            email,
            nim,
            program_study,
            semester,
            domicile,
            upbjj,
            role,
            created_at
        FROM users
        ORDER BY created_at DESC
        ''',
        fetch=True
    )

    return jsonify(
        users=users
    )


@app.put('/api/admin/users/<int:uid>/role')
def admin_user_role(uid):

    user, error = admin_only()

    if error:
        return error

    data = request.json or {}

    role = str(
        data.get(
            'role',
            'student'
        )
    ).strip().lower()

    if role not in (
        'student',
        'admin'
    ):

        return jsonify(
            error='Role harus student atau admin.'
        ), 400

    # Admin tidak boleh menurunkan role dirinya sendiri
    if (
        uid == user['id']
        and role != 'admin'
    ):

        return jsonify(
            error=(
                'Akun admin yang sedang digunakan '
                'tidak dapat diturunkan menjadi mahasiswa.'
            )
        ), 400

    existing = query(
        '''
        SELECT id
        FROM users
        WHERE id=%s
        ''',
        (uid,),
        one=True
    )

    if not existing:

        return jsonify(
            error='Pengguna tidak ditemukan.'
        ), 404

    updated_user = query(
        '''
        UPDATE users
        SET role=%s
        WHERE id=%s
        RETURNING
            id,
            full_name,
            email,
            role
        ''',
        (
            role,
            uid
        ),
        one=True,
        commit=True
    )

    return jsonify(
        message='Role pengguna berhasil diperbarui.',
        user=updated_user
    )


# ============================================================
# ADMIN - KELOLA KELOMPOK
# ============================================================

@app.get('/api/admin/groups')
def admin_groups():

    user, error = admin_only()

    if error:
        return error

    groups = query(
        '''
        SELECT
            g.id,
            g.name,
            g.description,
            g.max_members,
            g.study_time,

            c.code AS course_code,
            c.name AS course_name,

            u.full_name AS creator,

            (
                SELECT COUNT(*)
                FROM group_members gm
                WHERE gm.group_id=g.id
            ) AS member_count

        FROM study_groups g

        LEFT JOIN courses c
            ON c.id=g.course_id

        LEFT JOIN users u
            ON u.id=g.creator_id

        ORDER BY g.created_at DESC
        ''',
        fetch=True
    )

    return jsonify(
        groups=groups
    )


@app.delete('/api/admin/groups/<int:gid>')
def admin_delete_group(gid):

    user, error = admin_only()

    if error:
        return error

    existing = query(
        '''
        SELECT
            id,
            name
        FROM study_groups
        WHERE id=%s
        ''',
        (gid,),
        one=True
    )

    if not existing:

        return jsonify(
            error='Kelompok tidak ditemukan.'
        ), 404

    try:

        query(
            '''
            DELETE FROM study_groups
            WHERE id=%s
            ''',
            (gid,),
            commit=True
        )

        return jsonify(
            message='Kelompok berhasil dihapus.'
        )

    except psycopg2.Error:

        return jsonify(
            error='Kelompok tidak dapat dihapus.'
        ), 409


# ============================================================
# MENJADIKAN USER TERTENTU SEBAGAI ADMIN
# ============================================================

@app.post('/api/admin/users/<int:uid>/make-admin')
def make_admin(uid):

    user, error = admin_only()

    if error:
        return error

    existing = query(
        '''
        SELECT
            id,
            full_name,
            email,
            role
        FROM users
        WHERE id=%s
        ''',
        (uid,),
        one=True
    )

    if not existing:

        return jsonify(
            error='Pengguna tidak ditemukan.'
        ), 404

    updated = query(
        '''
        UPDATE users
        SET role='admin'
        WHERE id=%s
        RETURNING
            id,
            full_name,
            email,
            role
        ''',
        (uid,),
        one=True,
        commit=True
    )

    return jsonify(
        message='Pengguna berhasil dijadikan admin.',
        user=updated
    )


# ============================================================
# SERVER
# ============================================================

if __name__ == '__main__':

    app.run(
        host='127.0.0.1',
        port=int(
            os.getenv(
                'FLASK_PORT',
                '5000'
            )
        ),
        debug=True
    )