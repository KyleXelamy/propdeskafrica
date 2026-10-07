/**
 * Shared types for the templates module.
 */

export interface DocxTemplateInput {
  // Common
  landlordName?: string
  landlordAddress?: string
  landlordId?: string
  tenantName?: string
  tenantId?: string
  tenantPhone?: string
  propertyName?: string
  propertyAddress?: string

  // Lease
  leaseStart?: string
  leaseEnd?: string
  rentAmount?: string
  deposit?: string

  // Receipt
  periodCovered?: string
  amountPaid?: string
  paymentMethod?: string
  reference?: string

  // Key handover
  handoverDate?: string

  // Inspection
  inspectionDate?: string
  inspectionType?: "Move-in" | "Move-out"

  // Maintenance
  category?: string
  priority?: string
  description?: string
  preferredTime?: string
  requestDate?: string

  // Termination
  terminationDate?: string
  reason?: string

  // Rent increase
  currentRent?: string
  newRent?: string
  effectiveDate?: string

  // Complaint
  incidentDate?: string
}

export interface TemplateMeta {
  id: string
  title: string
  description: string
  category: string
  pages: number
  fields: string[]
}
