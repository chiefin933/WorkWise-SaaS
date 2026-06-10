import json
import logging
import base64
import os
from django.db import models
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)


def get_encryption_key():
    """
    Returns the master key decoded from base64.
    Supports MASTER_ENCRYPTION_KEY or falls back to FIELD_ENCRYPTION_KEY.
    """
    key = getattr(settings, 'MASTER_ENCRYPTION_KEY', None) or getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    if not key:
        raise ImproperlyConfigured("MASTER_ENCRYPTION_KEY or FIELD_ENCRYPTION_KEY setting is missing.")
    return base64.b64decode(key.encode())


def get_aesgcm():
    """Initializes the AES-256-GCM cipher object."""
    key_bytes = get_encryption_key()
    return AESGCM(key_bytes)


def encrypt_value(plaintext: str) -> str:
    """Encrypts plaintext using AES-256-GCM and returns a base64 encoded package."""
    if not plaintext:
        return ""
    try:
        aesgcm = get_aesgcm()
        nonce = os.urandom(12)  # Secure 12-byte initialization vector
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
        # Store both nonce and ciphertext together
        return base64.b64encode(nonce + ciphertext).decode('utf-8')
    except Exception as e:
        logger.error(f"AES-256-GCM Encryption Failure: {e}")
        raise e


def decrypt_value(ciphertext_str: str) -> str:
    """
    Decrypts a base64 encrypted package using AES-256-GCM.
    Includes an automatic fallback to Fernet if the ciphertext is in legacy format.
    """
    if not ciphertext_str:
        return ""
    
    # ── Legacy Fernet Decryption Fallback ──────────────────────────────────
    if ciphertext_str.startswith('gAAAA'):
        try:
            logger.info("Legacy Fernet ciphertext detected. Attempting fallback decryption...")
            legacy_key = getattr(settings, 'FIELD_ENCRYPTION_KEY', None) or getattr(settings, 'MASTER_ENCRYPTION_KEY', None)
            if legacy_key:
                f = Fernet(legacy_key.encode())
                return f.decrypt(ciphertext_str.encode()).decode('utf-8')
        except Exception as e:
            logger.error(f"Legacy Fernet decryption fallback failed: {e}")
            return ciphertext_str

    # ── Standard AES-256-GCM Decryption ────────────────────────────────────
    try:
        aesgcm = get_aesgcm()
        package = base64.b64decode(ciphertext_str.encode('utf-8'))
        if len(package) < 12:
            return ciphertext_str
        nonce = package[:12]
        ciphertext = package[12:]
        return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
    except Exception as e:
        # Fallback to returning original string in case of bad decryption/plain text
        logger.error(f"AES-256-GCM Decryption failure: {e}")
        return ciphertext_str


class EncryptedCharField(models.TextField):
    """
    A custom field that transparently encrypts data with AES-256-GCM before saving to
    the database, and automatically decrypts it upon retrieval.
    """
    description = "A transparent AES-256-GCM encrypted CharField"

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return decrypt_value(value)

    def to_python(self, value):
        if value is None:
            return value
        # If the value is already a decrypted string or plain text, return it.
        # Encrypted values are base64 strings that we decrypt if valid.
        try:
            # Simple check: if it looks like encrypted GCM package (usually longer than standard strings)
            # and is valid base64, attempt to decrypt it.
            decoded = base64.b64decode(value.encode('utf-8'), validate=True)
            if len(decoded) >= 12:
                return decrypt_value(value)
        except Exception:
            pass
        return value

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or value == '':
            return value
        
        # Avoid double-encrypting
        try:
            decoded = base64.b64decode(value.encode('utf-8'), validate=True)
            if len(decoded) >= 12:
                return value
        except Exception:
            pass
            
        return encrypt_value(value)


class EncryptedJSONField(models.TextField):
    """
    A custom field that transparently serializes a dictionary to JSON,
    encrypts the string using AES-256-GCM, and saves the ciphertext to the database.
    """
    description = "A transparent AES-256-GCM encrypted JSONField"

    def from_db_value(self, value, expression, connection):
        if value is None or value == '':
            return {}
        try:
            decrypted = decrypt_value(value)
            return json.loads(decrypted)
        except Exception as e:
            logger.error(f"JSON field decryption/parsing error: {e}")
            return {}

    def to_python(self, value):
        if value is None:
            return {}
        if isinstance(value, str):
            if value == '':
                return {}
            try:
                decrypted = decrypt_value(value)
                return json.loads(decrypted)
            except Exception:
                try:
                    return json.loads(value)
                except Exception as e:
                    logger.error(f"JSON field parsing error in to_python: {e}")
                    return {}
        return value

    def get_prep_value(self, value):
        if value is None:
            return ''
        
        # If already encrypted, save as is
        if isinstance(value, str):
            try:
                decoded = base64.b64decode(value.encode('utf-8'), validate=True)
                if len(decoded) >= 12:
                    return value
            except Exception:
                pass
        
        try:
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except Exception:
                    pass
            serialized = json.dumps(value)
            return encrypt_value(serialized)
        except Exception as e:
            logger.error(f"JSON field encryption error: {e}")
            raise e
