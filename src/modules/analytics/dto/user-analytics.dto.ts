export class UserOverviewDto {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  returningUsers: number;
  userGrowth: number;
  activeRate: number;
}

export class UserGrowthDto {
  date: string;
  newUsers: number;
  totalUsers: number;
}

export class UserRetentionDto {
  cohort: string;
  total: number;
  week1: number;
  week2: number;
  week4: number;
  week8: number;
  week12: number;
}

export class UserActivityDto {
  date: string;
  activeUsers: number;
  newUsers: number;
  sessions: number;
  averageSessionDuration: number;
}

export class UserRoleDistributionDto {
  role: string;
  count: number;
  percentage: number;
}

export class UserLocationDto {
  country: string;
  city: string;
  count: number;
  percentage: number;
}