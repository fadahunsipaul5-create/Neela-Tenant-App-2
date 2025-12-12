from django.core.management.base import BaseCommand
from api.models import LeaseTemplate

class Command(BaseCommand):
    help = 'Seeds the database with the Standard Texas Residential Lease Agreement'

    def handle(self, *args, **kwargs):
        content = """STANDARD RESIDENTIAL LEASE AGREEMENT

I. THE PARTIES. This residential lease agreement ("Agreement"), dated {{current_date}}, by and between:
LANDLORD: The Landlord is an individual known as {{landlord_name}} of {{landlord_address}}, hereinafter known as the "Landlord", and
TENANT(S): An individual known as {{tenant_name}}, hereinafter known as the "Tenant(s)", agree to the following:

II. OCCUPANT(S). The Premises described in Section III is to be occupied strictly as a residential dwelling by the Tenant(s) and the following Occupants to reside on the Premises in addition to the Tenant(s) mentioned above: {{occupants}} (collectively, the "Occupant(s)").

III. LEASED PREMISES. The Landlord hereby rents to the Tenant(s), subject to the terms and conditions of this Agreement, a single-family home with a property and mailing address of {{property_unit}}, consisting of {{bedrooms}} bedroom(s) and {{bathrooms}} bathroom(s) (the "Premises"). The Landlord shall send the Tenant(s) any notices to the Premises' aforesaid mailing address.

IV. PURPOSE. The Tenant(s) and any Occupant(s) may only use the Premises as a residential dwelling. It may not be used for storage, manufacturing of any type of food or product, professional service(s), or for any commercial use, unless otherwise stated in this Agreement.

V. FURNISHINGS. The Premises is not furnished.

VI. APPLIANCES. The Landlord shall provide the following appliances:
Air Conditioner Equipment, Hot Water Heater, Lighting Fixtures, Oven, Refrigerator, Smoke Detector(s), Stove, Thermostats and Controls, all of which shall be on the Premises and functional upon the move-in date of the Tenant(s) ("Appliances and Fixtures").
Any damage caused to the Appliances and Fixtures from negligence, carelessness, accidents, or abuse shall be the responsibility of the Tenant(s).

VII. LEASE TERM. The term of this Agreement shall be a fixed-period arrangement beginning on {{lease_start_date}} and ending on {{lease_end_date}} ("Lease Term"). The Tenant(s) shall have the option to continue occupying the Premises, under the same terms and conditions of this Agreement, but under an at-will, month-to-month arrangement. The Landlord or Tenant(s) shall both retain the option to terminate said month-to-month tenancy if the Landlord or Tenant(s) notifies the other party within at least thirty (30) days or the minimum notice period authorized by state law, whichever is longer. For the Tenant(s) to continue under said month-to-month tenancy at the expiration of the Lease Term, the Landlord must be notified within sixty (60) days before the end of the Lease Term.

VIII. RENT. Tenant(s) shall pay the Landlord a monthly rent of {{rent_amount}} ("Rent"). The Rent will be due on the First (1st) of every month ("Rent Due Date"), and Rent shall be paid via the following instructions:
Cash, money order, Zelle, cashiers check

IX. NON-SUFFICIENT FUNDS (NSF CHECKS). If the Tenant(s) attempts to pay Rent with a check, electronic transaction, or through any other means authorized by this Agreement, that fails to clear the transaction of Rent funds due to non-sufficient funds ("NSF"), there shall be a fee of $55.00.

X. LATE FEE. If the Tenant(s) fails to pay Rent on the Rent Due Date, there shall be a late fee assessed by the Landlord in the amount of:
$50.00 per occurrence for each Rent payment that is late after the 3rd day following the Rent Due Date.

XI. FIRST (1ST) MONTH'S RENT. First (1st) month's Rent payment shall be due by the Tenant(s) upon the execution of this Agreement.

XII. PRE-PAYMENT. The Landlord shall not require any pre-payment of Rent by the Tenant(s).

XIII. PRORATION PERIOD. The Tenant(s) will not move into the Premises before the start of the Lease Term.

XIV. SECURITY DEPOSIT. A security deposit in the amount of {{deposit_amount}} shall be required from the Tenant(s) at the execution of this Agreement for the faithful performance of all its terms and conditions ("Security Deposit"). The Security Deposit shall be returned to the Tenant(s) within 30 days after this Agreement has terminated. The Security Deposit shall be returned in full, and in the manner prescribed by state and local laws, upon the end or termination of the Lease Term, unless the Landlord intends on imposing a claim on the Security Deposit for any damages. The Security Deposit shall not be credited towards Rent unless the Landlord gives their written consent.

XV. POSSESSION. Tenant(s) shall make reasonable efforts to examine the condition of the Premises before taking possession. Once the Tenant(s) takes possession of the Premises, the Tenant(s) acknowledges the Premises is in acceptable order and consents to take possession of the Premises in its current condition unless otherwise stated herein. Failure of the Landlord to deliver possession of the Premises to the Tenant(s) at the start of the Lease Term shall terminate this Agreement at the option of the Tenant(s). Furthermore, under such failure to deliver possession by the Landlord, and if the Tenant(s) opts to cancel this Agreement, any Security Deposit required under Section XIV of this Agreement shall be returned to the Tenant(s) along with any other pre-paid Rent and fees, including any fees paid by the Tenant(s) in connection with the application process before the execution of this Agreement.

XVI. OPTION TO PURCHASE. The Tenant(s) shall NOT have the right to purchase the Premises unless the Landlord and Tenant(s) agree otherwise in writing.

XVII. ACCESS. Upon the start of the Proration Period or the Lease Term, whichever is earlier, the Landlord agrees to give access to the Tenant(s) in the form of keys, fobs, cards, or any type of keyless security entry device needed to enter the Premises and any designated common areas. Duplicate copies of the access forms hereof may be authorized only under the consent of the Landlord, and, if any replacements are needed, the Landlord may provide them for a reasonable fee. At the end of this Agreement, any keys, fobs, cards, or keyless entry devices provided to the Tenant(s) shall be returned to the Landlord or a fee will be billed directly to the Tenant(s) or deducted from the Security Deposit.

XVIII. MOVE-IN INSPECTION. Before the Tenant(s) accepts possession as described in Section XV of this Agreement, or shortly thereafter if agreed upon, the Landlord and Tenant(s) shall not perform an inspection of the Premises.

XIX. SUBLETTING. The Tenant(s) shall NOT have the right to sublet the Premises or any part thereof without the prior written consent of the Landlord. If consent is granted by the Landlord, the Tenant(s) will be responsible for all actions and liabilities of the sublessee, including but not limited to any damage to the Premises, nonpayment of Rent, and eviction procedures. In the event of an eviction, the Tenant(s) shall be responsible for all court filing fees, legal representation, and any other fees associated with removing the sublessee. The express written consent from the Landlord for one sublet agreement shall not authorize consent for any subsequent sublet agreements, and in such case, the Tenant(s) must seek consent from the Landlord for the subsequent sublet agreement.

XX. ABANDONMENT. If the Tenant(s) abandons or otherwise vacates the Premises for a period equal to the minimum period set by state law or seven (7) days, whichever is less, the Landlord shall have the right to terminate this Agreement immediately and remove all personal belongings, including any personal property of the Tenant(s), from the Premises in the manner prescribed by state and local laws.

XXI. ASSIGNMENT. The Tenant(s) shall NOT assign or otherwise transfer the residential lease interest described in this Agreement without first obtaining the written consent of the Landlord. Written consent from the Landlord for one assignment shall not authorize consent for any subsequent assignments, and in such case, the Tenant(s) must seek consent from the Landlord for subsequent assignments.

XXII. PARKING RULES. The Landlord shall not provide parking to the Tenant(s).

XXIII. RIGHT OF ENTRY. The Landlord shall have the right to enter the Premises during normal working hours by providing notice in accordance with the minimum state requirements in order to conduct inspections, make necessary repairs, alterations or improvements, supply services as previously agreed, and for any other reasonable purposes. The Landlord may exhibit the Premises to prospective purchasers, mortgagees, or lessees upon reasonable notice to the Tenant(s).

XXIV. SALE OF PROPERTY. If the Premises is sold, the Tenant(s) is to be notified of the new owner and the new property manager, if any, and their contact details for repairs and maintenance shall be forwarded to the Tenant(s). If the Premises is conveyed to another party, the new owner shall have the right to terminate this Agreement.
The new owner shall have the right to terminate ONLY after providing at least 30 days' notice to the Tenant(s).

XXV. UTILITIES. The Landlord shall not pay for any of the utilities and services and will be the responsibility of the Tenant(s).

XXVI. MAINTENANCE, REPAIRS, OR ALTERATIONS. The Tenant(s) at all times shall, at their own expense unless otherwise stated in this Agreement, maintain the Premises in a clean and sanitary manner, and shall surrender the same at termination hereof, in as good condition as received, normal wear and tear excepted. The Tenant(s) may not make any alterations to the Premises without the written consent of the Landlord. The Landlord shall be responsible for structural repairs to defects in the interior and exterior of the Premises.
Further, Tenant shall:
Promptly notify Landlord of conditions at or in the Premises that are in need of repair. At all times maintain the Premises, including the appliances, furnishings, equipment, and fixtures therein, in a clean, safe, and sanitary condition. This includes maintaining appropriate climate control in order to keep the Premises clean and free of mold and mildew. Tenant shall also take necessary measures to retard and prevent mold from accumulating in the Premises. Tenant agrees to clean and dust on a regular basis and to remove visible moisture accumulation on windowsills, windows, walls, floors, ceilings, and other surfaces as soon as is reasonably possible. Tenant agrees not to block or cover any heating, ventilation, or air-conditioning ducts;
Obey all instructions, written or otherwise, of Landlord for the care and use of appliances, furnishings, equipment, and fixtures;
Use the electric, plumbing, and other systems and facilities in a safe manner;
Use no more electricity than the receptacles, wiring, or feeders to the Premises can safely carry;
Pay for all repairs, replacements, and damages caused by Tenant or Tenant's family, visitors, contractors, employees, or agents including, but not limited to, sewer and plumbing drainage problems caused by Tenant;
Pay for or perform all snow removal and lawn care at and around the Premises, unless stated otherwise in Section XXV of this Agreement;
Promptly remove from the Property all garbage and recycling and place same in the proper receptacles;
Promptly replace all broken glass in the Property and not damage, remove, or destroy screens installed at the Premises;
Not engage in any activity that may cause a cancellation or an increase in the cost of Landlord's insurance coverage;
Keep nothing at or in the Premises that is flammable, dangerous, or which might increase the danger of fire or other casualty;
Surrender the Premises in good repair and broom clean condition, reasonable wear and tear excepted, at the end of the Lease Term or other termination of this Agreement;
Consent to treatment, in the event that it becomes necessary or is deemed advisable by Landlord to use pesticides, clean, or remediate any condition in or about the Premises for the protection of Tenant, other tenants, or to protect and preserve the Premises; and
After Landlord initially places fresh batteries in all battery-operated smoke detectors before Tenant moves into the Premises, replace batteries if and when needed.

XXVII. EARLY TERMINATION. The Tenant(s) may not cancel this Agreement unless the Tenant(s) is a victim of domestic violence, and in such case, the Tenant(s) may be able to cancel in accordance with any local, state, or federal laws.

XXVIII. PETS. The Tenant(s) shall not be allowed to have pets on the Premises or common areas except those that are necessary for individuals with disabilities.

XXIX. WASTE. The Tenant(s) agrees not to commit waste on the Premises, maintain, or permit to be maintained, a nuisance thereon, or use, or permit the Premises to be used, in an unlawful manner.

XXX. NOISE. The Tenant(s) agrees to abide by any and all local, county, and state noise ordinances.

XXXI. GUESTS. There shall be no other persons living on the Premises other than any authorized Tenant(s) and Occupant(s). Guests of the Tenant(s) are allowed to visit and stay on the Premises for a period of no more than 7 days, unless the Landlord approves otherwise ("Guest(s)").

XXXII. SMOKING POLICY. Smoking on the Premises is prohibited on the entire Premises, including any common areas and adjoining properties.

XXXIII. COMPLIANCE WITH LAW. For the entire duration of the Lease Term, the Tenant(s) agrees to comply with any present and future laws, ordinances, orders, rules, regulations, and requirements of the federal, state, county, city, and municipal governments or any of their departments, bureaus, boards, commissions, and officials thereof with respect to the Premises, or the use or occupancy thereof, whether said compliance shall be ordered or directed to or against the Tenant(s), the Landlord, or both.

XXXIV. LANDLORD'S OBLIGATIONS. During the Lease Term of this Agreement, Landlord shall be responsible for the following: (a) ensuring the Premises is in compliance with all applicable federal, state, and local laws, regulations, statutes, and building and housing codes regarding safety, sanitation, and fair housing applicable to the Premises; (b) performing major structural repairs to the Premises, within a reasonable time after notice from Tenant. Tenant may be liable for the cost of such repairs if the damage is caused by Tenant's actions or the action of Tenant's family members, contractors, employees, visitors, or agents pursuant to this Agreement; and (c) making any necessary repairs and replacements to the vital facilities serving the Premises, including heating, plumbing, and electrical systems, within a reasonable time after notice from Tenant. Tenant may be liable for the cost of such repairs if the damage is caused by Tenant's actions or the action of Tenant's family members, contractors, employees, visitors, or agents pursuant to this Agreement. All Landlord's obligations are dependent upon Tenant's obligation to notify Landlord promptly of any conditions requiring Landlord's attention.
If Landlord fails to meet any of its above enumerated obligations, it may be possible for Tenant to terminate this Agreement and exercise other remedies under Texas Property Code Section 92.056. Tenant may also exercise other statutory remedies, including those enumerated in Texas Property Code Section 92.0561.
Landlord is not responsible for the following: (a) damage to or loss of Tenant's personal property; (b) the acts of other tenants, guests, or invitees; (c) performing routine maintenance at the Property, including lawn care; or (d) any personal property of Tenant remaining in the Premises after the expiration or earlier termination of this Agreement. Such personal property shall be considered to be abandoned and Landlord can either keep such personal property or have it removed at Tenant's expense.

XXXV. DEFAULT. If the Tenant(s) fails to comply with any of the financial, material, or miscellaneous provisions of this Agreement, or any present rules and regulations of the tenancy under this Agreement in general that may be hereafter prescribed by the Landlord, or materially fails to comply with any duties imposed on the Tenant(s) by statute, regulations, ordinances, orders, or any other mandates imposed by federal, state, and local governments, within the timeframe after delivery of a written notice to quit by the Landlord specifying noncompliance with this Agreement and indicating the intention of the Landlord to terminate the Agreement by reason thereof, the Landlord may terminate this Agreement. If the Tenant(s) fails to pay Rent upon the Rent Due Date, and the default continues for the timeframe specified in the written notice to quit thereafter, the Landlord may, at their option, declare the entire balance (compiling all months applicable to this Agreement) of Rent payable hereunder to be immediately due. The Landlord may exercise any and all rights and remedies available to the Landlord at law or in equity, and the Landlord may terminate this Agreement immediately by exercising the rights and remedies thereof.
The Tenant(s) shall be in default if any of the following applies: (a) Tenant(s) does not pay Rent on the Rent Due Date and after the state- or locally-mandated grace period, if any, or if the Tenant(s) fails to pay any other dues owed in accordance with respective local and state laws and this Agreement; (b) Tenant(s), Occupant(s), or any Guest(s) thereof, violate the terms and conditions of this Agreement, or any local ordinances, fire-safety or health codes, or violate any criminal laws, regardless of whether arrest or conviction occurs; (c) Tenant(s) abandons the Premises as described in Section XX of this Agreement; (d) Tenant(s) gives incorrect or false information in their rental application, if any; (e) Tenant(s), Occupant(s), or Guest(s) thereof, is arrested, convicted, or given deferred adjudication for a criminal offense involving actual or potential physical harm to a person, or involving possession, manufacture, or delivery of a controlled substance, marijuana, or drug paraphernalia under state statute; (f) any illegal drugs or paraphernalia are found in the Premises or on the person of the Tenant(s), Occupant(s), or Guest(s) thereof, while on the Premises; and (g) as otherwise allowed by local, state, and federal law.

XXXVI. MULTIPLE TENANT(S) OR OCCUPANT(S). Each individual that is considered a Tenant(s) or Occupant(s) in this Agreement is jointly and individually liable for all of this Agreement's obligations, including but not limited to Rent monies. If any Tenant(s), Occupant(s), or guests thereof, violates this Agreement, the Tenant(s) is considered to have violated this Agreement. Landlord's requests and notices to the Tenant(s) or any of the Occupant(s) of legal age constitutes notice to the Tenant(s). Notices and requests from the Tenant(s), or anyone of the Occupant(s), including repair requests and entry permissions, constitutes notice from the Tenant(s). In eviction suits, the Tenant(s) is considered the agent of the Premises for the service of process.

XXXVII. DISPUTES. If a dispute arises during or after the Lease Term between the Landlord and Tenant(s), they shall agree to hold negotiations amongst themselves in "good faith" before any litigation.

XXXVIII. SEVERABILITY. If any provision of this Agreement or the application thereof shall, for any reason and to any extent, be invalid or unenforceable, neither the remainder of this Agreement, nor the application of the provision to other persons, entities, or circumstances shall be affected thereby, but instead, shall be enforced to the maximum extent permitted by law.

XXXIX. SURRENDER OF PREMISES. The Tenant(s) has surrendered the Premises when (a) the move-out date has passed and no persons are living in the Premises within the Landlord's reasonable judgment, or (b) access to the Premises has been turned to Landlord, whichever of (a) or (b) comes first. Upon the expiration of the Lease Term, the Tenant(s) shall surrender the Premises in better or equal condition as it was at the commencement of this Agreement, albeit with reasonable use, wear- and-tear, and damages caused by the natural elements excepted.

XL. RETALIATION. The Landlord is prohibited from making any type of retaliatory acts against the Tenant(s), including, but not limited to, restricting access to the Premises, decreasing or canceling Utilities and Services, failure to repair Appliances and Fixtures, or any other deliberate acts that could be considered unjustified and retaliatory against the Tenant(s).

XLI. WAIVER. The Landlord's waiver of a breach of any covenant or duty imposed on the Tenant(s) under this Agreement shall not constitute, or be construed as, a waiver of a breach of any other covenant or duty imposed on the Tenant(s), or of any subsequent breach of the same covenant or duty. No provision, covenant, or clause of this Agreement shall be considered waived unless such a waiver is expressed in writing as a formal amendment to this Agreement and executed by the Tenant(s) and Landlord.

XLII. EQUAL OPPORTUNITY. The Landlord shall make reasonable accommodations in rules, policies, practices, and services under this Agreement for Tenant(s) or Occupant(s) with a proven record of a physical or mental "handicap" as defined in 42 U.S.C.A. §§ 3604-3607 ("Handicaps"), provided such accommodations are reasonably within the Landlord's financial and practical means. The Landlord may issue consent to the Tenant(s) to make reasonable modifications to the Premises, at the Tenant(s) expense, to afford the Tenant(s) or any Occupant(s) with Handicaps the full enjoyment of the Premises. Any Handicaps of the Tenant(s) or Occupant(s) should be disclosed and presented to the Landlord, in writing, in order to seek the most appropriate route for providing any accommodations to the Premises. Landlord shall not discriminate against the Tenant(s) with Handicaps during the course of the Lease Term or in the rental application process. Further, the Landlord shall not discriminate against the Tenant(s) during the Lease Term or in the rental application process based on race, color, national origin, religion, sex, familial status, or any other status protected by law.

XLIII. HAZARDOUS MATERIALS. The Tenant(s) agrees not to possess any type of personal property that could be considered a fire hazard on the Premises, such as a substance with highly flammable or explosive characteristics. Items prohibited from being brought into the Premises, other than for everyday cooking or those needed for operating an appliance, includes, but is not limited to, compressed gas, gasoline, fuel, propane, kerosene, motor oil, fireworks, or any other similar item or related substance in the form of a liquid, solid, or gas.

XLIV. WATERBEDS. The Tenant(s) is not permitted to furnish the Premises with waterbeds.

XLV. INDEMNIFICATION. The Landlord shall not be liable for any damage or injury to the Tenant(s), Occupant(s), any Guest(s), or any other persons, nor shall Landlord be liable for any damage to any property that occurs on the Premises, its common areas, or any part thereof, and the Tenant(s) agrees to hold the Landlord harmless from any claims or damages unless caused solely by the Landlord's negligence. It is therefore recommended Tenant(s), at their expense, purchase renter's insurance.

XLVI. COVENANTS. The covenants and conditions herein contained shall apply to and bind the heirs, legal representatives, and assigns of the parties hereto, and all covenants are to be construed as conditions of this Agreement.

XLVII. NOTICES. Any notice sent from the Landlord or the Tenant(s) to the other party shall be addressed to the underneath mailing addresses.
Landlord's Mailing Address and Contact Information:
{{landlord_name}}
{{landlord_address}}
Phone Number: {{landlord_phone}} Email: {{landlord_email}}

Tenant's(s') Mailing Address:
{{tenant_name}}
{{property_unit}}

Landlord's Agent / Property Manager: The Landlord does not have or otherwise authorize an agent or property manager, and all contact with regards to any repair, maintenance, or complaint must be communicated directly to the Landlord using the above-mentioned contact information.

XLVIII. PREMISES DEEMED UNINHABITABLE. If the Premises is deemed uninhabitable due to damages beyond reasonable repair, the Tenant(s) shall be able to terminate this Agreement by written notice to the Landlord. If said damage was caused by negligence of the Tenant(s), Occupant(s), or their Guest(s), the Tenant(s) shall be liable to the Landlord for all pertinent repairs and for the loss of income due to restoring the Premises back to a livable condition in addition to any other losses that can be proved by the Landlord.

XLIX. SERVICEMEMBERS CIVIL RELIEF ACT. In the event the Tenant(s) is currently, or hereafter becomes, a member of the United States Armed Forces on extended active duty and hereafter the Tenant(s) receives permanent change of station (PCS) orders to depart from the area where the Premises is located, or is relieved from active duty, retires or separates from the military, is ordered into military housing, or receives deployment orders, then in any of these events, the Tenant(s) may terminate this Agreement by giving thirty (30) days' written notice to the Landlord. The Tenant(s) shall also furnish unto the Landlord a copy of the official orders, or a letter signed by the commanding officer of the Tenant(s), reflecting the change that warrants termination of this Agreement under this clause. The Tenant(s) shall pay prorated Rent for any days in which the Tenant(s) occupies the Premises past the beginning of the Lease Term. Further, any Security Deposit shall be returned, deducted, or otherwise retained in accordance with Section XIV of this Agreement.

L. FAMILY VIOLENCE OR MILITARY DEPLOYMENT OR TRANSFER. In accordance with Texas law, the Tenant(s) may have special statutory rights to terminate the lease early in certain situations involving family violence or a military deployment or transfer.

LI. LEAD-BASED PAINT. The Premises was not constructed before 1978 and therefore does not contain lead-based paint.

LII. GOVERNING LAW. This Agreement shall be subject to and governed by the laws of the State of Texas.

LIII. AGENCY RELATIONSHIP. Neither the Landlord nor the Tenant(s) utilized the services of a real estate agency or a real estate agent to negotiate, draft, or execute this Agreement.

LIV. ADDITIONAL TERMS AND CONDITIONS. In addition to all the terms, conditions, covenants, and provisions of this Agreement, the Landlord and Tenant(s) agree to the following:
Landlord not responsible for any accidents on the property.
Tenant is responsible for the mini split ac remote, if lost or broken, tenant will pay landlord $100.00 to replace.
Tenant must maintain electricity in their names at all times.
No parking in the back yard!!!
Black and green trash cans out on the street every Monday morning.
No unregistered or non-working vehicles on the property at anytime, will be towed at owners expense, not the landlord.
NO PETS!!!!!!

LV. ENTIRE AGREEMENT. This Agreement contains all the terms, conditions, covenants, and provisions agreed on by the Landlord, Tenant(s), and any other relevant party to this Agreement, relating to its subject matter, including any attachments or addendums. This Agreement replaces any and all previous discussions, understandings, and oral agreements. The Landlord and Tenant(s) agree to this Agreement and shall be bound until the end of the Lease Term.

The parties have agreed and duly executed this Agreement on {{current_date}}.

Landlord's Signature: ___________________________________
{{landlord_name}}
Date: __________________

Tenant's Signature: ___________________________________
{{tenant_name}}
Date: __________________

AMOUNT ($) DUE AT SIGNING
Security Deposit: {{deposit_amount}}
First (1st) Month's Rent: {{rent_amount}}
"""
        template, created = LeaseTemplate.objects.get_or_create(
            name='Texas Standard Residential Lease',
            defaults={
                'content': content,
                'is_active': True
            }
        )
        
        if not created:
            template.content = content
            template.save()
            self.stdout.write(self.style.SUCCESS('Updated "Texas Standard Residential Lease" template'))
        else:
            self.stdout.write(self.style.SUCCESS('Created "Texas Standard Residential Lease" template'))

