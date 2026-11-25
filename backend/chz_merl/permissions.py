"""Least-privilege 6-role RBAC & MFA Step-Up enforcement for CHZ Django REST API."""
from rest_framework.permissions import BasePermission

ROLE_PERMISSIONS = {
    "EXECUTIVE_DIRECTOR": {"executive_export", "audit_export", "donor_manage", "knowledge_manage", "timeline_signoff"},
    "PROGRAMME_OFFICER": {"field_intake", "vault_upload", "executive_export"},
    "MERL_LEAD": {
        "field_intake",
        "vault_upload",
        "merl_approve_lock",
        "merl_return_draft",
        "traceable_revision",
        "executive_export",
        "internal_unredacted_export",
        "audit_export",
        "donor_manage",
        "knowledge_manage",
        "sensitive_cohort_view",
        "timeline_signoff",
    },
    "COMMS_CMS_OFFICER": {"dpa_cms_publish", "executive_export", "knowledge_manage"},
    "SYSTEM_AUDITOR": {"executive_export", "internal_unredacted_export", "audit_export", "sensitive_cohort_view"},
    "IT_ADMIN": {"audit_export", "system_admin_backup", "timeline_signoff"},
}

PRIVILEGED_ROLES = {"EXECUTIVE_DIRECTOR", "MERL_LEAD", "COMMS_CMS_OFFICER", "SYSTEM_AUDITOR", "IT_ADMIN"}


class HasChzPermission(BasePermission):
    """DRF permission requiring both explicit role grant and verified MFA on privileged roles."""

    required_permission: str = ""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        role = getattr(user, "chz_role", "")
        if role in PRIVILEGED_ROLES and not getattr(user, "is_verified", lambda: False)():
            return False
        perm = getattr(view, "required_permission", self.required_permission)
        return perm in ROLE_PERMISSIONS.get(role, set())
