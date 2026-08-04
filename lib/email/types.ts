export interface UserPreferences {
  productUpdates: boolean;
  newsletter: boolean;
  weeklyEducation: boolean;
  marketingEmails: boolean;
  featureReleases: boolean;
  securityAlerts: boolean; // Always true
  billingAlerts: boolean;  // Always true
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  productUpdates: true,
  newsletter: true,
  weeklyEducation: true,
  marketingEmails: true,
  featureReleases: true,
  securityAlerts: true,
  billingAlerts: true,
};
