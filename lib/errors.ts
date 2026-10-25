export class NotFoundError extends Error {
  status = 404;
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
}

export class CrossTenantViolationError extends Error {
  status = 403;
  constructor(message = "Cross-tenant access violation: referenced entity does not belong to your organization.") {
    super(message);
    this.name = "CrossTenantViolationError";
    this.status = 403;
  }
}

export class DoubleBookingConflictError extends Error {
  status = 409;
  constructor(message = "The selected room is already booked for the requested dates.") {
    super(message);
    this.name = "DoubleBookingConflictError";
    this.status = 409;
  }
}

export class InvalidPaymentAmountError extends Error {
  status = 400;
  constructor(message = "Payment amount must be greater than zero.") {
    super(message);
    this.name = "InvalidPaymentAmountError";
    this.status = 400;
  }
}

export class InvoiceAlreadySettledError extends Error {
  status = 400;
  constructor(message = "Invoice is already fully settled.") {
    super(message);
    this.name = "InvoiceAlreadySettledError";
    this.status = 400;
  }
}

export class OverpaymentNotAllowedError extends Error {
  status = 400;
  constructor(message = "Payment amount exceeds the remaining invoice balance.") {
    super(message);
    this.name = "OverpaymentNotAllowedError";
    this.status = 400;
  }
}

export class InvalidRefundStateError extends Error {
  status = 400;
  constructor(message = "Refund cannot be processed in the current state.") {
    super(message);
    this.name = "InvalidRefundStateError";
    this.status = 400;
  }
}

export class RefundExceedsPaymentError extends Error {
  status = 400;
  constructor(message = "Refund amount cannot exceed the eligible payment balance.") {
    super(message);
    this.name = "RefundExceedsPaymentError";
    this.status = 400;
  }
}

export class WebhookSignatureVerificationError extends Error {
  status = 400;
  constructor(message = "Invalid or missing webhook signature.") {
    super(message);
    this.name = "WebhookSignatureVerificationError";
    this.status = 400;
  }
}

export class DirectStatusOverrideForbiddenError extends Error {
  status = 400;
  constructor(message = "Invoices can only transition to 'paid' via verified gateway webhooks or recorded reconciled payments.") {
    super(message);
    this.name = "DirectStatusOverrideForbiddenError";
    this.status = 400;
  }
}
