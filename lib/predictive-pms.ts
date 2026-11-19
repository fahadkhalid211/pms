/**
 * Institutional Predictive Financial Modeling for Pent House PMS & Fifty One London
 * 5-Year Profit Projections, Value-Add Upsell Levers, Summer Void Monetization & Asset Equity Valuation
 */

export interface YearForecast {
  year: string;
  academicYear: string;
  totalKeys: number;
  occupancyPct: number;
  baseRentRevenue: number;
  superiorStudioRevenue: number;
  summerVoidMonetization: number;
  ancillaryServicesIncome: number;
  grossRevenue: number;
  directOperatingCosts: number;
  revenueLinkedCosts: number;
  totalOperatingCosts: number;
  ebitda: number; // Net Operating Income
  ebitdaMarginPct: number;
  annualizedRevPerKey: number;
  annualizedEbitdaPerKey: number;
  assetValuationAt525Cap: number;
  cumulativeCashflow: number;
}

export interface ValueAddLever {
  title: string;
  category: string;
  annualImpactGbp: number;
  marginImpactPct: number;
  description: string;
  implementationTimeline: string;
}

export interface PredictiveQuarterlyCash {
  quarter: string;
  label: string;
  inflowsGbp: number;
  outflowsGbp: number;
  netCashflowGbp: number;
  cashBalanceGbp: number;
}

export interface PredictivePortfolioModel {
  fiveYearForecast: YearForecast[];
  valueAddLevers: ValueAddLever[];
  quarterlyCashCurve: PredictiveQuarterlyCash[];
  executiveHighlights: {
    baseYearRevenueGbp: number;
    yearFiveRevenueGbp: number;
    fiveYearRevenueCagrPct: number;
    baseYearEbitdaGbp: number;
    yearFiveEbitdaGbp: number;
    fiveYearEbitdaCagrPct: number;
    equityValueCreatedGbp: number;
    totalFiveYearFreeCashflowGbp: number;
    terminalValuationGbp: number;
  };
}

