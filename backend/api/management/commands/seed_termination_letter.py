from django.core.management.base import BaseCommand
from api.models import LeaseTemplate
from datetime import datetime, timedelta

class Command(BaseCommand):
    help = 'Seeds the database with the Texas Lease Termination Letter template'

    def handle(self, *args, **kwargs):
        content = """LEASE TERMINATION LETTER

Dear {{tenant_name}} and all occupants,

I/We, {{landlord_name}}, am your Landlord for the Property located at {{property_unit}}, {{property_city_state_zip}} and this letter represents official notice to terminate the tenancy for the lease signed on {{lease_start_date}} of which there was a Security Deposit placed in the amount of {{deposit_amount}}.

{{tenant_name}} and all occupants, along with possessions, shall be required to vacate the Property by {{move_out_deadline}}.

Please respond to us by email at {{landlord_email}} or by phone at {{landlord_phone}} to obtain your new mailing address on where to send the Security Deposit. On the last day of this notice a move-out inspection shall be performed to view the condition of the Property. It is recommended that all parties involved be present to lessen the likelihood of any potential deductions to the Security Deposit.

Landlord's Signature: ___________________________________
{{landlord_name}}
Date: __________________

----------------------------------------------------------------------------------

Certificate of Service

I certify that on __________________ (date), a copy of this Termination Letter was served on {{tenant_name}} and all occupants at the indicated address by:

[ ] - Delivering it personally to the person in possession.
[ ] - Delivering it at the leased premises to a person at least 16 years old who resides in or occupies the dwelling.
[ ] - Delivering at the leased premises by affixing the notice to vacate to the inside of the main entry door of the dwelling.
[ ] - Both first-class mail and certified mail, return receipt requested.
[ ] - Other: ___________________________________

Signature of Deliverer: ___________________________________
Date: __________________
"""
        template, created = LeaseTemplate.objects.get_or_create(
            name='Texas Lease Termination Letter',
            defaults={
                'content': content,
                'is_active': True
            }
        )
        
        if not created:
            template.content = content
            template.save()
            self.stdout.write(self.style.SUCCESS('Updated "Texas Lease Termination Letter" template'))
        else:
            self.stdout.write(self.style.SUCCESS('Created "Texas Lease Termination Letter" template'))

