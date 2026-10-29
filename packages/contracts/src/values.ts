import * as O from './generated/operations'
export const BillingData = O.getBilling.responses[200]
export const CheckoutInput = O.createCheckout.input.fields.body
export const CreateKeyData = O.createKey.input.fields.body
export const KeysData = O.listKeys.responses[200].fields.keys
export const EmailStatusData = O.getEmailStatus.responses[200].fields.emails
export const SendTestEmailData = O.sendTestEmail.input.fields.body
export const WaitlistInput = O.joinWaitlist.input.fields.body
export const SummaryInput = O.createSummary.input.fields.body
export const SummaryData = O.createSummary.responses[200]
export const SummaryIdempotencyKey = O.createSummary.input.fields.headers.fields['idempotency-key']
export const StorefrontCreateData = O.createStorefrontCheckout.input.fields.body
export const StorefrontCheckData = O.checkStorefrontCheckout.input.fields.body
export const FileKey = O.headFile.input.fields.params.fields.key
export const FileQuery = O.listFiles.input.fields.query

export const NewKeyData = O.createKey.responses[201].fields.key
export const AcceptedEmailData = O.sendTestEmail.responses[202].fields.email
export const FileInfoData = O.listFiles.responses[200].fields.files.value

export const FileUploadLimit = O.uploadFile.maxBodyBytes
