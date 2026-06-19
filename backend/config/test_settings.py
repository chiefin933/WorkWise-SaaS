"""
Minimal settings override for running tests with SQLite.
Import everything from the main settings, then swap the database.
Use with:  python manage.py test --settings=config.test_settings
"""
import os

# Prevent load_dotenv from picking up the real .env with a Supabase DATABASE_URL
os.environ.setdefault('DJANGO_SECRET_KEY', 'test-secret-key-for-ci-only-not-production')
os.environ.setdefault('DJANGO_DEBUG', 'True')

# Wipe DATABASE_URL before settings.py runs so it falls back to SQLite
os.environ.pop('DATABASE_URL', None)
os.environ.pop('DB_HOST', None)

from config.settings import *  # noqa: F401, F403, E402

# Override with in-memory SQLite for fast, isolated test runs
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Speed up password hashing in tests
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# Silence migration output
MIGRATION_MODULES = {}
