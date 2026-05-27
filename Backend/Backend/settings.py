from pathlib import Path

import environ
import os

from datetime import timedelta
from celery.schedules import crontab

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# env
env = environ.Env() 
environ.Env.read_env(os.path.join(BASE_DIR, '.env'))

SECRET_KEY = env('SECRET_KEY')

DEBUG = env.bool('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',             
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_celery_beat',
    'TicketAppB',
]


MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'TicketAppB.middleware.UserOnlineMiddleware',
    'TicketAppB.middleware.LicenseExpiryMiddleware',
]

ROOT_URLCONF = 'Backend.urls'

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

WSGI_APPLICATION = 'Backend.wsgi.application'


# Database

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT'),
        'CONN_MAX_AGE': 60,
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
        },
    }
}


# custom user model
AUTH_USER_MODEL = 'TicketAppB.CustomUser'


# Password validation
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
LANGUAGE_CODE = 'en-us'

USE_I18N = True

USE_TZ = True
TIME_ZONE = 'Asia/Kolkata'


# Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {name} {module} {funcName}:{lineno} - {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'simple': {
            'format': '{levelname} {asctime} {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'django.log'),
            'maxBytes': 1024 * 1024 * 15,  # 15MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'ticket_transactions_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'ticket_transactions.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'verbose',
        },
        'tripclose_transactions_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'tripclose_transactions.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'verbose',
        },
        'mosambee_transactions_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'mosambee_transactions.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'verbose',
        },
        'mosambee_payouts_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'mosambee_payouts.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'verbose',
        },
        'palmtec_ticket_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_ticket.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_trip_open_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_trip_open.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_trip_close_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_trip_close.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_trip_close_summary_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_trip_close_summary.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_schedule_open_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_schedule_open.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_schedule_close_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_schedule_close.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_schedule_close_summary_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_schedule_close_summary.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_odometer_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_odometer.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
        'palmtec_expense_file': {
            'level': 'INFO',
            'class': 'logging.handlers.TimedRotatingFileHandler',
            'filename': os.path.join(BASE_DIR, 'logs', 'palmtec_expense.log'),
            'when': 'midnight',
            'backupCount': 30,
            'formatter': 'simple',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
            'propagate': False,
        },
        'TicketAppB': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'ticket.transactions': {
            'handlers': ['ticket_transactions_file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'tripclose.transactions': {
            'handlers': ['tripclose_transactions_file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'mosambee.transactions': {
            'handlers': ['mosambee_transactions_file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'mosambee.payouts': {
            'handlers': ['mosambee_payouts_file', 'console'],
            'level': 'ERROR',
            'propagate': False,
        },
        'ticket.palmtec.ticket': {
            'handlers': ['palmtec_ticket_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.trip_open': {
            'handlers': ['palmtec_trip_open_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.trip_close': {
            'handlers': ['palmtec_trip_close_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.trip_close_summary': {
            'handlers': ['palmtec_trip_close_summary_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.schedule_open': {
            'handlers': ['palmtec_schedule_open_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.schedule_close': {
            'handlers': ['palmtec_schedule_close_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.schedule_close_summary': {
            'handlers': ['palmtec_schedule_close_summary_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.odometer': {
            'handlers': ['palmtec_odometer_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'ticket.palmtec.expense': {
            'handlers': ['palmtec_expense_file'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Create logs directory if it doesn't exist
LOGS_DIR = os.path.join(BASE_DIR, 'logs')
if not os.path.exists(LOGS_DIR):
    os.makedirs(LOGS_DIR)


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'

MEDIA_ROOT = os.path.join(BASE_DIR, 'uploads')
MEDIA_URL  = '/uploads/'

# Default primary key field type

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS')

CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}


SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Cookie Settings for HTTP Testing
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# License Server Configuration
LICENSE_SERVER_BASE_URL = env('LICENSE_SERVER_BASE_URL')
PRODUCT_REGISTRATION_ENDPOINT = env('PRODUCT_REGISTRATION_ENDPOINT', default='/product-registration')
PRODUCT_AUTH_ENDPOINT = env('PRODUCT_AUTH_ENDPOINT', default='/product-authentication')

# Construct full URLs
PRODUCT_REGISTRATION_URL = f"{LICENSE_SERVER_BASE_URL}{PRODUCT_REGISTRATION_ENDPOINT}"
PRODUCT_AUTH_URL = f"{LICENSE_SERVER_BASE_URL}{PRODUCT_AUTH_ENDPOINT}"

# Application Configuration
APP_VERSION = env('APP_VERSION')
PROJECT_NAME = env('PROJECT_NAME')

# Mosambee salt
MOSAMBEE_SALT=env('MOSAMBEE_SALT')

# automatically append slash to URLs (for DRF)
APPEND_SLASH = False

# Celery Configuration
CELERY_BROKER_URL = env('CELERY_BROKER_URL')

CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Kolkata'  # Set to your local time

# Optimization for high-concurrency (Reliability)
CELERY_TASK_ACKS_LATE = True # Task isn't "gone" until it's finished
CELERY_WORKER_PREFETCH_MULTIPLIER = 1 # Prevents one worker from hogging 100 tasks
CELERY_TASK_REJECT_ON_WORKER_LOST = True  # Re-queue if worker crashes

# Django Cache (Redis DB 1 — separate from Celery broker on DB 0)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": env('REDIS_CACHE_URL'),
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}


CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

CELERY_BEAT_SCHEDULE = {
    'scan-pending-raw-logs': {
        'task': 'TicketAppB.tasks.scan_pending_raw_logs',
        # interval in seconds. runs every 60 seconds
        'schedule': 60.0,
    },
    'cleanup-processed-raw-logs': {
        'task': 'TicketAppB.tasks.cleanup_processed_raw_logs',
        # every day @ 2 AM
        'schedule': crontab(hour=2, minute=0),
    },
}


# email settings
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_PORT = env('EMAIL_PORT',default=587)
EMAIL_USE_TLS = env('EMAIL_USE_TLS',default=True)
EMAIL_HOST_USER = env('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL')