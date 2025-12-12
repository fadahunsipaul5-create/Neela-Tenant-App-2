from django.core.management.base import BaseCommand
from api.models import LeaseTemplate

class Command(BaseCommand):
    help = 'Seeds the database with the Wills Lease Packet template'

    def handle(self, *args, **kwargs):
        content = """LEASE APPLICATION PACKET

Please submit the attached completed lease application:
with a copy of all applicant's photo ID's
proof of income
proof of employment
and current email addresses and phone numbers
to:

Will Reschke via:

Email: reschke_will@yahoo.com

Or call @ 346-255-6143 = Will

to arrange dropping all pages to the office.
For faster processing.

Thank you,

Will
346-255-6143

----------------------------------------------------------------------------------
Received on __________________ (date) at __________________ (time)

TEXAS ASSOCIATION OF REALTORS®
RESIDENTIAL LEASE APPLICATION

Each occupant and co-applicant 18 years or older must submit a separate application.

Property Address: {{property_unit}}
Anticipated Move-in Date: {{move_in_date}}
Initial Lease Term Requested: __________ (months)
Monthly Rent: ${{rent_amount}}
Security Deposit: ${{deposit_amount}}

Property Condition: Applicant is strongly encouraged to view the Property prior to submitting any application. Landlord makes no express or implied warranties as to the Property's condition. Applicant requests Landlord consider the following repairs or treatments should Applicant and Landlord enter into a lease:
__________________________________________________________________________________

Applicant was referred to Landlord by:
[ ] Real estate agent __________________ (name) __________________ (phone) __________________ (e-mail)
[ ] Newspaper  [ ] Sign  [ ] Internet  [ ] Other __________________

Applicant's name (first, middle, last): {{tenant_name}}
Is there a co-applicant? [ ] yes [ ] no  If yes, co-applicant must submit a separate application.
Applicant's former last name (maiden or married): __________________

E-mail: {{tenant_email}}
Work Phone: __________________
Home Phone: __________________
Mobile/Pager: {{tenant_phone}}
Soc. Sec. No.: __________________
Driver License No.: __________________ in ______ (state)
Date of Birth: __________________
Height: ______ Weight: ______
Hair Color: ______ Eye Color: ______
Marital Status: __________________ Citizenship: ______ (country)

Emergency Contact: (Do not insert the name of an occupant or co-applicant.)
Name: ___________________________________
Address: ___________________________________
Phone: __________________ E-mail: __________________

Name all other persons who will occupy the Property:
Name: ______________________ Relationship: _______________ Age: ______
Name: ______________________ Relationship: _______________ Age: ______
Name: ______________________ Relationship: _______________ Age: ______
Name: ______________________ Relationship: _______________ Age: ______

Applicant's Current Address:
{{tenant_current_address}}
Apt. No. ______
(city, state, zip)
Landlord or Property Manager's Name: ___________________________________
Phone: Day: _______________ Nt: _______________ Mb: _______________ Fax: _______________
Email: ___________________________________
Date Moved-In: __________________ Move-Out Date: __________________ Rent $: __________
Reason for move: ______________________________________________________________________

Applicant's Previous Address:
__________________________________________________________________________________
Apt. No. ______
(city, state, zip)
Landlord or Property Manager's Name: ___________________________________
Phone: Day: _______________ Nt: _______________ Mb: _______________ Fax: _______________
Email: ___________________________________
Date Moved-In: __________________ Move-Out Date: __________________ Rent $: __________
Reason for move: ______________________________________________________________________

Applicant's Current Employer: {{employer}}
Address: ______________________________________________________________________
Supervisor's Name: __________________ Phone: __________________ Fax: __________________
E-mail: __________________
Start Date: __________________ Gross Monthly Income: ${{monthly_income}} Position: {{job_title}}

Note: If Applicant is self-employed, Landlord may require one or more previous year's tax return attested by a CPA, attorney, or other tax professional.

Applicant's Previous Employer:
Address: ______________________________________________________________________
Supervisor's Name: __________________ Phone: __________________ Fax: __________________
E-mail: __________________
Employed from __________________ to __________________
Gross Monthly Income: $__________ Position: __________________

Describe other income Applicant wants considered: ___________________________________

List all vehicles to be parked on the Property:
Type      Year      Make      Model      License Plate No./State      Mo.Pymnt.
_______   ______    ______    ______     _______________________      __________
_______   ______    ______    ______     _______________________      __________

Will any pets (dogs, cats, birds, reptiles, fish, and other pets) be kept on the Property? [ ] yes [ ] no
If yes, list all pets to be kept on the Property:
Type & Breed      Name      Color     Weight    Age      Gender    Neutered?    Declawed?    Shots Current?
______________    ______    ______    ______    ___      ______    [ ]Y [ ]N    [ ]Y [ ]N    [ ]Y [ ]N
______________    ______    ______    ______    ___      ______    [ ]Y [ ]N    [ ]Y [ ]N    [ ]Y [ ]N

Will any waterbeds or water-filled furniture be on the Property? [ ] Yes [ ] No
Does anyone who will occupy the Property smoke? [ ] Yes [ ] No
Will Applicant maintain renter's insurance? [ ] Yes [ ] No
Is Applicant or Applicant's spouse, even if separated, in military? [ ] Yes [ ] No
If yes, is the military person serving under orders limiting the military person's stay to one year or less? [ ] Yes [ ] No

Has Applicant ever:
been evicted? [ ] Yes [ ] No
been asked to move out by a landlord? [ ] Yes [ ] No
breached a lease or rental agreement? [ ] Yes [ ] No
filed for bankruptcy? [ ] Yes [ ] No
lost property in a foreclosure? [ ] Yes [ ] No
had any credit problems, including any outstanding debt (e.g., student loans or medical bills), slow-pays or delinquencies? [ ] Yes [ ] No
been convicted of a crime? [ ] Yes [ ] No If yes, provide the location, year, and type of conviction below.
Is any occupant a registered sex offender? [ ] Yes [ ] No If yes, provide the location, year, and type of conviction below.
Is there additional information Applicant wants considered? ___________________________________

Additional comments: ______________________________________________________________________

Authorization: Applicant authorizes Landlord and Landlord's agent, at any time before, during, or after any tenancy, to:
(1) obtain a copy of Applicant's credit report;
(2) obtain a criminal background check related to Applicant and any occupant; and
(3) verify any rental or employment history or verify any other information related to this application with persons knowledgeable of such information.

Notice of Landlord's Right to Continue to Show the Property: Unless Landlord and Applicant enter into a separate written agreement otherwise, the Property remains on the market until a lease is signed by all parties and Landlord may continue to show the Property to other prospective tenants and accept another offer.

Privacy Policy: Landlord's agent or property manager maintains a privacy policy that is available upon request.

Fees: Applicant submits a non-refundable fee of $__________ to ____________________ (entity or individual) for processing and reviewing this application. Applicant [ ] submits [ ] will not submit an application deposit of $__________ to be applied to the security deposit upon execution of a lease or returned to Applicant if a lease is not executed.

Acknowledgement & Representation:
(1) Signing this application indicates that Applicant has had the opportunity to review Landlord's tenant selection criteria, which is available upon request. The tenant selection criteria may include factors such as criminal history, credit history, current income and rental history.
(2) Applicant understands that providing inaccurate or incomplete information is grounds for rejection of this application and forfeiture of any application fee and may be grounds to declare Applicant in breach of any lease the Applicant may sign.
(3) Applicant represents that the statements in this application are true and complete.

Applicant's Signature: ___________________________________
Date: __________________

For Landlord's Use:
On __________________ (name/initials) notified Applicant by [ ] phone [ ] mail [ ] e-mail [ ] fax [ ] in person that Applicant was [ ] approved [ ] not approved. Reason for disapproval: ___________________________________

----------------------------------------------------------------------------------

AUTHORIZATION TO RELEASE INFORMATION RELATED TO A RESIDENTIAL LEASE APPLICANT

I, {{tenant_name}} (Applicant), have submitted an application to lease a property located at {{property_unit}} (address, city, state, zip).

The landlord, broker, or landlord's representative is:
Will Reschke (name)
___________________________________ (address)
___________________________________ (city, state, zip)
346-255-6143 (phone)
___________________________________ (fax)
reschke_will@yahoo.com (e-mail)

I give my permission:
(1) to my current and former employers to release any information about my employment history and income history to the above-named person;
(2) to my current and former landlords to release any information about my rental history to the above-named person;
(3) to my current and former mortgage lenders on property that I own or have owned to release any information about my mortgage payment history to the above-named person;
(4) to my bank, savings and loan, or credit union to provide a verification of funds that I have on deposit to the above-named person; and
(5) to the above-named person to obtain a copy of my consumer report (credit report) from any consumer reporting agency and to obtain background information about me.

Applicant's Signature: ___________________________________
Date: __________________
"""
        template, created = LeaseTemplate.objects.get_or_create(
            name='Wills Lease Packet',
            defaults={
                'content': content,
                'is_active': True
            }
        )
        
        if not created:
            template.content = content
            template.save()
            self.stdout.write(self.style.SUCCESS('Updated "Wills Lease Packet" template'))
        else:
            self.stdout.write(self.style.SUCCESS('Created "Wills Lease Packet" template'))

