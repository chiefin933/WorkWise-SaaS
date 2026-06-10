
"""
Django settings for config project.
"""

from pathlib import Path
import os
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')


# SECURITY: Secret key must be set in the .env file and must NEVER be committed to version control.
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')

# SECURITY: Set DEBUG=False in production. Controlled entirely by the environment.
DEBUG = os.environ.get('DJANGO_DEBUG', 'False').lower() == 'true'

# Prevent accidental use of insecure fallback keys.
from django.core.exceptions import ImproperlyConfigured
if not SECRET_KEY:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be set in the environment.')

# SECURITY: Restrict to known hosts. Wildcards are forbidden in production.
ALLOWED_HOSTS = os.environ.get(
    'DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1'
).split(',')


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'core',
    'tenants',
    'users',
    'employees',
    'attendance',
    'leave',
    'payroll',
    'payslips',
    'reports',
    'django_daraja',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TenantMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ── HTTP Security Headers ────────────────────────────────────────────────────
# Force HTTPS in production (set DJANGO_SECURE_SSL to True behind a TLS proxy)
SECURE_SSL_REDIRECT = os.environ.get('DJANGO_SECURE_SSL', 'False').lower() == 'true'
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0          # 1 year in production
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'                                     # Prevent clickjacking
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# ── Database ─────────────────────────────────────────────────────────────────
# Priority 1: DATABASE_URL  (Supabase connection string — paste any format)
# Priority 2: Individual DB_* env vars  (manual host/port/user/pass)
# Priority 3: SQLite fallback  (local dev only — blocked in production)
# SECURITY: SSL is always enforced for PostgreSQL connections.
import dj_database_url
import warnings

_DATABASE_URL = os.environ.get('DATABASE_URL', '')
_DB_HOST      = os.environ.get('DB_HOST', '')

# ── Shared PostgreSQL extras injected after URL/var parsing ──────────────────
_PG_EXTRAS = {
    'CONN_MAX_AGE': int(os.environ.get('DB_CONN_MAX_AGE', '0')),
    'CONN_HEALTH_CHECKS': True,
    # Disable named cursors — required for pgBouncer transaction mode.
    'DISABLE_SERVER_SIDE_CURSORS': os.environ.get(
        'DB_DISABLE_SERVER_SIDE_CURSORS', 'True'
    ).lower() == 'true',
    'OPTIONS': {
        'sslmode': os.environ.get('DB_SSLMODE', 'require'),
        'application_name': 'workwise-backend',
        'options': '-c lock_timeout=30000ms -c statement_timeout=60000ms',
    },
}

if _DATABASE_URL:
    # ── Path 1: DATABASE_URL string (simplest — just paste from Supabase) ────
    _db_config = dj_database_url.parse(
        _DATABASE_URL,
        conn_max_age=_PG_EXTRAS['CONN_MAX_AGE'],
        conn_health_checks=True,
        ssl_require=True,
    )
    _db_config.update(_PG_EXTRAS)
    DATABASES = {'default': _db_config}

elif _DB_HOST:
    # ── Path 2: Individual DB_* environment variables ────────────────────────
    _db_config = {
        'ENGINE': os.environ.get('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME':     os.environ.get('DB_NAME', 'postgres'),
        'USER':     os.environ.get('DB_USER', ''),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST':     _DB_HOST,
        'PORT':     os.environ.get('DB_PORT', '5432'),
    }
    _db_config.update(_PG_EXTRAS)
    DATABASES = {'default': _db_config}

else:
    # ── Path 3: SQLite — local development only ───────────────────────────────
    if not DEBUG:
        raise ImproperlyConfigured(
            'Security Halt: Neither DATABASE_URL nor DB_HOST is configured. '
            'A production deployment must connect to PostgreSQL.'
        )
    warnings.warn(
        'No DATABASE_URL or DB_HOST found — falling back to SQLite. '
        'Set DATABASE_URL in .env to connect to Supabase PostgreSQL.',
        stacklevel=2,
    )
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }




# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.0/howto/static-files/

STATIC_URL = 'static/'

AUTH_USER_MODEL = 'users.User'

# ── Cookie Security ──────────────────────────────────────────────────────────
# In production (DEBUG=False) cookies are secure-only and HTTP-only.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# ── Upload Limits ────────────────────────────────────────────────────────────
# Max request body size: 10 MB (protects against huge POST payloads)
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

# ── CORS ────────────────────────────────────────────────────────────────────
# SECURITY: Never allow all origins in production. Only trust the real frontend.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000'
).split(',')
CORS_ALLOW_CREDENTIALS = True                       # Allow cookies / auth headers

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'core.authentication.ClerkAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Return JSON error bodies instead of HTML pages
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
    # ── Rate Limiting (DRF built-in throttling) ──────────────────────────────
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',       # Unauthenticated users (login / register)
        'user': '120/minute',      # Authenticated users — normal API usage
        'login': '10/minute',      # Custom scope for login endpoint
        'register': '5/hour',      # Custom scope for registration
    },
}

