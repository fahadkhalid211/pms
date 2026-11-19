import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPortfolioAnalytics, getBenchmarkPortfolioAnalytics } from "@/lib/analytics";
import { calculateFiftyOneModel, type SimulationParams } from "@/lib/fifty-one-london";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const occParam = url.searchParams.get("occupancy");
    const c51Param = url.searchParams.get("contract51");
    const costParam = url.searchParams.get("weeklyCost");
    const capParam = url.searchParams.get("capRate");

    const simParams: SimulationParams = {};
    if (occParam) simParams.occupancyPct = parseFloat(occParam) / (parseFloat(occParam) > 1 ? 100 : 1);
    if (c51Param) simParams.contract51Share = parseFloat(c51Param) / (parseFloat(c51Param) > 1 ? 100 : 1);
    if (costParam) simParams.weeklyDirectCostPerKey = parseFloat(costParam);
    if (capParam) simParams.capRatePct = parseFloat(capParam) / (parseFloat(capParam) > 1 ? 100 : 1);

    const fiftyOneLondon = calculateFiftyOneModel(simParams);

    let portfolio = getBenchmarkPortfolioAnalytics();
    const user = await getCurrentUser(request);
    if (user?.organizationId) {
      try {
        const liveAnalytics = await getPortfolioAnalytics(user.organizationId);
        if (liveAnalytics && liveAnalytics.properties.length > 0) {
          portfolio = liveAnalytics;
        }
      } catch (err) {
        console.warn("[analytics/summary] Using benchmark portfolio baseline:", err);
      }
    }

    // Generate Consolidated Investor Metrics
    const combinedGrossRevenue =
      fiftyOneLondon.financialSummary.grossRevenueAtOccupancy +
      portfolio.financials.totalGrossCombinedGbp;

    const combinedNOI =
      fiftyOneLondon.financialSummary.netOperatingIncome +
      portfolio.financials.ownerNetGbp;

    const combinedKeys =
      fiftyOneLondon.assumptions.totalKeys +
      portfolio.properties.reduce((acc, p) => acc + (p.units || 1), 0);

    const consolidated = {
      groupGrossRevenueGbp: Math.round(combinedGrossRevenue * 100) / 100,
      groupNoiGbp: Math.round(combinedNOI * 100) / 100,
      groupNoiMarginPct: Math.round((combinedNOI / combinedGrossRevenue) * 1000) / 10,
      totalKeysUnderManagement: combinedKeys,
      enterpriseValuationGbp: Math.round(fiftyOneLondon.financialSummary.estimatedValuation + (portfolio.financials.ownerNetGbp / 0.08)),
      propertiesCount: portfolio.properties.length + 1, // +1 for Fifty One London
      cashCollectedGbp: Math.round((fiftyOneLondon.financialSummary.grossRevenueAtOccupancy + portfolio.financials.totalPaidCombinedGbp) * 100) / 100,
      weightedOccupancyPct: Math.round(
        ((fiftyOneLondon.assumptions.leasedKeys + (portfolio.properties.length * 0.82)) / combinedKeys) * 1000
      ) / 10,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...portfolio,
        portfolio,
        fiftyOneLondon,
        consolidated,
      },
    });
  } catch (error: any) {
    console.error("[analytics/summary] Error generating analytics:", error);
    const fiftyOneLondon = calculateFiftyOneModel();
    const portfolio = getBenchmarkPortfolioAnalytics();
    return NextResponse.json({
      success: true,
      data: {
        ...portfolio,
        portfolio,
        fiftyOneLondon,
      },
    });
  }
}
