from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TenantViewSet, PaymentViewSet, MaintenanceRequestViewSet,
    LegalDocumentViewSet, ListingViewSet, PropertyViewSet, LeaseTemplateViewSet,
    EmailTestViewSet,
    contact_manager,
)

router = DefaultRouter()
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'payments', PaymentViewSet)
router.register(r'maintenance', MaintenanceRequestViewSet)
router.register(r'legal-documents', LegalDocumentViewSet)
router.register(r'lease-templates', LeaseTemplateViewSet)
router.register(r'listings', ListingViewSet)
router.register(r'properties', PropertyViewSet)
router.register(r'email-test', EmailTestViewSet, basename='email-test')

urlpatterns = [
    path('', include(router.urls)),
    path('contact-manager/', contact_manager, name='contact-manager'),
]
