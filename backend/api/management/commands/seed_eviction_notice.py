from django.core.management.base import BaseCommand
from api.models import LeaseTemplate

class Command(BaseCommand):
    help = 'Seeds the database with the Texas 3-Day Notice to Pay or Quit template'

    def handle(self, *args, **kwargs):
        content = """EVICTION NOTICE TO PAY OR QUIT

FROM:
{{landlord_name}} ("Landlord")
ADDRESS:
{{landlord_address}}
DATE OF NOTICE:
{{current_date}}

TO:
{{tenant_name}} and all occupants ("Tenant")
PROPERTY ADDRESS:
{{property_unit}}, {{property_city_state_zip}} ("Rental Premises")

Dear Tenant:

PLEASE TAKE NOTICE that you owe the amount calculated below for PAST DUE RENT under the lease agreement entered into on {{lease_start_date}}, between you and your Landlord for the Rental Premises (the "Lease"). The rent owed pertains to the rental period from {{period_start_date}} to {{period_end_date}}, and the total past due rent amount is calculated as follows:

Rent Due: ${{rent_amount}}
Late Fees: $__________
Other Fees: $__________

Total Amount Due: $__________

You are hereby given 3 days' notice to pay the total amount stated above for past due rent.

Payment Instructions: Cash, Zelle, money order, cashiers check

You are required to pay the amount due within the specified notice period or surrender possession of the Rental Premises to your Landlord. If you fail to comply, your Landlord may commence a summary eviction proceeding against you to recover possession of the Rental Premises.

Landlord Signature: ___________________________________
Print Name: {{landlord_name}}
Address: {{landlord_address}}
Telephone: {{landlord_phone}}
E-Mail: {{landlord_email}}
Date: __________________

----------------------------------------------------------------------------------

AFFIDAVIT OF SERVICE

County of Harris
State of Texas
Date: __________________

1. SERVER. I, ___________________________________ ("Server"), declare under penalty of perjury that a notice for eviction was delivered and served in the following manner:

2. RECIPIENT. The notice for eviction was delivered to:

Defendant/Respondent:
{{tenant_name}}
Address/Location:
{{property_unit}}, {{property_city_state_zip}}
Date: __________________ Time: ______ [ ] AM [ ] PM

3. DELIVERY. The Recipient received the eviction notice by: (check one)

[ ] - Mail. The Server sent the eviction notice in the mail by: (check one)
    [ ] - Standard Mail
    [ ] - Certified Mail (with return receipt)
    [ ] - FedEx
    [ ] - UPS
    [ ] - Other __________________

[ ] - Direct Service. The Server handed the eviction notice to a person identified as the Recipient.

[ ] - Someone at the Residence. The Server handed the eviction notice to someone who identified as living at the residence and stated their name is: ___________________________________

[ ] - Someone at the Workplace. The Server handed the eviction notice to someone who identified to be the Recipient's co-worker and stated their name is: ___________________________________

[ ] - Leaving at the Residence. The Server left the eviction notice in the following area:
______________________________________________________________________

[ ] - Recipient Rejected Delivery. The Server delivered the eviction notice to the Recipient in-person and did not accept delivery.

[ ] - Other. ______________________________________________________________________

4. VERIFICATION. I declare under penalty of perjury under the laws located in this State that the foregoing is true and correct.

Server Signature: ___________________________________
Print Name: ___________________________________
Date: __________________
"""
        template, created = LeaseTemplate.objects.get_or_create(
            name='Texas 3-Day Notice to Pay or Quit',
            defaults={
                'content': content,
                'is_active': True
            }
        )
        
        if not created:
            template.content = content
            template.save()
            self.stdout.write(self.style.SUCCESS('Updated "Texas 3-Day Notice to Pay or Quit" template'))
        else:
            self.stdout.write(self.style.SUCCESS('Created "Texas 3-Day Notice to Pay or Quit" template'))

