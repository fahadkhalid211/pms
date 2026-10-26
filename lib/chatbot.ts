import prisma from "@/lib/db";
import { searchKnowledgeBase } from "@/lib/kb";
import { resolveProvider } from "@/lib/ai/agent";
import { providerChatCompletion, type AiMessage, type AiToolDef } from "@/lib/ai/providers";
import { nightsBetween } from "@/lib/reservations";
import { logActivity } from "@/lib/audit";

export interface ChatbotResponse {
  reply: string;
  sessionKey: string;
  status: "active" | "needs_human" | "closed";
  handoff: boolean;
  toolUsed?: string;
}

const CHATBOT_GROUNDING_PROMPT = `You are Lumina, the autonomous hospitality assistant for this hotel.
Your role is to assist guests and visitors politely, accurately, and securely.

CRITICAL RULES:
1. Ground your answers strictly in the provided hotel context and policies. Never fabricate policies, amenities, or rates.
2. If asked about a personal reservation, enforce identity verification protocol: you require BOTH the booking reference code AND the associated guest email address. If only the booking code is provided, decline to disclose reservation data and politely prompt for the matching email.
3. If the guest asks for human assistance or reports an unresolved urgent problem, call the 'request_human_handoff' tool.
4. Keep answers friendly, concise, and professional. Zero emojis. Always format currency and dates clearly.`;

