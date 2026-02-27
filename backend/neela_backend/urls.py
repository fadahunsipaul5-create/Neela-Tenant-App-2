from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from api.dropbox_sign_views import dropbox_sign_callback
import os

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('accounts/', include('accounts.urls')),
    path('dropbox-sign/callback/', dropbox_sign_callback, name='dropbox_sign_callback'),
]

if settings.DEBUG or os.environ.get('RENDER'):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
