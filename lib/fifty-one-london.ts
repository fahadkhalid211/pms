/**
 * Fifty One London — 2025/26 Long-Let (Premium Student Accommodation / PBSA) Financial Model
 * Property: Fifty One London, 51-55 Cromwell Road, South Kensington, London SW7 2EH
 * Operator: The Penthouse Living (TPL)
 * Asset Type: Long-let premium student accommodation (Studio / Mezzanine), 120 keys, all bills inclusive
 * Source: Checklist fifty one.xlsx + Fifty One London Services.pdf
 */

export interface FiftyOneRoomType {
  name: string;
  keys: number;
  rate44Week: number; // £ / week
  rate51Week: number; // £ / week
  sizeM2: string;
  description: string;
  view?: string;
  statusNotes?: string;
  isSoldOut?: boolean;
}

export interface FiftyOneDirectCostItem {
  id: string;
  name: string;
  costPerKeyWeek: number; // £ / key / week
  serviceCategory: string;
  notes: string;
}

export interface FiftyOneRevenueCostItem {
  id: string;
  name: string;
  percent: number; // e.g. 0.06 for 6%
  notes: string;
}

export interface FiftyOneService {
  no: number;
  name: string;
  extraFee: string;
  costLine: string;
  includedInOpEx: boolean;
  category: "all_inclusive" | "partner_perk" | "referral_paid";
}

export interface PaymentScheduleInstalment {
  instalment: string;
  paymentDate: string;
  share: number;
  amount51Week: number;
  amount44Week: number;
  totalInflow: number;
  cumulativeInflow: number;
  cumulativePct: number;
}

export interface MonthlyPnlRow {
  month: string;
  label: string;
  billableWeeks51: number;
  billableWeeks44: number;
  revenue51Week: number;
  revenue44Week: number;
  totalRevenue: number;
  directCosts: number;
  revenueLinkedCosts: number;
  totalOpCosts: number;
  gop: number;
  gopMarginPct: number;
  noi: number;
  noiMarginPct: number;
}

export interface FiftyOneScenario {
  occupancyPct: number;
  leasedKeys: number;
  rentRevenue: number;
  directOpCosts: number;
  revenueLinkedCosts: number;
  totalOpCosts: number;
  noi: number;
  noiMarginPct: number;
  noiPerKey: number;
  label: string;
}

export interface ValuationMetric {
  capRatePct: number;
  valuation: number;
  multipleOfNOI: number;
  pricePerKey: number;
}

export interface FiftyOneSimulationResult {
  assumptions: {
    totalKeys: number;
    lettablePricedKeys: number;
    soldOutKeys: number;
    occupancyPct: number;
    leasedKeys: number;
    contract51Share: number;
    contract44Share: number;
    contract51Weeks: number;
    contract44Weeks: number;
    weeklyDirectCostPerKey: number;
    revenueLinkedRatePct: number;
    capRatePct: number;
  };
  financialSummary: {
    grossRevenueFullOccupancy: number;
    grossRevenueAtOccupancy: number;
    revenue51WeekPortion: number;
    revenue44WeekPortion: number;
    directOperatingCosts: number;
    revenueLinkedCosts: number;
    totalOperatingCosts: number;
    netOperatingIncome: number;
    noiMarginPct: number;
    gop: number;
    gopMarginPct: number;
    annualisedRevenuePerKey: number;
    annualisedNoiPerKey: number;
    weightedWeeklyRent: number;
    estimatedValuation: number;
  };
  roomTypes: (FiftyOneRoomType & {
    annualRentPerKey51: number;
    annualRentPerKey44: number;
    weightedAnnualRentPerKey: number;
    fullOccupancyRevenue: number;
    modelOccupancyRevenue: number;
    shareOfRevenuePct: number;
  })[];
  directCosts: FiftyOneDirectCostItem[];
  revenueLinkedCosts: FiftyOneRevenueCostItem[];
  monthlyPnl: MonthlyPnlRow[];
  paymentSchedule: PaymentScheduleInstalment[];
  scenarios: FiftyOneScenario[];
  valuations: ValuationMetric[];
  services: FiftyOneService[];
}

