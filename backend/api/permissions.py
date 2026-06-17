"""Role-based helpers for admin vs property manager access."""


def is_admin_user(user):
    return bool(user and user.is_authenticated and (user.is_staff or user.is_superuser))


def is_property_manager(user):
    return bool(
        user
        and user.is_authenticated
        and getattr(user, 'role', None) == 'property_manager'
        and not is_admin_user(user)
    )


def get_manager_property_ids(user):
    if not is_property_manager(user):
        return None
    profile = getattr(user, 'manager_profile', None)
    if not profile:
        return []
    return list(profile.properties.values_list('id', flat=True))


def filter_properties_for_user(queryset, user):
    if is_admin_user(user):
        return queryset
    property_ids = get_manager_property_ids(user)
    if property_ids is None:
        return queryset.none()
    return queryset.filter(id__in=property_ids)
