export class DuplicateSupplierDocumentError extends Error {
  constructor(message: string = 'Duplicate supplier document') {
    super(message);
    this.name = 'DuplicateSupplierDocumentError';
  }
}

export class ImmutablePurchaseOrderError extends Error {
  constructor(message: string = 'Purchase order is immutable') {
    super(message);
    this.name = 'ImmutablePurchaseOrderError';
  }
}

export class ImmutableHistoricalRecordError extends Error {
  constructor(message: string = 'Immutable historical record') {
    super(message);
    this.name = 'ImmutableHistoricalRecordError';
  }
}

export class InvalidProcurementNumericValueError extends Error {
  constructor(message: string = 'Invalid numeric value') {
    super(message);
    this.name = 'InvalidProcurementNumericValueError';
  }
}

export class ProcurementSequenceError extends Error {
  constructor(message: string = 'Procurement sequence error') {
    super(message);
    this.name = 'ProcurementSequenceError';
  }
}
