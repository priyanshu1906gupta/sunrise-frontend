export interface SubscriptionRow {
  companyId: string;
  companyName: string;
  ownerName: string;
  phone: string;
  subscriptionStartAt: string;
  subscriptionEndAt: string;
  daysLeft: number;
  active: boolean;
  ended: boolean;
}
