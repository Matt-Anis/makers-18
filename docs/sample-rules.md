# NYXORA Company Privacy Policy & Rules

## Privacy Rulebook (SLM Instructions)
- Flag all internal project codenames, M&A target companies, unreleased product names, and non-public contract valuations.
- Flag Algerian tax identifiers (NIF, NIS, RC), national ID numbers, bank IBAN/RIB details, and private employee emails or phone numbers.
- Do not mask generic legal terms, clause numbers, or standard contract dates unless tied to a date of birth.

## Custom Rules
- APOLLO-X | CUSTOM
- PROJECT-ZENITH | CUSTOM
- `\bDZ-\d{4,6}\b` | ID | regex
- `\bNIF[:\s-]*\d{15}\b` | ID | regex
- Atlas Tech SARL | COMPANY