export const FIFTY_ONE_ROOM_TYPES: FiftyOneRoomType[] = [
  {
    name: "Standard Studio",
    keys: 8,
    rate44Week: 869,
    rate51Week: 839,
    sizeM2: "13.1 - 16.5 m²",
    description: "Cosy studios on lower ground floor with private kitchenette and luxury shower room",
  },
  {
    name: "Classic Studio",
    keys: 45,
    rate44Week: 927,
    rate51Week: 897,
    sizeM2: "12.7 - 17.9 m²",
    description: "High-spec modern student studio with ergonomic Herman Miller work area",
  },
  {
    name: "Classic Studio Plus",
    keys: 3,
    rate44Week: 977,
    rate51Week: 947,
    sizeM2: "12.7 - 17.9 m²",
    description: "Premium studio featuring direct unobstructed Natural History Museum views",
    view: "Natural History Museum View",
  },
  {
    name: "Deluxe Studio",
    keys: 18,
    rate44Week: 1127,
    rate51Week: 1097,
    sizeM2: "18 - 22 m²",
    description: "Generous footprint studio with king bed, expanded lounge and luxury dining niche",
  },
  {
    name: "Deluxe Studio Plus",
    keys: 11,
    rate44Week: 1182,
    rate51Week: 1152,
    sizeM2: "18 - 22 m²",
    description: "Upper-floor deluxe studio with panoramic South Kensington and Museum views",
    view: "Natural History Museum View",
  },
  {
    name: "Superior Studio",
    keys: 2,
    rate44Week: 0,
    rate51Week: 0,
    sizeM2: "22.1 - 22.4 m²",
    description: "Ultra-luxury studio suite (SOLD OUT in source inventory; 0 revenue credited in baseline)",
    isSoldOut: true,
    statusNotes: "SOLD OUT — no rent quoted in source workbook",
  },
  {
    name: "Bespoke Edition",
    keys: 16,
    rate44Week: 1355,
    rate51Week: 1325,
    sizeM2: "17 - 31.8 m²",
    description: "Our most unique studios & architectural suites with heritage period features",
  },
  {
    name: "Deluxe Mezzanine",
    keys: 14,
    rate44Week: 1410,
    rate51Week: 1380,
    sizeM2: "24 - 28 m²",
    description: "Two-level split duplex studio with private upper sleeping gallery & Museum views",
    view: "Natural History Museum View",
  },
  {
    name: "Superior Mezzanine",
    keys: 3,
    rate44Week: 1470,
    rate51Week: 1440,
    sizeM2: "28 - 34 m²",
    description: "Top-tier flagship mezzanine penthouse with cathedral ceilings and double-aspect views",
    view: "Natural History Museum View",
  },
];

export const FIFTY_ONE_DIRECT_COSTS: FiftyOneDirectCostItem[] = [
  { id: "clean", name: "Housekeeping & Weekly Cleaning", costPerKeyWeek: 18, serviceCategory: "4. Cleaning Services", notes: "Weekly in-room clean & linen turn" },
  { id: "laundry", name: "Linen & Laundry Credits", costPerKeyWeek: 6, serviceCategory: "7. Washing & Drying", notes: "Weekly eco-friendly laundry allowance" },
  { id: "utilities", name: "Utilities (All-Bills Inclusive)", costPerKeyWeek: 30, serviceCategory: "2. All bills inclusive", notes: "100% green electricity, water, heating & air conditioning" },
  { id: "wifi", name: "Ultra-Fast WiFi & Smart Tech", costPerKeyWeek: 8, serviceCategory: "1. Ultra fast wifi / 11. Smart room", notes: "1Gbps symmetric fiber + Utopi smart sensors" },
  { id: "security", name: "24/7 Security & CCTV Monitoring", costPerKeyWeek: 12, serviceCategory: "3. 24/7 Security", notes: "On-site guards, electronic fobs and multi-angle CCTV" },
  { id: "payroll", name: "Concierge & Front-of-House Payroll", costPerKeyWeek: 35, serviceCategory: "8. Concierge / 6. Room service", notes: "Full-time hospitality desk, parcel reception & concierge" },
  { id: "maintenance", name: "Repairs & Preventive Maintenance", costPerKeyWeek: 8, serviceCategory: "28. Storage / 30. Premium Appliances", notes: "On-demand facilities engineer, appliance care" },
  { id: "insurance", name: "Resident Contents Insurance", costPerKeyWeek: 3, serviceCategory: "14. Contents insurance", notes: "Comprehensive student contents cover up to £10k" },
  { id: "events", name: "Resident Services, Events & Wellness", costPerKeyWeek: 12, serviceCategory: "Gym / Events / Mentorship", notes: "Private gym access, incubator talks, social events, Vision Pro / PS5 room" },
];

