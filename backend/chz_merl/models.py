"""Coalition Health Zambia (CHZ) — PostgreSQL Domain Models (Workstreams 1–6)."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class UserRole(models.TextChoices):
    EXECUTIVE_DIRECTOR = "EXECUTIVE_DIRECTOR", "Executive Director"
    PROGRAMME_OFFICER = "PROGRAMME_OFFICER", "Programme Officer"
    MERL_LEAD = "MERL_LEAD", "MERL Lead"
    COMMS_CMS_OFFICER = "COMMS_CMS_OFFICER", "Comms & CMS Officer"
    SYSTEM_AUDITOR = "SYSTEM_AUDITOR", "System Auditor"
    IT_ADMIN = "IT_ADMIN", "IT Admin"


class RecordStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    RETURNED = "RETURNED", "Returned"
    LOCKED = "LOCKED", "Locked"
    PUBLISHED = "PUBLISHED", "Published"
    REVISION_PENDING_REPUBLISH = "REVISION_PENDING_REPUBLISH", "Revision Pending Republish"


class IndicatorCatalog(models.Model):
    code = models.CharField(max_length=32, unique=True)
    programme = models.CharField(max_length=96)
    name = models.CharField(max_length=255)
    logframe_level = models.CharField(max_length=24)  # Impact | Outcome | Output
    theory_of_change_path = models.TextField()
    definition = models.TextField()
    unit_label = models.CharField(max_length=64)
    direction = models.CharField(max_length=24, default="HIGHER_IS_BETTER")
    baseline_value = models.DecimalField(max_digits=6, decimal_places=2)
    baseline_year = models.CharField(max_length=8)
    default_target = models.DecimalField(max_digits=6, decimal_places=2)
    frequency = models.CharField(max_length=24, default="Quarterly")
    owner = models.CharField(max_length=128)
    data_source = models.CharField(max_length=255)
    verification_method = models.CharField(max_length=255)


class MerlRecord(models.Model):
    record_id = models.CharField(max_length=32, unique=True)
    indicator = models.ForeignKey(IndicatorCatalog, on_delete=models.PROTECT)
    province = models.CharField(max_length=32)
    quarter = models.CharField(max_length=16)
    numerator = models.PositiveIntegerField()
    denominator = models.PositiveIntegerField()
    target_rate = models.DecimalField(max_digits=5, decimal_places=1)
    status = models.CharField(max_length=32, choices=RecordStatus.choices, default=RecordStatus.DRAFT)
    published_version = models.CharField(max_length=16, default="v1.0")
    evidence_vault_key = models.CharField(max_length=255)  # Private S3 object key, never public
    evidence_sha256 = models.CharField(max_length=64)
    field_notes = models.TextField(blank=True)
    merl_notes = models.TextField(blank=True)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    locked_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    locked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(check=models.Q(denominator__gt=0), name="merl_den_gt_zero"),
            models.CheckConstraint(check=models.Q(numerator__lte=models.F("denominator")), name="merl_num_lte_den"),
            models.UniqueConstraint(
                fields=["indicator", "province", "quarter"],
                condition=~models.Q(status=RecordStatus.RETURNED),
                name="unique_active_reporting_period",
            ),
        ]

    def clean(self):
        if self.numerator > self.denominator:
            raise ValidationError("Numerator cannot exceed Denominator.")


class DisaggregationRow(models.Model):
    record = models.ForeignKey(MerlRecord, on_delete=models.CASCADE, related_name="disaggregations")
    district = models.CharField(max_length=64)
    stratum = models.CharField(max_length=64)
    numerator = models.PositiveIntegerField()
    denominator = models.PositiveIntegerField()


class PublishedCmsSnapshot(models.Model):
    """Read-only synchronized publication store backing coalitionhealth.org.zm."""
    record = models.OneToOneField(MerlRecord, on_delete=models.PROTECT)
    version = models.CharField(max_length=16)
    aggregate_numerator = models.PositiveIntegerField()
    aggregate_denominator = models.PositiveIntegerField()
    etag = models.CharField(max_length=64)
    published_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)  # False = instant withdrawal


class AuditEvent(models.Model):
    """Append-only SHA-256 chained audit trail (DB trigger blocks UPDATE/DELETE)."""
    event_id = models.CharField(max_length=32, unique=True)
    created_at_cat = models.CharField(max_length=32)
    actor = models.CharField(max_length=128)
    role = models.CharField(max_length=32, choices=UserRole.choices)
    record_id = models.CharField(max_length=64)
    category = models.CharField(max_length=32)
    action = models.CharField(max_length=64)
    details = models.TextField()
    prev_hash = models.CharField(max_length=64)
    chain_hash = models.CharField(max_length=64)
