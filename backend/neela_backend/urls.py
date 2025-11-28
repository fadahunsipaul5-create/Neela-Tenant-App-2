from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from api.docusign_views import docusign_callback
import os

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
    path('accounts/', include('accounts.urls')),
    path('docusign/callback/', docusign_callback, name='docusign_callback'),
]

if settings.DEBUG or os.environ.get('RENDER'):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
