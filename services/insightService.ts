
export const generateInsight = (
    teamName: string,
    currentAchieved: number,
    target: number,
    daysRemaining: number,
    currentDailyAvg: number,
    last2DaysSurgePercentage: number = 0 // New parameter: Avg % of sales done in last 2 days of prev months
): { text: string; tone: 'positive' | 'neutral' | 'warning' } => {
    if (target <= 0) return { text: "No target set for this period.", tone: 'neutral' };
    if (currentAchieved >= target) return { text: "🎉 Target achieved! Excellent performance.", tone: 'positive' };

    const remainingTarget = target - currentAchieved;
    if (daysRemaining <= 0) return { text: "Month ended. Target missed.", tone: 'warning' };

    const requiredDaily = remainingTarget / daysRemaining;
    const requiredGrowthPercentage = currentDailyAvg > 0
        ? ((requiredDaily - currentDailyAvg) / currentDailyAvg) * 100
        : 100; // If current avg is 0, we effectively need 100% "new" effort

    // Formatting currency (assuming no locale for simplicity/speed, or consistent "en-US")
    const fmt = (n: number) => Math.round(n).toLocaleString();

    // Surge Context Message
    let surgeMsg = "";
    if (last2DaysSurgePercentage > 20) {
        surgeMsg = ` 💡 Note: Historically, ${Math.round(last2DaysSurgePercentage)}% of your sales come in the final 2 days.`;
    }

    if (requiredGrowthPercentage > 120) {
        return {
            text: `⚠️ To achieve the target, ${teamName} needs significant improvement. Required daily average: ${fmt(requiredDaily)} units (+${Math.round(requiredGrowthPercentage)}% from current pace).${surgeMsg}`,
            tone: 'warning'
        };
    } else if (requiredGrowthPercentage > 10 && requiredGrowthPercentage <= 120) {
        return {
            text: `📈 ${teamName} is slightly behind. Increase daily average to ${fmt(requiredDaily)} units (+${Math.round(requiredGrowthPercentage)}%) to hit target.${surgeMsg}`,
            tone: 'neutral'
        };
    } else {
        return {
            text: `✅ ${teamName} is on track. Maintain current daily pace of approx. ${fmt(requiredDaily)} units to comfortably hit target.${surgeMsg}`,
            tone: 'positive'
        };
    }
};
