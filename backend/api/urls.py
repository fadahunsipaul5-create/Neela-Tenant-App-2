from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TenantViewSet, PaymentViewSet, MaintenanceRequestViewSet,
    LegalDocumentViewSet, ListingViewSet, PropertyViewSet, LeaseTemplateViewSet,
    OperatingExpenseViewSet, PropertyUnitViewSet,
    ShortStayBookingViewSet,
    ShortStayBlockedDateViewSet,
    EmailTestViewSet,
    contact_manager,
    sign_lease_by_token,
    manager_me,
)

router = DefaultRouter()
router.register(r'tenants', TenantViewSet, basename='tenant')
router.register(r'payments', PaymentViewSet)
router.register(r'maintenance', MaintenanceRequestViewSet)
router.register(r'legal-documents', LegalDocumentViewSet)
router.register(r'lease-templates', LeaseTemplateViewSet)
router.register(r'listings', ListingViewSet)
router.register(r'properties', PropertyViewSet)
router.register(r'operating-expenses', OperatingExpenseViewSet, basename='operating-expense')
router.register(r'property-units', PropertyUnitViewSet, basename='property-unit')
router.register(r'short-stay-bookings', ShortStayBookingViewSet, basename='short-stay-booking')
router.register(r'short-stay-blocks', ShortStayBlockedDateViewSet, basename='short-stay-block')
router.register(r'email-test', EmailTestViewSet, basename='email-test')

urlpatterns = [
    path('', include(router.urls)),
    path('manager/me/', manager_me, name='manager-me'),
    path('contact-manager/', contact_manager, name='contact-manager'),
    path('sign-lease/', sign_lease_by_token, name='sign-lease-by-token'),
]
