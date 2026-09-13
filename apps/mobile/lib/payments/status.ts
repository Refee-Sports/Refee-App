export function paymentNeedsReview(
  paymentStatus: string | null | undefined,
  reviewRequired: boolean | null | undefined
): boolean {
  return reviewRequired === true || paymentStatus === "refunded" || paymentStatus === "disputed";
}

export function canOfferCrewPayment(args: {
  isClosed: boolean;
  paymentStatus: string | null | undefined;
  reviewRequired: boolean | null | undefined;
  acceptedCrewCount: number;
}): boolean {
  return (
    args.isClosed &&
    args.acceptedCrewCount > 0 &&
    args.paymentStatus !== "paid" &&
    !paymentNeedsReview(args.paymentStatus, args.reviewRequired)
  );
}
