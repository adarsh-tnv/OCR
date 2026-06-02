import type { ExtractionProfile } from "./schemas.js";

export const DEFAULT_EXTRACTION_PROFILES = [
  {
    category: "iso_certificate",
    label: "ISO certificate",
    description: "Certificate body, certified entity, standard, scope, and registration dates.",
    fields: [
      {
        key: "donor_certification_body_name",
        label: "Name of Donor CB",
        description:
          "The certification body/company that issued the certificate. This is the issuer CB, not the certified entity/client.",
        mandatory: true,
        aliases: ["certification body", "issuing certification body", "donor cb", "issued by", "certified by", "issuer"]
      },
      {
        key: "donor_certification_body_email",
        label: "Email ID of Donor CB",
        description:
          "Email address of the certification body/company that issued the certificate. Do not use the certified entity email.",
        mandatory: false,
        aliases: ["certification body email", "issuer email", "donor cb email", "email"]
      },
      {
        key: "donor_certification_body_address",
        label: "Address of Donor CB",
        description:
          "Registered or office address of the certification body/company that issued the certificate. Do not use the certified entity address.",
        mandatory: false,
        aliases: ["certification body address", "issuer address", "donor cb address", "registered office"]
      },
      {
        key: "certified_entity_name",
        label: "Certified Entity Name",
        mandatory: true,
        aliases: ["organization name", "certified company", "client name"]
      },
      {
        key: "certified_entity_address",
        label: "Address of Certified Entity",
        description:
          "Address printed for the certified entity/client. This may also be the certification site address when no separate site address is listed.",
        mandatory: true,
        aliases: ["organization address", "client address", "site address"]
      },
      {
        key: "certification_site_address",
        label: "Certification Site Address",
        description:
          "Address of the site covered by the certification. If no separate certification site is printed, use the certified entity address.",
        mandatory: false,
        aliases: ["certification site address", "site address", "certified site address", "site", "locations", "certification location"]
      },
      {
        key: "certificate_number",
        label: "Certificate Number",
        mandatory: true,
        aliases: ["registration number", "certificate no", "cert no"]
      },
      {
        key: "initial_registration_date",
        label: "Initial Registration Date",
        description:
          "Date shown as initial registration, initial certification, or initial issue date.",
        mandatory: true,
        aliases: ["initial certification date", "initial issue date", "initial registration", "initial certification"]
      },
      {
        key: "original_registration_date",
        label: "Original Registration Date",
        description:
          "The date the certificate was first issued or first registered. It may be titled Original Issue Date, Original Certification Date, First Issue Date, Initial Registration Date, Initial Certification Date, or similar. If only an initial registration/certification/issue date is printed, use that date here.",
        mandatory: true,
        aliases: [
          "original certification date",
          "original issue date",
          "first issue date",
          "first certification date",
          "first registration date",
          "initial registration date",
          "initial certification date",
          "initial issue date"
        ]
      },
      {
        key: "current_issue_date",
        label: "Current Issue Date",
        mandatory: true,
        aliases: ["issue date", "current certification date"]
      },
      {
        key: "expiry_date",
        label: "Expiry Date",
        description:
          "The certificate validity end date. It may be titled Validity of this Certificate, Valid until, Valid to, Expiry Date, Expiration Date, or Recertification due date. Prefer the validity date over other unrelated dates.",
        mandatory: true,
        aliases: [
          "validity of this certificate",
          "validity date",
          "valid until",
          "valid to",
          "expiration date",
          "expiry date",
          "recertification due date",
          "recertification due on"
        ]
      },
      {
        key: "first_surveillance_date",
        label: "1st Surveillance Date",
        description:
          "First surveillance audit/date if printed. It may be titled 1st Surveillance Date, First Surveillance Date, Surveillance 1, or Surveillance Audit 1.",
        mandatory: false,
        aliases: ["1st surveillance date", "first surveillance date", "surveillance 1", "surveillance audit 1"]
      },
      {
        key: "second_surveillance_date",
        label: "2nd Surveillance Date",
        description:
          "Second surveillance audit/date if printed. It may be titled 2nd Surveillance Date, Second Surveillance Date, Surveillance 2, or Surveillance Audit 2.",
        mandatory: false,
        aliases: ["2nd surveillance date", "second surveillance date", "surveillance 2", "surveillance audit 2"]
      },
      {
        key: "scope_of_certificate",
        label: "Scope of Certificate",
        mandatory: true,
        aliases: ["scope", "scope of certification"]
      },
      {
        key: "standard_name",
        label: "Standard Name",
        mandatory: true,
        aliases: ["standard", "certification standard"]
      },
      {
        key: "standard_code",
        label: "Standard Code",
        mandatory: false,
        aliases: ["iso code", "standard clause"]
      }
    ],
    checkpoints: [
      {
        key: "mandatory_fields_present",
        label: "Mandatory fields present",
        mandatory: true,
        description: "Every profile field marked mandatory has a supported extracted value."
      },
      {
        key: "date_sequence_valid",
        label: "Date sequence valid",
        mandatory: true,
        description: "Registration/issue dates should not be after the expiry date."
      },
      {
        key: "standard_identified",
        label: "Standard identified",
        mandatory: true,
        description: "The document includes a recognized standard name."
      }
    ]
  },
  {
    category: "company_registration",
    label: "Company registration certificate",
    description: "Government or authority-issued company registration details.",
    fields: [
      {
        key: "issuing_authority_name",
        label: "Issuing Authority Name",
        mandatory: true,
        aliases: ["registrar", "authority", "issuing office"]
      },
      {
        key: "entity_detail",
        label: "Entity Detail",
        mandatory: false,
        aliases: ["entity type", "legal form"]
      },
      {
        key: "entity_name",
        label: "Name Of the Entity",
        mandatory: true,
        aliases: ["company name", "legal name", "name of entity"]
      },
      {
        key: "trading_name",
        label: "Trading Name",
        mandatory: false,
        aliases: ["trade name", "business name"]
      },
      {
        key: "address",
        label: "Address",
        mandatory: true,
        aliases: ["registered address", "principal place of business"]
      },
      {
        key: "registration_number",
        label: "Registration Number",
        mandatory: true,
        aliases: ["company number", "license number", "registration no"]
      },
      {
        key: "registration_date",
        label: "Registration Date",
        mandatory: true,
        aliases: ["incorporation date", "date of registration"]
      },
      {
        key: "renewal_or_expiry_date",
        label: "Renewal Date / Expiry Date",
        mandatory: false,
        aliases: ["expiry date", "renewal date", "valid until"]
      },
      {
        key: "authorized_person_name",
        label: "Name of Authorized Person",
        mandatory: false,
        aliases: ["authorized signatory", "director", "representative"]
      },
      {
        key: "authorized_person_designation",
        label: "Authorized Person Designation",
        mandatory: false,
        aliases: ["designation", "position", "capacity"]
      },
      {
        key: "main_activity",
        label: "Main Activity",
        mandatory: false,
        aliases: ["business activity", "principal activity", "nature of business"]
      },
      {
        key: "capital_with_currency",
        label: "Capital with Currency",
        mandatory: false,
        aliases: ["share capital", "paid up capital", "capital"]
      }
    ],
    checkpoints: [
      {
        key: "mandatory_fields_present",
        label: "Mandatory fields present",
        mandatory: true,
        description: "Every profile field marked mandatory has a supported extracted value."
      },
      {
        key: "authority_identified",
        label: "Issuing authority identified",
        mandatory: true,
        description: "The registration authority is visible in the document."
      },
      {
        key: "registration_number_present",
        label: "Registration number present",
        mandatory: true,
        description: "The certificate includes a registration or company number."
      }
    ]
  }
] as const satisfies ExtractionProfile[];