export const FIFTY_ONE_REVENUE_COSTS: FiftyOneRevenueCostItem[] = [
  { id: "agent", name: "Sales & Agent Commission", percent: 0.06, notes: "University portals, Student.com, international agents" },
  { id: "marketing", name: "Marketing & Brand Partnerships", percent: 0.02, notes: "Lifestyle promotions, digital PPC, luxury brand partners" },
  { id: "processing", name: "Payment Processing & Gateways", percent: 0.015, notes: "Stripe, Flywire, international student payment processing" },
  { id: "mgmt", name: "Management Fee (The Penthouse Living)", percent: 0.08, notes: "TPL operator management fee" },
  { id: "baddebt", name: "Void & Bad Debt Contingency", percent: 0.01, notes: "Minor void reserve & student credit allowance" },
];

export const FIFTY_ONE_SERVICES: FiftyOneService[] = [
  { no: 1, name: "Ultra Fast WiFi (1 Gbps)", extraFee: "Free", costLine: "Ultra-fast WiFi & smart room tech", includedInOpEx: true, category: "all_inclusive" },
  { no: 2, name: "All Bills Inclusive (Electricity, Heating, Water)", extraFee: "Free", costLine: "Utilities — all bills inclusive", includedInOpEx: true, category: "all_inclusive" },
  { no: 3, name: "24/7 Security & Keycard Access", extraFee: "Free", costLine: "24/7 security & CCTV", includedInOpEx: true, category: "all_inclusive" },
  { no: 4, name: "Weekly Room & Bathroom Cleaning", extraFee: "Free (Add-ons available)", costLine: "Housekeeping & weekly cleaning", includedInOpEx: true, category: "all_inclusive" },
  { no: 5, name: "Private Gym & Wellness Studio Access", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 6, name: "Room Service & Parcel Drop", extraFee: "Free", costLine: "Concierge & front-of-house payroll", includedInOpEx: true, category: "all_inclusive" },
  { no: 7, name: "Washing & Drying Credits", extraFee: "Free allowance", costLine: "Linen & laundry credits", includedInOpEx: true, category: "all_inclusive" },
  { no: 8, name: "On-Site Concierge Team", extraFee: "Free", costLine: "Concierge & front-of-house payroll", includedInOpEx: true, category: "all_inclusive" },
  { no: 9, name: "Wellbeing & Mental Health Support", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 10, name: "Curated Resident Networking Events", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 11, name: "Utopi Smart Room Thermostats & Controls", extraFee: "Free", costLine: "Ultra-fast WiFi & smart room tech", includedInOpEx: true, category: "all_inclusive" },
  { no: 12, name: "Co-Working & Private Study Lounges", extraFee: "Free", costLine: "Concierge & front-of-house payroll", includedInOpEx: true, category: "all_inclusive" },
  { no: 13, name: "Career Coaching & Mentorship Series", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 14, name: "Student Contents Insurance Cover", extraFee: "Free", costLine: "Contents insurance", includedInOpEx: true, category: "all_inclusive" },
  { no: 15, name: "Private Members Club Referrals", extraFee: "Free referral", costLine: "No direct cost (Affiliate referral)", includedInOpEx: false, category: "partner_perk" },
  { no: 16, name: "Pre Move-In Deep Clean & Bed Prep", extraFee: "Free", costLine: "Housekeeping & weekly cleaning", includedInOpEx: true, category: "all_inclusive" },
  { no: 17, name: "Fifty One Founder & Tech Incubator", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 18, name: "Media Subscriptions (FT, NYT, Bloomberg)", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 19, name: "Entertainment Hub (Apple Vision Pro, PS5, 4K)", extraFee: "Free", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 20, name: "Chauffeured Airport Pick-Up (Heathrow)", extraFee: "Free (Arrival perk)", costLine: "Concierge & front-of-house payroll", includedInOpEx: true, category: "all_inclusive" },
  { no: 21, name: "Countryside Retreat Weekend Access", extraFee: "Partner discount", costLine: "No direct cost (Member discount)", includedInOpEx: false, category: "partner_perk" },
  { no: 22, name: "Legal & Visa Advisory Referrals", extraFee: "Resident paid", costLine: "No direct cost (Direct billing)", includedInOpEx: false, category: "referral_paid" },
  { no: 23, name: "Luxury Brand Retail & Dining Discounts", extraFee: "Member discount", costLine: "No direct cost (Partnership)", includedInOpEx: false, category: "partner_perk" },
  { no: 24, name: "Designer Kitchenware Starter Pack", extraFee: "Free", costLine: "Repairs & maintenance", includedInOpEx: true, category: "all_inclusive" },
  { no: 25, name: "Luxury Spa Booking Privileges", extraFee: "Partner discount", costLine: "No direct cost (Member discount)", includedInOpEx: false, category: "partner_perk" },
  { no: 26, name: "Pet-Friendly Friendly Policy", extraFee: "Free (Deposit req.)", costLine: "Policy only", includedInOpEx: false, category: "all_inclusive" },
  { no: 27, name: "RBKC Resident Parking Guidance", extraFee: "Council fee", costLine: "No direct cost", includedInOpEx: false, category: "referral_paid" },
  { no: 28, name: "Luggage & Summer Secure Storage", extraFee: "Free", costLine: "Repairs & maintenance", includedInOpEx: true, category: "all_inclusive" },
  { no: 29, name: "Lime & Forest Electric Bike Subscriptions", extraFee: "Free monthly credits", costLine: "Resident services & events", includedInOpEx: true, category: "all_inclusive" },
  { no: 30, name: "Premium Herman Miller & Miele Appliances", extraFee: "Free in-room", costLine: "Repairs & maintenance", includedInOpEx: true, category: "all_inclusive" },
];

