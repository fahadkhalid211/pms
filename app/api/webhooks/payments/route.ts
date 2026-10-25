import { NextResponse } from "next/server";
import { getPaymentGateway } from "@/lib/payments/gateway";
import { dal } from "@/lib/dal";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature") || request.headers.get("x-signature");
    if (!signature) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required signature header (stripe-signature or x-signature)." } },
        { status: 400 },
      );
    }

    const rawBody = await request.text();
    const webhookSecret =
      process.env.PAYMENT_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET ||
      "whsec_lumina_pms_test_key_32bytes_min";

    const gateway = getPaymentGateway();
    let event;
    try {
      event = gateway.verifyWebhookSignature(rawBody, signature, webhookSecret);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: { message: err?.message ?? "Webhook signature verification failed." } },
        { status: 400 },
      );
    }

    // Process verified event
    const { metadata } = event.data;
    const organizationId = metadata?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { message: "Event metadata missing organizationId." } },
        { status: 400 },
      );
    }

    if (event.type === "payment_intent.succeeded") {
      const invoiceId = metadata?.invoiceId;
      const reservationId = metadata?.reservationId;
      const propertyId = metadata?.propertyId;

      const payment = await dal.payments.create(
        { organizationId },
        {
          invoiceId,
          reservationId,
          propertyId,
          amount: event.data.amount,
          currency: event.data.currency,
          status: "captured",
          method: "card",
          provider: gateway.providerName,
          providerRef: event.data.id,
        },
      );

      return NextResponse.json({
        success: true,
        received: true,
        event: event.type,
        paymentId: payment.id,
      });
    }

    if (event.type === "payment_intent.payment_failed") {
      const invoiceId = metadata?.invoiceId;
      const reservationId = metadata?.reservationId;
      const propertyId = metadata?.propertyId;

      const payment = await dal.payments.create(
        { organizationId },
        {
          invoiceId,
          reservationId,
          propertyId,
          amount: event.data.amount,
          currency: event.data.currency,
          status: "failed",
          method: "card",
          provider: gateway.providerName,
          providerRef: event.data.id,
        },
      );

      return NextResponse.json({
        success: true,
        received: true,
        event: event.type,
        paymentId: payment.id,
      });
    }

    return NextResponse.json({
      success: true,
      received: true,
      event: event.type,
    });
  } catch (error: any) {
    const status = error?.status ?? 400;
    return NextResponse.json(
      { success: false, error: { message: error?.message ?? "Failed to process webhook" } },
      { status },
    );
  }
}
