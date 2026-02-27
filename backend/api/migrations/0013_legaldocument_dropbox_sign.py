# Generated migration: rename DocuSign fields to Dropbox Sign

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_property_furnishing_type_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='legaldocument',
            old_name='docusign_envelope_id',
            new_name='dropbox_sign_signature_request_id',
        ),
        migrations.RenameField(
            model_name='legaldocument',
            old_name='docusign_signing_url',
            new_name='dropbox_sign_signing_url',
        ),
    ]