export interface SimulationParams {
  occupancyPct?: number; // 0.80 - 1.00 (default 0.95)
  contract51Share?: number; // 0.50 - 0.90 (default 0.70)
  weeklyDirectCostPerKey?: number; // £/key/week (default 132)
  revenueLinkedRatePct?: number; // e.g. 0.185 (18.5%)
  capRatePct?: number; // e.g. 0.0525 (5.25%)
}

/**
 * Executes a full institutional simulation of the Fifty One London model.
 */
export function calculateFiftyOneModel(params: SimulationParams = {}): FiftyOneSimulationResult {
  const occupancyPct = params.occupancyPct ?? 0.95;
  const contract51Share = params.contract51Share ?? 0.70;
  const contract44Share = Math.round((1 - contract51Share) * 100) / 100;
  const contract51Weeks = 51;
  const contract44Weeks = 44;
  const capRatePct = params.capRatePct ?? 0.0525;

  const totalKeys = 120;
  const lettablePricedKeys = 118;
  const soldOutKeys = 2;
  const leasedKeys = Math.round(lettablePricedKeys * occupancyPct * 10) / 10;

  // 1. Room type calculations
  let grossRevenueFullOccupancy = 0;
  const roomTypesWithCalcs = FIFTY_ONE_ROOM_TYPES.map((rt) => {
    if (rt.isSoldOut || rt.rate51Week === 0) {
      return {
        ...rt,
        annualRentPerKey51: 0,
        annualRentPerKey44: 0,
        weightedAnnualRentPerKey: 0,
        fullOccupancyRevenue: 0,
        modelOccupancyRevenue: 0,
        shareOfRevenuePct: 0,
      };
    }

    const annualRentPerKey51 = rt.rate51Week * contract51Weeks;
    const annualRentPerKey44 = rt.rate44Week * contract44Weeks;
    const weightedAnnualRentPerKey =
      contract51Share * annualRentPerKey51 + contract44Share * annualRentPerKey44;
    const fullOccupancyRevenue = rt.keys * weightedAnnualRentPerKey;
    const modelOccupancyRevenue = fullOccupancyRevenue * occupancyPct;

    grossRevenueFullOccupancy += fullOccupancyRevenue;

    return {
      ...rt,
      annualRentPerKey51,
      annualRentPerKey44,
      weightedAnnualRentPerKey,
      fullOccupancyRevenue,
      modelOccupancyRevenue,
      shareOfRevenuePct: 0, // computed below
    };
  });

  const grossRevenueAtOccupancy = grossRevenueFullOccupancy * occupancyPct;

  // Compute share of revenue
  roomTypesWithCalcs.forEach((rt) => {
    rt.shareOfRevenuePct =
      grossRevenueAtOccupancy > 0
        ? Math.round((rt.modelOccupancyRevenue / grossRevenueAtOccupancy) * 1000) / 10
        : 0;
  });

  // Split revenue between 51-week and 44-week contracts
  let revenue51WeekPortion = 0;
  let revenue44WeekPortion = 0;
  roomTypesWithCalcs.forEach((rt) => {
    if (!rt.isSoldOut) {
      revenue51WeekPortion += rt.keys * contract51Share * rt.rate51Week * contract51Weeks * occupancyPct;
      revenue44WeekPortion += rt.keys * contract44Share * rt.rate44Week * contract44Weeks * occupancyPct;
    }
  });

  // 2. Direct Costs
  const baseWeeklyCostPerKey =
    params.weeklyDirectCostPerKey ??
    FIFTY_ONE_DIRECT_COSTS.reduce((sum, item) => sum + item.costPerKeyWeek, 0); // 132

  const directOperatingCosts = leasedKeys * contract51Weeks * baseWeeklyCostPerKey;

  // 3. Revenue-Linked Costs
  const revenueLinkedRatePct =
    params.revenueLinkedRatePct ??
    FIFTY_ONE_REVENUE_COSTS.reduce((sum, item) => sum + item.percent, 0); // 0.185 (18.5%)

  const revenueLinkedCosts = grossRevenueAtOccupancy * revenueLinkedRatePct;
  const totalOperatingCosts = directOperatingCosts + revenueLinkedCosts;
  const netOperatingIncome = grossRevenueAtOccupancy - totalOperatingCosts;
  const noiMarginPct = grossRevenueAtOccupancy > 0 ? (netOperatingIncome / grossRevenueAtOccupancy) * 100 : 0;
  const gop = grossRevenueAtOccupancy - directOperatingCosts;
  const gopMarginPct = grossRevenueAtOccupancy > 0 ? (gop / grossRevenueAtOccupancy) * 100 : 0;

  const annualisedRevenuePerKey = leasedKeys > 0 ? grossRevenueAtOccupancy / leasedKeys : 0;
  const annualisedNoiPerKey = leasedKeys > 0 ? netOperatingIncome / leasedKeys : 0;

  const weightedWeeklyRent =
    leasedKeys > 0 ? grossRevenueAtOccupancy / (leasedKeys * (contract51Share * 51 + contract44Share * 44)) : 0;

  const estimatedValuation = netOperatingIncome / capRatePct;

  // 4. Payment Schedule (Cash Inflows)
  const instalments = [
    { name: "Booking Deposit (Advanced Rent)", date: "2025-08-04", share: 0.02 },
    { name: "First Instalment", date: "2025-08-04", share: 0.12 },
    { name: "Second Instalment", date: "2025-10-06", share: 0.35 },
    { name: "Third Instalment", date: "2026-01-06", share: 0.35 },
    { name: "Fourth Instalment", date: "2026-04-06", share: 0.16 },
  ];

  let cumulativeCash = 0;
  let cumulativeShare = 0;
  const paymentSchedule: PaymentScheduleInstalment[] = instalments.map((inst) => {
    const totalInflow = grossRevenueAtOccupancy * inst.share;
    cumulativeCash += totalInflow;
    cumulativeShare += inst.share;
    return {
      instalment: inst.name,
      paymentDate: inst.date,
      share: inst.share,
      amount51Week: revenue51WeekPortion * inst.share,
      amount44Week: revenue44WeekPortion * inst.share,
      totalInflow: Math.round(totalInflow * 100) / 100,
      cumulativeInflow: Math.round(cumulativeCash * 100) / 100,
      cumulativePct: Math.round(cumulativeShare * 1000) / 10,
    };
  });

  // 5. Monthly P&L (12 academic months: Sep 2025 -> Aug 2026)
  // Calendar-day conversion (weeks per month):
  const monthWeeks = [
    { month: "2025-09", label: "Sep 2025", w51: 3.57, w44: 3.57 },
    { month: "2025-10", label: "Oct 2025", w51: 4.43, w44: 4.43 },
    { month: "2025-11", label: "Nov 2025", w51: 4.29, w44: 4.29 },
    { month: "2025-12", label: "Dec 2025", w51: 4.43, w44: 4.43 },
    { month: "2026-01", label: "Jan 2026", w51: 4.43, w44: 4.43 },
    { month: "2026-02", label: "Feb 2026", w51: 4.00, w44: 4.00 },
    { month: "2026-03", label: "Mar 2026", w51: 4.43, w44: 4.43 },
    { month: "2026-04", label: "Apr 2026", w51: 4.29, w44: 4.29 },
    { month: "2026-05", label: "May 2026", w51: 4.43, w44: 4.43 },
    { month: "2026-06", label: "Jun 2026", w51: 4.29, w44: 4.29 },
    { month: "2026-07", label: "Jul 2026", w51: 4.43, w44: 1.43 }, // 44-wk ends 10 July
    { month: "2026-08", label: "Aug 2026", w51: 3.98, w44: 0.00 }, // 51-wk ends 28 Aug
  ];

  const total51WeeksSum = monthWeeks.reduce((acc, m) => acc + m.w51, 0); // ~51.0
  const total44WeeksSum = monthWeeks.reduce((acc, m) => acc + m.w44, 0); // ~44.0

  const monthlyPnl: MonthlyPnlRow[] = monthWeeks.map((mw) => {
    const rev51 = (mw.w51 / total51WeeksSum) * revenue51WeekPortion;
    const rev44 = (mw.w44 / total44WeeksSum) * revenue44WeekPortion;
    const totalRev = rev51 + rev44;

    // Direct costs accrue per month proportional to 51-week operations
    const monthDirectCosts = (mw.w51 / total51WeeksSum) * directOperatingCosts;
    const monthRevenueLinked = totalRev * revenueLinkedRatePct;
    const totalMonthOpCosts = monthDirectCosts + monthRevenueLinked;
    const monthGop = totalRev - monthDirectCosts;
    const monthNoi = totalRev - totalMonthOpCosts;

    return {
      month: mw.month,
      label: mw.label,
      billableWeeks51: mw.w51,
      billableWeeks44: mw.w44,
      revenue51Week: Math.round(rev51 * 100) / 100,
      revenue44Week: Math.round(rev44 * 100) / 100,
      totalRevenue: Math.round(totalRev * 100) / 100,
      directCosts: Math.round(monthDirectCosts * 100) / 100,
      revenueLinkedCosts: Math.round(monthRevenueLinked * 100) / 100,
      totalOpCosts: Math.round(totalMonthOpCosts * 100) / 100,
      gop: Math.round(monthGop * 100) / 100,
      gopMarginPct: totalRev > 0 ? Math.round((monthGop / totalRev) * 1000) / 10 : 0,
      noi: Math.round(monthNoi * 100) / 100,
      noiMarginPct: totalRev > 0 ? Math.round((monthNoi / totalRev) * 1000) / 10 : 0,
    };
  });

  // 6. Occupancy Scenarios (85%, 90%, 95%, 100%)
  const scenarioPoints = [
    { occ: 0.85, label: "Conservative (85% Occupancy)" },
    { occ: 0.90, label: "Prudent Target (90% Occupancy)" },
    { occ: 0.95, label: "Base Case (95% Occupancy)" },
    { occ: 1.00, label: "Full Capacity Ceiling (100% Occupancy)" },
  ];

  const scenarios: FiftyOneScenario[] = scenarioPoints.map((sp) => {
    const lKeys = Math.round(lettablePricedKeys * sp.occ * 10) / 10;
    const rentRev = grossRevenueFullOccupancy * sp.occ;
    const dCosts = lKeys * contract51Weeks * baseWeeklyCostPerKey;
    const rCosts = rentRev * revenueLinkedRatePct;
    const totCosts = dCosts + rCosts;
    const scNoi = rentRev - totCosts;

    return {
      occupancyPct: sp.occ * 100,
      leasedKeys: lKeys,
      rentRevenue: Math.round(rentRev * 100) / 100,
      directOpCosts: Math.round(dCosts * 100) / 100,
      revenueLinkedCosts: Math.round(rCosts * 100) / 100,
      totalOpCosts: Math.round(totCosts * 100) / 100,
      noi: Math.round(scNoi * 100) / 100,
      noiMarginPct: Math.round((scNoi / rentRev) * 1000) / 10,
      noiPerKey: lKeys > 0 ? Math.round((scNoi / lKeys) * 100) / 100 : 0,
      label: sp.label,
    };
  });

  // 7. Cap Rate Valuation Matrix (4.75% to 6.25%)
  const capRates = [0.0475, 0.050, 0.0525, 0.055, 0.0575, 0.060];
  const valuations: ValuationMetric[] = capRates.map((cr) => {
    const val = netOperatingIncome / cr;
    return {
      capRatePct: cr * 100,
      valuation: Math.round(val),
      multipleOfNOI: Math.round((1 / cr) * 10) / 10,
      pricePerKey: Math.round(val / totalKeys),
    };
  });

  return {
    assumptions: {
      totalKeys,
      lettablePricedKeys,
      soldOutKeys,
      occupancyPct: occupancyPct * 100,
      leasedKeys,
      contract51Share: contract51Share * 100,
      contract44Share: contract44Share * 100,
      contract51Weeks,
      contract44Weeks,
      weeklyDirectCostPerKey: baseWeeklyCostPerKey,
      revenueLinkedRatePct: revenueLinkedRatePct * 100,
      capRatePct: capRatePct * 100,
    },
    financialSummary: {
      grossRevenueFullOccupancy: Math.round(grossRevenueFullOccupancy * 100) / 100,
      grossRevenueAtOccupancy: Math.round(grossRevenueAtOccupancy * 100) / 100,
      revenue51WeekPortion: Math.round(revenue51WeekPortion * 100) / 100,
      revenue44WeekPortion: Math.round(revenue44WeekPortion * 100) / 100,
      directOperatingCosts: Math.round(directOperatingCosts * 100) / 100,
      revenueLinkedCosts: Math.round(revenueLinkedCosts * 100) / 100,
      totalOperatingCosts: Math.round(totalOperatingCosts * 100) / 100,
      netOperatingIncome: Math.round(netOperatingIncome * 100) / 100,
      noiMarginPct: Math.round(noiMarginPct * 100) / 100,
      gop: Math.round(gop * 100) / 100,
      gopMarginPct: Math.round(gopMarginPct * 100) / 100,
      annualisedRevenuePerKey: Math.round(annualisedRevenuePerKey * 100) / 100,
      annualisedNoiPerKey: Math.round(annualisedNoiPerKey * 100) / 100,
      weightedWeeklyRent: Math.round(weightedWeeklyRent * 100) / 100,
      estimatedValuation: Math.round(estimatedValuation),
    },
    roomTypes: roomTypesWithCalcs,
    directCosts: FIFTY_ONE_DIRECT_COSTS,
    revenueLinkedCosts: FIFTY_ONE_REVENUE_COSTS,
    monthlyPnl,
    paymentSchedule,
    scenarios,
    valuations,
    services: FIFTY_ONE_SERVICES,
  };
}
