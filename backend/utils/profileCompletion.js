export function calculateProfileCompletion(user) {
  let score = 0;

  if (user.display_name) score += 15;
  if (user.bio) score += 15;
  if (user.location) score += 15;
  if (user.work_education) score += 15;
  if (user.relationship_status) score += 15;
  if (user.gender) score += 10;
  if (user.date_of_birth) score += 10;
  if (user.avatar_url) score += 5;

  return Math.min(score, 100);
}
