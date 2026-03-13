/**
 * Processes a skill's description and metadata to return dynamic effects 
 * based on player stats.
 * 
 * Example Workflow:
 * User has 12 CHA.
 * Skill has: { stat: "CHA", divisor: 4, template: "Pools cost {n} less Gold" }
 * Result: "Pools cost 3 less Gold"
 */
export function getSkillDynamicDescription(skill: any, playerStats: any): string | null {
  const requirements = skill.statRequirements;
  if (!Array.isArray(requirements) || (requirements as any).length === 0) {
    return null;
  }

  const stats = playerStats?.stats || playerStats?.shopState?.stats || {};
  const lines: string[] = [];

  for (const req of (requirements as any[])) {
    const { stat, divisor, template } = req as any;
    if (!stat || !template) continue;

    const val = Number(stats[stat] || 0);
    const div = Number(divisor) || 1;
    const n = Math.floor(val / div);

    if (n <= 0) continue;

    // Replace {n} with the calculated value
    const finalLine = template.replace('{n}', n.toString());
    lines.push(finalLine);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
