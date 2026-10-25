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