SIMPLE_JWT = {
    # SECURITY: Short-lived access tokens reduce the window for token theft.
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,              # Enable if you add simplejwt-blacklist
    'AUTH_HEADER_TYPES': ('Bearer',),
    'UPDATE_LAST_LOGIN': True,
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Clerk ─────────────────────────────────────────────────────────────────────
CLERK_ISSUER = os.environ.get('CLERK_ISSUER', '').rstrip('/')
CLERK_ALLOWED_ISSUERS = [
    issuer.strip().rstrip('/')
    for issuer in os.environ.get(
        'CLERK_ALLOWED_ISSUERS',
        CLERK_ISSUER,
    ).split(',')
    if issuer.strip()
]
CLERK_JWKS_URL = os.environ.get('CLERK_JWKS_URL', '')
CLERK_AUDIENCE = os.environ.get('CLERK_AUDIENCE', '')
CLERK_SECRET_KEY = os.environ.get('CLERK_SECRET_KEY', '')
CLERK_WEBHOOK_SECRET = os.environ.get('CLERK_WEBHOOK_SECRET', '')

# ── Field Encryption ──────────────────────────────────────────────────────────
from django.core.exceptions import ImproperlyConfigured
from cryptography.fernet import Fernet
import base64

MASTER_ENCRYPTION_KEY = os.environ.get('MASTER_ENCRYPTION_KEY', '') or os.environ.get('FIELD_ENCRYPTION_KEY', '')
if not MASTER_ENCRYPTION_KEY:
    raise ImproperlyConfigured("Security Halt: MASTER_ENCRYPTION_KEY is not configured in environment variables.")

try:
    decoded = base64.b64decode(MASTER_ENCRYPTION_KEY.encode())
    if len(decoded) != 32:
        raise ValueError("Key must be 32 bytes")
except Exception as e:
    raise ImproperlyConfigured(f"Security Halt: MASTER_ENCRYPTION_KEY is invalid for AES-256-GCM: {e}")




# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} {levelname} {name} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'core': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
        'users': {
            'handlers': ['console'],
            'level': 'DEBUG' if DEBUG else 'INFO',
            'propagate': False,
        },
    },
}


# ── Email ─────────────────────────────────────────────────────────────────────
# In production, set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# and fill in EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD.
# In development, we use the console backend which prints emails to stdout.
EMAIL_BACKEND = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST          = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT          = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS       = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get(
    'DEFAULT_FROM_EMAIL', 'WorkWise HR <noreply@workwise.co.ke>'
)

# ── M-Pesa Safaricom Daraja B2C ───────────────────────────────────────────────
MPESA_ENABLED            = os.environ.get('MPESA_ENABLED', 'False').lower() == 'true'
MPESA_ENVIRONMENT        = os.environ.get('MPESA_ENVIRONMENT', 'sandbox')
MPESA_SANDBOX            = MPESA_ENVIRONMENT == 'sandbox'
MPESA_BASE_URL           = os.environ.get(
    'MPESA_BASE_URL',
    'https://sandbox.safaricom.co.ke' if MPESA_SANDBOX else 'https://api.safaricom.co.ke'
)
MPESA_CONSUMER_KEY       = os.environ.get('MPESA_CONSUMER_KEY', '')
MPESA_CONSUMER_SECRET    = os.environ.get('MPESA_CONSUMER_SECRET', '')
MPESA_INITIATOR_NAME     = os.environ.get('MPESA_INITIATOR_NAME', 'testapi')
MPESA_INITIATOR_PASSWORD = os.environ.get('MPESA_INITIATOR_PASSWORD', '')
# Legacy alias kept for backward compatibility
MPESA_SHORTCODE          = os.environ.get('MPESA_SHORTCODE', os.environ.get('MPESA_B2C_SHORTCODE', '600000'))
MPESA_B2C_SHORTCODE      = os.environ.get('MPESA_B2C_SHORTCODE', MPESA_SHORTCODE)
MPESA_B2C_RESULT_URL     = os.environ.get('MPESA_B2C_RESULT_URL', '')
MPESA_B2C_TIMEOUT_URL    = os.environ.get('MPESA_B2C_TIMEOUT_URL', '')
MPESA_SECURITY_CREDENTIAL = os.environ.get('MPESA_SECURITY_CREDENTIAL', '')

# Deprecated: don't use a single MPESA_CALLBACK_URL to alias different Daraja
# callback endpoints. Use explicit STK and B2C callback settings below.
MPESA_CALLBACK_URL = os.environ.get('MPESA_CALLBACK_URL', '')

# ── M-Pesa Safaricom Daraja C2B / STK Push ────────────────────────────────────
MPESA_EXPRESS_SHORTCODE  = os.environ.get('MPESA_EXPRESS_SHORTCODE', '174379')
MPESA_PASSKEY            = os.environ.get('MPESA_PASSKEY', '')
MPESA_STK_CALLBACK_URL   = os.environ.get('MPESA_STK_CALLBACK_URL', '')

# Keep explicit B2C callback variables separate
# If not set in environment and running in DEBUG, we allow a local ngrok style fallback to ease development.
if not MPESA_B2C_RESULT_URL and DEBUG:
    MPESA_B2C_RESULT_URL = os.environ.get('MPESA_B2C_RESULT_URL', '')
if not MPESA_B2C_TIMEOUT_URL and DEBUG:
    MPESA_B2C_TIMEOUT_URL = os.environ.get('MPESA_B2C_TIMEOUT_URL', '')
if not MPESA_STK_CALLBACK_URL and DEBUG:
    MPESA_STK_CALLBACK_URL = os.environ.get('MPESA_STK_CALLBACK_URL', '')

if MPESA_ENABLED and not MPESA_SANDBOX and not DEBUG:
    missing_mpesa_settings = [
        name for name, value in {
            'MPESA_PASSKEY': MPESA_PASSKEY,
            'MPESA_STK_CALLBACK_URL': MPESA_STK_CALLBACK_URL,
            'MPESA_B2C_RESULT_URL': MPESA_B2C_RESULT_URL,
            'MPESA_B2C_TIMEOUT_URL': MPESA_B2C_TIMEOUT_URL,
        }.items()
        if not value
    ]
    if missing_mpesa_settings:
        raise ImproperlyConfigured(
            'Missing required live M-Pesa setting(s): '
            + ', '.join(missing_mpesa_settings)
        )