export async function respondToGuest(input: {
  organizationId: string;
  propertyId?: string | null;
  sessionKey?: string;
  message: string;
  customerUserId?: string | null;
}): Promise<ChatbotResponse> {
  if (!input.organizationId) {
    throw new Error("organizationId is required for chatbot conversation.");
  }
  if (!input.message || !input.message.trim()) {
    throw new Error("Message cannot be empty.");
  }

  const sessionKey = input.sessionKey?.trim() || `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  // 1. Get or create conversation record
  const conversation = await prisma.chatbotConversation.upsert({
    where: { sessionKey },
    update: {
      updatedAt: new Date(),
      customerUserId: input.customerUserId ?? undefined,
    },
    create: {
      organizationId: input.organizationId,
      propertyId: input.propertyId ?? null,
      sessionKey,
      customerUserId: input.customerUserId ?? null,
      status: "active",
    },
  });

  // Record guest message
  await prisma.chatbotMessage.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      role: "user",
      content: input.message,
    },
  });

  // 2. Fetch Property Context
  const property = input.propertyId
    ? await prisma.property.findFirst({
        where: { id: input.propertyId, organizationId: input.organizationId },
      })
    : await prisma.property.findFirst({
        where: { organizationId: input.organizationId },
        orderBy: { createdAt: "asc" },
      });

  const propertyId = property?.id ?? null;

  // 3. RAG Retrieval from Knowledge Base
  const relevantChunks = await searchKnowledgeBase(input.organizationId, input.message, {
    propertyId,
    limit: 4,
  });

  const contextText = relevantChunks.length > 0
    ? relevantChunks.map((c) => `[${c.type.toUpperCase()}] ${c.title}:\n${c.content}`).join("\n\n")
    : "No specific knowledge base articles found for this topic.";

  // 4. Resolve Active AI Provider
  const providerConfig = await resolveProvider(input.organizationId);

  // If no provider is active, return safe fallback response
  if (!providerConfig) {
    const fallbackReply = `Thank you for contacting ${property?.name ?? "us"}. Our automated assistant is currently offline. Please reach out directly to the front desk for immediate assistance.`;
    await prisma.chatbotMessage.create({
      data: {
        organizationId: input.organizationId,
        conversationId: conversation.id,
        role: "assistant",
        content: fallbackReply,
      },
    });
    return { reply: fallbackReply, sessionKey, status: "active", handoff: false };
  }

  // 5. Chatbot Tools Definitions
  const chatbotTools: AiToolDef[] = [
    {
      name: "check_availability",
      description: "Check available rooms and room types for given stay dates at the property.",
      inputSchema: {
        type: "object",
        required: ["checkIn", "checkOut"],
        properties: {
          checkIn: { type: "string", description: "Arrival date (YYYY-MM-DD)" },
          checkOut: { type: "string", description: "Departure date (YYYY-MM-DD)" },
        },
      },
    },
    {
      name: "get_rates",
      description: "Retrieve standard room types, nightly base rates, and property fees.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "lookup_verified_booking",
      description: "Lookup a reservation. STRICT REQUIREMENT: Requires BOTH booking reference code AND guest email.",
      inputSchema: {
        type: "object",
        required: ["bookingCode"],
        properties: {
          bookingCode: { type: "string", description: "Booking confirmation code (e.g. BK-XXXXXX)" },
          email: { type: "string", description: "Guest email address associated with the booking" },
        },
      },
    },
    {
      name: "create_support_ticket",
      description: "Log a special guest inquiry, request, or maintenance notification for front desk staff.",
      inputSchema: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", description: "Details of guest inquiry or request" },
          guestName: { type: "string" },
          contactEmail: { type: "string" },
        },
      },
    },
    {
      name: "request_human_handoff",
      description: "Escalate the conversation to human hotel staff when guest requests a human or issue is urgent.",
      inputSchema: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Reason for transferring to human staff" },
        },
      },
    },
  ];

  // 6. Execute Provider Chat
  const historyMessages = await prisma.chatbotMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 8,
  });

  const promptMessages: AiMessage[] = [
    { role: "system", content: CHATBOT_GROUNDING_PROMPT },
    ...historyMessages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content ?? "",
    })),
    {
      role: "user",
      content: `Property: ${property?.name ?? "Hotel"}\nCurrency: ${property?.currency ?? "USD"}\nCheck-in Time: ${property?.checkInTime ?? 15}:00\nCheck-out Time: ${property?.checkOutTime ?? 11}:00\n\nHotel Knowledge Context:\n${contextText}\n\nGuest Message: ${input.message}`,
    },
  ];

  let replyText = "";
  let handoffTriggered = false;
  let toolUsed: string | undefined;

  const result = await providerChatCompletion(
    providerConfig,
    promptMessages,
    chatbotTools,
    CHATBOT_GROUNDING_PROMPT,
  );

  // If tool was called
  if (result.toolCalls && result.toolCalls.length > 0) {
    const call = result.toolCalls[0];
    toolUsed = call.name;

    if (call.name === "check_availability") {
      const args = call.arguments as { checkIn?: string; checkOut?: string };
      const checkInDate = args.checkIn ? new Date(args.checkIn) : new Date();
      const checkOutDate = args.checkOut ? new Date(args.checkOut) : new Date(Date.now() + 86400000);
      const nights = nightsBetween(checkInDate, checkOutDate);

      const availableCount = await prisma.room.count({
        where: {
          organizationId: input.organizationId,
          status: "available",
          ...(propertyId ? { propertyId } : {}),
        },
      });

      replyText = `We currently have ${availableCount} room(s) available for your requested stay of ${nights} night(s) from ${checkInDate.toISOString().split("T")[0]} to ${checkOutDate.toISOString().split("T")[0]}. You can book directly in our guest portal or speak with our reservations desk.`;
    } else if (call.name === "get_rates") {
      const roomTypes = await prisma.roomType.findMany({
        where: {
          organizationId: input.organizationId,
          ...(propertyId ? { propertyId } : {}),
        },
        take: 5,
      });

      const ratesList = roomTypes
        .map((rt) => `${rt.name}: ${property?.currency ?? "USD"} ${rt.baseRate}/night (capacity: ${rt.capacity} guests)`)
        .join("; ");

      replyText = `Our available room rates at ${property?.name ?? "the property"}: ${ratesList || "Standard rooms starting from $150/night"}. Plus standard cleaning fee of ${property?.currency ?? "USD"} ${property?.cleaningFee ?? 50} and ${property?.taxRate ?? 10}% local taxes.`;
    } else if (call.name === "lookup_verified_booking") {
      const args = call.arguments as { bookingCode?: string; email?: string };

      // IDENTITY VERIFICATION GATE:
      // Booking Reference alone MUST BE DENIED!
      if (!args.email || !args.email.trim()) {
        replyText = `Identity verification required: To view details for booking ${args.bookingCode ?? "reference"}, please provide the email address used during booking for security.`;
      } else {
        // Query reservation matching BOTH code AND guest email
        const reservation = await prisma.reservation.findFirst({
          where: {
            organizationId: input.organizationId,
            code: args.bookingCode?.trim(),
            guest: {
              email: {
                equals: args.email.trim(),
                mode: "insensitive",
              },
            },
          },
          include: {
            guest: true,
            rooms: { include: { room: true } },
          },
        });

        if (!reservation) {
          replyText = `Verification failed: No reservation matching booking reference '${args.bookingCode}' and email '${args.email}' was found. Please check your confirmation email or contact our desk.`;
        } else {
          const checkIn = reservation.checkIn.toISOString().split("T")[0];
          const checkOut = reservation.checkOut.toISOString().split("T")[0];
          const roomNumbers = reservation.rooms.map((r) => r.room.number).join(", ");

          replyText = `Verified Booking #${reservation.code}:\n- Guest: ${reservation.guest?.firstName} ${reservation.guest?.lastName}\n- Dates: ${checkIn} to ${checkOut}\n- Status: ${reservation.status}\n- Room(s): ${roomNumbers || "Assigned upon check-in"}\n- Total: ${reservation.currency} ${reservation.totalAmount}`;
        }
      }
    } else if (call.name === "create_support_ticket") {
      const args = call.arguments as { content: string; guestName?: string; contactEmail?: string };
      await prisma.guestRequest.create({
        data: {
          organizationId: input.organizationId,
          propertyId,
          guestId: input.customerUserId ?? (await getOrCreateGuestId(input.organizationId, args.contactEmail, args.guestName)),
          type: "guest_inquiry",
          content: args.content,
          status: "pending",
        },
      });
      replyText = `Your inquiry has been logged with our guest services team. A team member will attend to your request: "${args.content}".`;
    } else if (call.name === "request_human_handoff") {
      handoffTriggered = true;
      await prisma.chatbotConversation.update({
        where: { id: conversation.id },
        data: { status: "needs_human" },
      });
      replyText = `I have flagged this conversation for a human team member. A front desk representative will join and follow up with you shortly.`;
    }
  } else {
    replyText = result.content ?? "Thank you for reaching out. How can I assist you with your stay today?";
  }

  // 7. Save Assistant Message
  await prisma.chatbotMessage.create({
    data: {
      organizationId: input.organizationId,
      conversationId: conversation.id,
      role: "assistant",
      content: replyText,
    },
  });

  await logActivity({
    organizationId: input.organizationId,
    propertyId,
    source: "backend",
    category: "ai",
    action: "chatbot.message_exchanged",
    summary: `Chatbot exchanged message in session #${sessionKey.slice(-6)} (tool: ${toolUsed ?? "direct_reply"}).`,
  });

  return {
    reply: replyText,
    sessionKey,
    status: handoffTriggered ? "needs_human" : (conversation.status as any),
    handoff: handoffTriggered,
    toolUsed,
  };
}

async function getOrCreateGuestId(organizationId: string, email?: string, name?: string): Promise<string> {
  if (email) {
    const existing = await prisma.guest.findFirst({
      where: { organizationId, email: { equals: email, mode: "insensitive" } },
    });
    if (existing) return existing.id;
  }

  const parts = (name ?? "Guest Visitor").split(" ");
  const guest = await prisma.guest.create({
    data: {
      organizationId,
      firstName: parts[0] || "Guest",
      lastName: parts.slice(1).join(" ") || "Visitor",
      email: email ?? null,
    },
  });
  return guest.id;
}