export function generatePredictivePortfolioModel(): PredictivePortfolioModel {
  // Baseline Year 1 (2025/26) based on source model at 95% occupancy
  const y1Gross = 5952353;
  const y1Direct = 754657;
  const y1RevLinked = 1101185;
  const y1Ebitda = 4096510;
  const y1Valuation = 78028766;

  const fiveYearForecast: YearForecast[] = [
    {
      year: "Y1",
      academicYear: "2025/26 (Base)",
      totalKeys: 120,
      occupancyPct: 95.0,
      baseRentRevenue: 5952353,
      superiorStudioRevenue: 0, // Excluded in source baseline
      summerVoidMonetization: 0,
      ancillaryServicesIncome: 0,
      grossRevenue: 5952353,
      directOperatingCosts: 754657,
      revenueLinkedCosts: 1101185,
      totalOperatingCosts: 1855842,
      ebitda: 4096510,
      ebitdaMarginPct: 68.8,
      annualizedRevPerKey: 53099,
      annualizedEbitdaPerKey: 36543,
      assetValuationAt525Cap: 78028766,
      cumulativeCashflow: 4096510,
    },
    {
      year: "Y2",
      academicYear: "2026/27 (Optimized)",
      totalKeys: 120,
      occupancyPct: 96.5,
      baseRentRevenue: 6190447, // +4.0% market rent escalation in South Kensington
      superiorStudioRevenue: 122400, // 2 Superior Studios activated @ £1,200/wk for 51 weeks
      summerVoidMonetization: 168000, // 35 void 44-wk rooms leased for 7 summer weeks @ £700/wk (summer schools)
      ancillaryServicesIncome: 65000, // Add-on cleaning packages & laundry subscriptions
      grossRevenue: 6545847,
      directOperatingCosts: 788616, // +4.5% inflation on supplies & housekeeping
      revenueLinkedCosts: 1178252, // 18.0% (slight direct channel gain)
      totalOperatingCosts: 1966868,
      ebitda: 4578979,
      ebitdaMarginPct: 70.0,
      annualizedRevPerKey: 56920,
      annualizedEbitdaPerKey: 39817,
      assetValuationAt525Cap: 87218648,
      cumulativeCashflow: 8675489,
    },
    {
      year: "Y3",
      academicYear: "2027/28 (Direct Scale)",
      totalKeys: 120,
      occupancyPct: 97.5,
      baseRentRevenue: 6469017, // +4.5% organic rent growth
      superiorStudioRevenue: 130000,
      summerVoidMonetization: 215000, // Expanded summer university partnership (Imperial / RCA)
      ancillaryServicesIncome: 145000, // Premium concierge, storage & private airport transfers
      grossRevenue: 6959017,
      directOperatingCosts: 816218,
      revenueLinkedCosts: 1183033, // 17.0% (agent commission drops from 6% to 4.5% via direct brand power)
      totalOperatingCosts: 1999251,
      ebitda: 4959766,
      ebitdaMarginPct: 71.3,
      annualizedRevPerKey: 59479,
      annualizedEbitdaPerKey: 42391,
      assetValuationAt525Cap: 94471733,
      cumulativeCashflow: 13635255,
    },
    {
      year: "Y4",
      academicYear: "2028/29 (Smart Automation)",
      totalKeys: 120,
      occupancyPct: 98.0,
      baseRentRevenue: 6760123,
      superiorStudioRevenue: 137000,
      summerVoidMonetization: 245000,
      ancillaryServicesIncome: 190000,
      grossRevenue: 7332123,
      directOperatingCosts: 832542, // Energy & smart thermostat optimization saves £35k
      revenueLinkedCosts: 1173140, // 16.0% (direct bookings hit 45%)
      totalOperatingCosts: 2005682,
      ebitda: 5326441,
      ebitdaMarginPct: 72.6,
      annualizedRevPerKey: 62137,
      annualizedEbitdaPerKey: 45139,
      assetValuationAt525Cap: 101456019,
      cumulativeCashflow: 18961696,
    },
    {
      year: "Y5",
      academicYear: "2029/30 (Institutional Maturity)",
      totalKeys: 120,
      occupancyPct: 98.5,
      baseRentRevenue: 7064328,
      superiorStudioRevenue: 145000,
      summerVoidMonetization: 275000,
      ancillaryServicesIncome: 240000,
      grossRevenue: 7724328,
      directOperatingCosts: 857518,
      revenueLinkedCosts: 1197271, // 15.5% (direct platform dominant)
      totalOperatingCosts: 2054789,
      ebitda: 5669539,
      ebitdaMarginPct: 73.4,
      annualizedRevPerKey: 64910,
      annualizedEbitdaPerKey: 47643,
      assetValuationAt525Cap: 107991219,
      cumulativeCashflow: 24631235,
    },
  ];

  const valueAddLevers: ValueAddLever[] = [
    {
      title: "Rent Empty Rooms in Summer (July & August)",
      category: "Extra Bookings",
      annualImpactGbp: 275000,
      marginImpactPct: 3.5,
      description:
        "When students leave for the summer, ~35 rooms are vacant for 7 weeks. We rent these rooms to tourists and summer school students at £700/week to bring in an extra £275k every summer.",
      implementationTimeline: "Starts Summer 2026",
    },
    {
      title: "Rent 2 Top-Floor Luxury Penthouse Studios",
      category: "Extra Rent",
      annualImpactGbp: 145000,
      marginImpactPct: 1.9,
      description:
        "The two largest penthouse studios (22.4 m²) can be rented for £1,420/week on full-year contracts, adding £145k in pure annual income.",
      implementationTimeline: "Starts School Year 2026/27",
    },
    {
      title: "Cut Out Booking Fees with Direct Website Bookings",
      category: "Lower Expenses",
      annualImpactGbp: 185000,
      marginImpactPct: 2.4,
      description:
        "Booking guests directly through penthousepms.com instead of third-party agencies lowers commission fees from 6% to 3.5%, keeping an extra £185k of profit each year.",
      implementationTimeline: "Rolling rollout (Years 2 to 4)",
    },
    {
      title: "Extra Guest Services (Laundry, Cleaning & Airport Pickups)",
      category: "Service Add-ons",
      annualImpactGbp: 240000,
      marginImpactPct: 2.8,
      description:
        "Students and parents happily pay for convenience: weekly laundry turnaround, mid-week room tidying, and chauffeured airport pickups generate £240k in extra high-profit income.",
      implementationTimeline: "Phase 2 (Year 3 onwards)",
    },
    {
      title: "Smart Thermostats to Cut Heating & Electric Bills",
      category: "Lower Expenses",
      annualImpactGbp: 48000,
      marginImpactPct: 0.7,
      description:
        "Smart room sensors lower heating automatically when students are at class or away, cutting energy bills by 14% without affecting comfort.",
      implementationTimeline: "Immediate installation",
    },
  ];

  const quarterlyCashCurve: PredictiveQuarterlyCash[] = [
    { quarter: "Q1", label: "Q1 (Aug–Oct 25)", inflowsGbp: 2916653, outflowsGbp: 463960, netCashflowGbp: 2452693, cashBalanceGbp: 2452693 },
    { quarter: "Q2", label: "Q2 (Nov 25–Jan 26)", inflowsGbp: 2083323, outflowsGbp: 463960, netCashflowGbp: 1619363, cashBalanceGbp: 4072056 },
    { quarter: "Q3", label: "Q3 (Feb–Apr 26)", inflowsGbp: 952376, outflowsGbp: 463960, netCashflowGbp: 488416, cashBalanceGbp: 4560472 },
    { quarter: "Q4", label: "Q4 (May–Jul 26)", inflowsGbp: 220000, outflowsGbp: 463960, netCashflowGbp: -243960, cashBalanceGbp: 4316512 },
  ];

  const y1 = fiveYearForecast[0];
  const y5 = fiveYearForecast[4];

  const cagr = (start: number, end: number, years: number) =>
    Math.round((Math.pow(end / start, 1 / years) - 1) * 1000) / 10;

  return {
    fiveYearForecast,
    valueAddLevers,
    quarterlyCashCurve,
    executiveHighlights: {
      baseYearRevenueGbp: y1.grossRevenue,
      yearFiveRevenueGbp: y5.grossRevenue,
      fiveYearRevenueCagrPct: cagr(y1.grossRevenue, y5.grossRevenue, 4),
      baseYearEbitdaGbp: y1.ebitda,
      yearFiveEbitdaGbp: y5.ebitda,
      fiveYearEbitdaCagrPct: cagr(y1.ebitda, y5.ebitda, 4),
      equityValueCreatedGbp: y5.assetValuationAt525Cap - y1.assetValuationAt525Cap,
      totalFiveYearFreeCashflowGbp: y5.cumulativeCashflow,
      terminalValuationGbp: y5.assetValuationAt525Cap,
    },
  };
}
